import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    Download,
    RefreshCw,
    Thermometer,
    Droplets,
    Battery,
    Loader2,
    Clock,
    Globe,
    AlertCircle,
    Database,
    Bot,
    Trash2
} from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    BarChart,
    Bar
} from 'recharts';
import { useDevice } from '../contexts/DeviceContext';
import { getDeviceStreamData, getTopicStreamData, getDeviceStateDetails, updateStateDetails, getTimeRange } from '../services/api';
import { getRobotsForDevice } from '../config/robotRegistry';
import { TASK_PHASES, PHASE_LABELS, PHASE_COLORS, computePhaseProgress, findRoomAtPoint, ROOMS } from '../utils/telemetryMath';
import { getThresholds as getThresholdsShared } from '../utils/thresholds';

function Analysis() {
    const { selectedDeviceId, currentRobots, taskUpdateVersion, fetchRobotTasks, getLocalTaskHistory } = useDevice();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [timeRange, setTimeRange] = useState('6h');
    const [displayInterval, setDisplayInterval] = useState('5 Seconds');
    const [chartData, setChartData] = useState([]);
    const [dataSource, setDataSource] = useState('loading'); // 'api', 'empty', 'loading', 'error'
    const [robotData, setRobotData] = useState([]); // HTTP fetched robot data
    const [robotSensorData, setRobotSensorData] = useState([]); // Robot sensor chart data
    const [selectedRobotId, setSelectedRobotId] = useState(null); // Selected robot for sensor chart
    const [activeMetrics, setActiveMetrics] = useState({
        temp: true,
        humidity: true,
        pressure: true
    });

    // Smart Insight Calculations
    const fleetInsights = useMemo(() => {
        const robotsArr = Object.values(currentRobots || {});
        if (robotsArr.length === 0) return null;

        // Read user-defined thresholds
        const thresholds = getThresholdsShared();

        const avgBattery = Math.round(robotsArr.reduce((acc, r) => acc + (r.status?.battery || 0), 0) / robotsArr.length);
        const avgTemp = (robotsArr.reduce((acc, r) => acc + (r.environment?.temp || 0), 0) / robotsArr.length).toFixed(1);

        const lowBattery = robotsArr.filter(r => (r.status?.battery || 100) <= thresholds.battery.low);
        const highTemp = robotsArr.filter(r => (r.environment?.temp || 0) > thresholds.robotTemp.max);
        const activeTasks = robotsArr.filter(r => r.task?.status === 'In Progress').length;

        return {
            avgBattery,
            avgTemp,
            lowBattery: lowBattery.length,
            criticalUnit: lowBattery[0]?.name || highTemp[0]?.name || null,
            highTemp: highTemp.length,
            activeTasks,
            totalRobots: robotsArr.length
        };
    }, [currentRobots]);

    // Format currentRobots for the BarChart
    const chartRobotData = useMemo(() => {
        // Prioritize fetched sensor data if available (e.g. after refresh)
        if (robotSensorData.length > 0) {
            return robotSensorData.map(r => ({
                name: r.name || r.robotId,
                battery: r.battery || 0,
                temp: r.temp || r.temperature || 0,
                id: r.robotId
            }));
        }

        // Fallback to live context data
        return Object.values(currentRobots || {}).map(r => ({
            name: r.name || r.id,
            battery: r.status?.battery || 0,
            temp: r.environment?.temp || 0,
            id: r.id
        }));
    }, [currentRobots, robotSensorData]);

    // Get robots for current device
    const deviceRobots = useMemo(() => getRobotsForDevice(selectedDeviceId), [selectedDeviceId]);

    // Fetch robot task data from HTTP (STATE and STREAM for discovery)
    const fetchRobotData = useCallback(async () => {
        console.log(`[Analysis] 🤖 Fetching robot data for: ${selectedDeviceId}`);

        try {
            const { startTime, endTime } = getTimeRange(timeRange);

            // 1. Fetch robots from STREAM (robot discovery)
            const streamResponse = await getDeviceStreamData(
                selectedDeviceId,
                startTime,
                endTime,
                "0",
                "500"
            );

            // Build robot map from stream data
            const robotMap = {};
            let robotCount = 0;

            if (streamResponse.status === 'Success' && streamResponse.data) {
                streamResponse.data.forEach(record => {
                    if (record.topicSuffix && record.topicSuffix.includes('robots')) {
                        try {
                            const payload = JSON.parse(record.payload || '{}');
                            const robotId = payload.robotId || payload.id;

                            if (robotId && !robotMap[robotId]) {
                                robotMap[robotId] = {
                                    robotId: robotId,
                                    robotName: payload.robotName || robotId,
                                    taskId: '-',
                                    taskName: 'No Task',
                                    status: 'Idle',
                                    location: '-',
                                    priority: 'Normal'
                                };
                                robotCount++;
                            }
                        } catch (err) {
                            // Silently ignore parse errors
                        }
                    }
                });
            }

            // 2. Fetch assigned tasks from STATE
            const stateResponse = await getDeviceStateDetails(selectedDeviceId);

            if (stateResponse.status === 'Success' && stateResponse.data) {
                Object.entries(stateResponse.data).forEach(([topicKey, value]) => {
                    if (topicKey.includes('fleetMS/robots/') && topicKey.includes('/task')) {
                        try {
                            const robotIdMatch = topicKey.match(/fleetMS\/robots\/([^/]+)\/task/);
                            const robotId = robotIdMatch ? robotIdMatch[1] : null;

                            if (robotId) {
                                // Unwrap { payload: ... } envelope from state API
                                let taskData = typeof value === 'string' ? JSON.parse(value) : value;
                                if (taskData?.payload) {
                                    taskData = typeof taskData.payload === 'string'
                                        ? JSON.parse(taskData.payload)
                                        : taskData.payload;
                                }

                                if (!robotMap[robotId]) {
                                    robotMap[robotId] = { robotId: robotId };
                                }

                                robotMap[robotId] = {
                                    ...robotMap[robotId],
                                    taskId: taskData.taskId || taskData.task_id || '-',
                                    taskName: 'Deliver',
                                    status: taskData.status || 'Assigned',
                                    location: taskData['initiate location'] || taskData.source_name || taskData.location || '-',
                                    destination: taskData.destination || taskData.destination_name || '-',
                                    priority: taskData.priority || 'Normal'
                                };
                            }
                        } catch (err) {
                            // Silently ignore parse errors
                        }
                    }
                });
            }

            const robots = Object.values(robotMap);
            setRobotData(robots);
            console.log(`[Analysis] ✅ Robot data updated (${robots.length} robots)`);

        } catch (err) {
            console.error('[Analysis] ❌ Robot data fetch failed');
        }
    }, [selectedDeviceId, timeRange]);

    // Fetch robot sensor data for chart
    const fetchRobotSensorData = useCallback(async () => {
        if (!deviceRobots.length) return;

        try {
            const { startTime, endTime } = getTimeRange(timeRange);
            const sensorDataMap = {};

            // Initialize map with defaults
            deviceRobots.forEach(r => {
                sensorDataMap[r.id] = {
                    robotId: r.id,
                    name: r.name,
                    battery: 0,
                    temp: 0,
                    status: 'Unknown'
                };
            });

            // Fetch data for each robot
            await Promise.all(deviceRobots.map(async (robot) => {
                const robotId = robot.id;

                try {
                    // Fetch Battery and Temp in parallel for this robot
                    // Topic pattern: fleetMS/robots/<ID>/<metric>
                    const [batRes, tempRes] = await Promise.all([
                        getTopicStreamData(selectedDeviceId, `fleetMS/robots/${robotId}/battery`, startTime, endTime, '0', '100', { silent: true }).catch(() => null),
                        getTopicStreamData(selectedDeviceId, `fleetMS/robots/${robotId}/temperature`, startTime, endTime, '0', '100', { silent: true }).catch(() => null)
                    ]);

                    // Helper to get latest value from valid response
                    const getLatest = (res) => {
                        if (res?.status === 'Success' && res.data?.length > 0) {
                            // Sort by timestamp desc
                            const sorted = res.data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                            const latest = sorted[0];
                            try {
                                const payload = JSON.parse(latest.payload || '{}');
                                return payload.value ?? payload.battery ?? payload.temperature ?? payload.temp ?? payload;
                            } catch (e) { return 0; }
                        }
                        return null;
                    };

                    const batVal = getLatest(batRes);
                    const tempVal = getLatest(tempRes);

                    if (batVal !== null) sensorDataMap[robotId].battery = Number(batVal);
                    if (tempVal !== null) sensorDataMap[robotId].temp = Number(tempVal);
                    sensorDataMap[robotId].status = 'Active'; // Assume active if we have data?

                } catch (e) {
                    console.warn(`Failed to fetch sensors for ${robotId}`, e);
                }
            }));

            const chartData = Object.values(sensorDataMap);
            setRobotSensorData(chartData);
            console.log(`[Analysis] ✅ Robot sensor data updated (${chartData.length} robots)`);

        } catch (err) {
            console.error('[Analysis] ❌ Robot sensor data fetch failed', err);
        }
    }, [selectedDeviceId, timeRange, deviceRobots]);

    // Selected robot history state
    const [selectedRobotForHistory, setSelectedRobotForHistory] = useState(deviceRobots[0]?.id || (deviceRobots[0] && deviceRobots[0].id) || null);
    const [robotChartData, setRobotChartData] = useState([]);
    const [activeRobotMetrics, setActiveRobotMetrics] = useState({ battery: true, temp: true });
    // Task history state (last 24 hours) – keyed per robot
    const [robotTaskMap, setRobotTaskMap] = useState({}); // { [robotId]: TaskEntry[] }
    const [historyLoading, setHistoryLoading] = useState(false);
    const [expandedRobots, setExpandedRobots] = useState({}); // { [robotId]: bool }
    const [robotStatusFilter, setRobotStatusFilter] = useState({}); // { [robotId]: 'all'|'completed'|... }

    const fetchRobotHistory = useCallback(async () => {
        if (!selectedRobotForHistory) return;
        try {
            const { startTime, endTime } = getTimeRange(timeRange);

            // Fetch combined topic AND per-metric sub-topics in parallel
            const [combinedRes, batteryRes, tempRes] = await Promise.all([
                getTopicStreamData(selectedDeviceId, `fleetMS/robots/${selectedRobotForHistory}`, startTime, endTime, '0', '100', { silent: true }).catch(() => ({ status: 'Failed', data: [] })),
                getTopicStreamData(selectedDeviceId, `fleetMS/robots/${selectedRobotForHistory}/battery`, startTime, endTime, '0', '100', { silent: true }).catch(() => ({ status: 'Failed', data: [] })),
                getTopicStreamData(selectedDeviceId, `fleetMS/robots/${selectedRobotForHistory}/temperature`, startTime, endTime, '0', '100', { silent: true }).catch(() => ({ status: 'Failed', data: [] }))
            ]);

            const dataByTimestamp = {};

            // Helper to process a response into the dataByTimestamp map
            const processResponse = (res) => {
                if (res.status === 'Success' && Array.isArray(res.data)) {
                    res.data.forEach(record => {
                        try {
                            const payload = JSON.parse(record.payload || '{}');
                            const timestamp = record.timestamp;
                            const batt = payload.battery ?? payload.level ?? payload.batteryLevel ?? null;
                            const temp = payload.temperature ?? payload.temp ?? null;

                            if (!dataByTimestamp[timestamp]) dataByTimestamp[timestamp] = { timestamp, battery: null, temp: null };
                            if (batt !== null) dataByTimestamp[timestamp].battery = Number(batt);
                            if (temp !== null) dataByTimestamp[timestamp].temp = Number(temp);
                        } catch (e) { /* ignore parse errors */ }
                    });
                }
            };

            processResponse(combinedRes);
            processResponse(batteryRes);
            processResponse(tempRes);

            const transformed = Object.values(dataByTimestamp)
                .map(r => ({
                    time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
                    fullTime: r.timestamp,
                    battery: r.battery,
                    temp: r.temp
                }))
                .sort((a, b) => new Date(a.fullTime) - new Date(b.fullTime));

            setRobotChartData(transformed);
            console.log(`[Analysis] ✅ Robot history updated (${transformed.length} points for ${selectedRobotForHistory})`);
        } catch (err) {
            console.error('[Analysis] ❌ Robot history fetch failed', err);
            setRobotChartData([]);
        }
    }, [selectedDeviceId, selectedRobotForHistory, timeRange]);

    useEffect(() => {
        fetchRobotHistory();
    }, [fetchRobotHistory]);

    // Progress chart removed per user request; mergedChartData omitted

    // Deep-unwrap a raw value that may be nested as stringified JSON or { payload: ... } objects
    const deepUnwrapPayload = useCallback((raw) => {
        let obj = raw;
        for (let i = 0; i < 5; i++) {
            if (typeof obj === 'string') {
                try { obj = JSON.parse(obj); } catch { return obj; }
            } else if (obj && typeof obj === 'object' && 'payload' in obj && obj.payload !== undefined) {
                obj = obj.payload;
            } else {
                break;
            }
        }
        return obj;
    }, []);

    // Format raw task type codes like "MOVE_FOUP" → "Move Foup", "pickup" → "Pickup"
    const formatTaskName = useCallback((raw) => {
        if (!raw) return null;
        const s = String(raw).trim();
        if (!s) return null;
        // Convert UPPER_SNAKE_CASE or lower_snake_case to Title Case
        return s
            .split(/[_\-\s]+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }, []);

    // Normalise status string to user-friendly display value
    const normalizeStatus = useCallback((raw, phase) => {
        // If a phase is provided from the new system, use it as the source of truth
        if (phase && PHASE_LABELS[phase]) {
            return PHASE_LABELS[phase];
        }
        if (!raw) return null;
        const s = String(raw).toLowerCase().trim();
        if (s === 'completed' || s === 'done' || s === 'finished' || s === 'complete') return 'Completed';
        if (s === 'in_progress' || s === 'in progress' || s === 'running' || s === 'moving' || s === 'active' || s === 'executing') return 'In Progress';
        if (s === 'assigned' || s === 'allocated' || s === 'queued' || s === 'waiting' || s === 'scheduled' || s === 'pending') return 'Assigned';
        if (s === 'failed' || s === 'error' || s === 'aborted' || s === 'cancelled') return 'Failed';
        if (s === 'stalled') return '⚠️ Stalled';
        if (s === 'ready' || s === 'idle') return 'Ready';
        // Fallback: title-case the raw value
        return raw.charAt(0).toUpperCase() + raw.slice(1);
    }, []);

    // Helper: parse a raw task payload into a normalized entry
    const parseTaskPayload = useCallback((rawPayload, robotId, robotInfo, cutoff, source) => {
        if (!rawPayload) return null;

        // Deep-unwrap any string / nested { payload } wrapping
        const payloadObj = deepUnwrapPayload(rawPayload);
        if (!payloadObj || typeof payloadObj !== 'object') return null;

        // Extract allocated timestamp — ONLY from assignedAt (set when task is allocated from Settings)
        const rawAllocatedTs = payloadObj.assignedAt || null;
        let allocatedAt = null;
        if (rawAllocatedTs) {
            allocatedAt = typeof rawAllocatedTs === 'number'
                ? Math.floor(Number(rawAllocatedTs) * (rawAllocatedTs < 1e12 ? 1000 : 1))
                : new Date(rawAllocatedTs).getTime();
            if (isNaN(allocatedAt)) allocatedAt = null;
        }

        // General timestamp for dedup/sorting (use allocatedAt or fallback)
        const possibleTs = rawAllocatedTs || payloadObj.recordedAt || payloadObj.timestamp || payloadObj.time || payloadObj.updatedAt || null;
        let ts = Date.now();
        if (possibleTs) {
            ts = typeof possibleTs === 'number'
                ? Math.floor(Number(possibleTs) * (possibleTs < 1e12 ? 1000 : 1))
                : new Date(possibleTs).getTime();
        }
        if (ts < cutoff) return null;

        const progress = Number(payloadObj.progress ?? payloadObj.percent ?? payloadObj.progress_pct ?? NaN);
        const startTs = (payloadObj.start_time || payloadObj.started_at || payloadObj.startAt || payloadObj.start || payloadObj.assignedAt)
            ? new Date(payloadObj.start_time || payloadObj.started_at || payloadObj.startAt || payloadObj.start || payloadObj.assignedAt).getTime() : null;
        const completionTs = (payloadObj.completion_time || payloadObj.completed_at || payloadObj.completedAt || payloadObj.end)
            ? new Date(payloadObj.completion_time || payloadObj.completed_at || payloadObj.completedAt || payloadObj.end).getTime() : null;
        const elapsedMs = payloadObj.elapsed_ms || payloadObj.elapsed || (completionTs && startTs ? completionTs - startTs : null);

        // Extract phase (new task tracking system)
        const phase = payloadObj.phase || null;

        // Resolve status — prefer phase label if available, else raw status
        let rawStatus = payloadObj.status || payloadObj.state || null;
        let status;
        if (phase && PHASE_LABELS[phase]) {
            status = PHASE_LABELS[phase];
        } else if (!rawStatus) {
            status = completionTs ? 'Completed' : startTs ? 'In Progress' : 'Assigned';
        } else {
            status = normalizeStatus(rawStatus, phase);
        }

        const srcLat = payloadObj.source_lat ?? payloadObj.src_lat ?? payloadObj.sourceLat ?? payloadObj.start_lat ?? payloadObj.startLat ?? payloadObj.origin?.lat ?? payloadObj.source?.lat ?? payloadObj.start?.lat;
        const srcLng = payloadObj.source_lng ?? payloadObj.src_lng ?? payloadObj.sourceLng ?? payloadObj.start_lng ?? payloadObj.startLng ?? payloadObj.origin?.lng ?? payloadObj.source?.lng ?? payloadObj.start?.lng;
        const dstLat = payloadObj.destination_lat ?? payloadObj.dest_lat ?? payloadObj.destinationLat ?? payloadObj.end_lat ?? payloadObj.endLat ?? payloadObj.destination?.lat ?? payloadObj.end?.lat;
        const dstLng = payloadObj.destination_lng ?? payloadObj.dest_lng ?? payloadObj.destinationLng ?? payloadObj.end_lng ?? payloadObj.endLng ?? payloadObj.destination?.lng ?? payloadObj.end?.lng;

        const sourceLocationName = payloadObj['initiate location'] || payloadObj.source_name || payloadObj.sourceName || payloadObj.origin_name || payloadObj.start_name
            || (typeof payloadObj.source === 'string' ? payloadObj.source : null) || (typeof payloadObj.origin === 'string' ? payloadObj.origin : null);
        const destLocationName = payloadObj.destination_name || payloadObj.destinationName || payloadObj.dest_name || payloadObj.end_name
            || (typeof payloadObj.destination === 'string' ? payloadObj.destination : null);

        // Task type is always Deliver now
        const rawTaskName = 'Deliver';

        // Resolve task ID
        const taskId = payloadObj.taskId || payloadObj.task_id || payloadObj.id || null;

        return {
            robotId: payloadObj.robotId || payloadObj.robot || robotId,
            robotName: robotInfo.name || robotId,
            taskId,
            taskName: formatTaskName(rawTaskName),
            rawTaskType: rawTaskName,
            phase,
            status,
            timestamp: ts,
            allocatedAt: allocatedAt,
            progress: Number.isFinite(Number(progress)) ? Number(progress) : (phase === TASK_PHASES.COMPLETED ? 100 : phase === TASK_PHASES.ASSIGNED ? 0 : status === 'Completed' ? 100 : null),
            startTime: startTs,
            completionTime: completionTs,
            elapsedMs,
            source,
            sourceLocation: sourceLocationName,
            destinationLocation: destLocationName,
            source_lat: srcLat, source_lng: srcLng,
            destination_lat: dstLat, destination_lng: dstLng,
            // Phase timestamps
            sourceArrivedAt: payloadObj.sourceArrivedAt ? new Date(payloadObj.sourceArrivedAt).getTime() : null,
            pickedUpAt: payloadObj.pickedUpAt ? new Date(payloadObj.pickedUpAt).getTime() : null,
            destinationArrivedAt: payloadObj.destinationArrivedAt ? new Date(payloadObj.destinationArrivedAt).getTime() : null,
            deliveredAt: payloadObj.deliveredAt ? new Date(payloadObj.deliveredAt).getTime() : null,
        };
    }, [deepUnwrapPayload, formatTaskName, normalizeStatus]);

    // Fetch per-robot task history (last 24 hours) from both STATE and STREAM
    const fetchTaskHistory = useCallback(async () => {
        if (!selectedDeviceId || !deviceRobots?.length) return;
        setHistoryLoading(true);
        try {
            const cutoff = Date.now() - 24 * 60 * 60 * 1000;
            const { startTime, endTime } = getTimeRange('24h');
            const taskMap = {};

            // Initialize every registered robot with an empty array
            deviceRobots.forEach(r => { taskMap[r.id] = []; });

            // 1. Fetch latest state per robot (single call)
            const deviceState = await getDeviceStateDetails(selectedDeviceId).catch(() => ({ status: 'Failed', data: {} }));

            if (deviceState.status === 'Success' && deviceState.data) {
                console.log('[Analysis] 🔍 State API raw data keys:', Object.keys(deviceState.data).filter(k => k.includes('/task')));
                Object.entries(deviceState.data).forEach(([topicKey, value]) => {
                    if (topicKey.includes('fleetMS/robots/') && topicKey.includes('/task')) {
                        try {
                            const match = topicKey.match(/fleetMS\/robots\/([^/]+)\/task/);
                            const robotId = match?.[1];
                            if (!robotId) return;
                            const robotInfo = deviceRobots.find(r => r.id === robotId) || { id: robotId, name: robotId };
                            // Pass the raw value directly — parseTaskPayload's deepUnwrap handles all nesting
                            console.log(`[Analysis] 🔍 State [${robotId}] raw value:`, typeof value, value);
                            const entry = parseTaskPayload(value, robotId, robotInfo, cutoff, 'state');
                            if (entry) {
                                console.log(`[Analysis] ✅ State [${robotId}] parsed:`, entry.taskName, entry.taskId, entry.status);
                                if (!taskMap[robotId]) taskMap[robotId] = [];
                                taskMap[robotId].push(entry);
                            }
                        } catch (e) { console.warn('[Analysis] State parse error:', e); }
                    }
                });
            }

            // 2. Fetch ALL stream data in a single call, then filter task-related topics client-side
            try {
                const streamRes = await getDeviceStreamData(selectedDeviceId, startTime, endTime, '0', '500');
                if (streamRes.status === 'Success' && Array.isArray(streamRes.data)) {
                    streamRes.data.forEach(record => {
                        const topic = record.topicSuffix || record.topic || '';
                        // Match task-related topics: fleetMS/robots/{id}/task* 
                        const taskTopicMatch = topic.match(/robots\/([^/]+)\/task/);
                        if (!taskTopicMatch) return;
                        const robotId = taskTopicMatch[1];
                        const robotInfo = deviceRobots.find(r => r.id === robotId) || { id: robotId, name: robotId };
                        try {
                            // Build a combined object with record metadata + payload content
                            let payloadObj;
                            try { payloadObj = JSON.parse(record.payload || '{}'); } catch { payloadObj = record.payload; }
                            // Deep-unwrap is handled inside parseTaskPayload
                            // Inject record-level timestamp if payload doesn't have one
                            if (typeof payloadObj === 'object' && payloadObj && !payloadObj.timestamp && record.timestamp) {
                                payloadObj.timestamp = record.timestamp;
                            }
                            const entry = parseTaskPayload(payloadObj, robotId, robotInfo, cutoff, 'stream');
                            if (entry) {
                                if (!taskMap[robotId]) taskMap[robotId] = [];
                                taskMap[robotId].push(entry);
                            }
                        } catch { /* ignore parse errors */ }
                    });
                }
            } catch { /* ignore stream fetch error */ }

            // Also include tasks from live context (WebSocket) that might not be in API yet
            const liveRobots = currentRobots || {};
            Object.entries(liveRobots).forEach(([robotId, robot]) => {
                if (robot?.task) {
                    const robotInfo = deviceRobots.find(r => r.id === robotId) || { id: robotId, name: robotId };
                    // Enrich live task with real-time progress from GPS position
                    const liveTask = { ...robot.task };
                    if (liveTask.phase && robot.location?.lat != null && robot.location?.lng != null) {
                        liveTask.progress = computePhaseProgress(liveTask, robot.location.lat, robot.location.lng);
                    }
                    const entry = parseTaskPayload(liveTask, robotId, robotInfo, cutoff, 'live');
                    if (entry) {
                        if (!taskMap[robotId]) taskMap[robotId] = [];
                        taskMap[robotId].push(entry);
                    }
                }
                // Also include any task_queue entries if robot holds multiple tasks
                if (Array.isArray(robot?.taskQueue)) {
                    const robotInfo = deviceRobots.find(r => r.id === robotId) || { id: robotId, name: robotId };
                    robot.taskQueue.forEach(qTask => {
                        const entry = parseTaskPayload(qTask, robotId, robotInfo, cutoff, 'live');
                        if (entry) {
                            if (!taskMap[robotId]) taskMap[robotId] = [];
                            taskMap[robotId].push(entry);
                        }
                    });
                }
            });

            // 4. Include locally-persisted task history (captures ALL allocated tasks across sessions)
            if (getLocalTaskHistory) {
                const localHistory = getLocalTaskHistory(selectedDeviceId);
                Object.entries(localHistory).forEach(([robotId, tasks]) => {
                    if (!Array.isArray(tasks)) return;
                    const robotInfo = deviceRobots.find(r => r.id === robotId) || { id: robotId, name: robotId };
                    tasks.forEach(taskData => {
                        const entry = parseTaskPayload(taskData, robotId, robotInfo, cutoff, 'local');
                        if (entry) {
                            if (!taskMap[robotId]) taskMap[robotId] = [];
                            taskMap[robotId].push(entry);
                        }
                    });
                });
            }

            // Deduplicate per robot by taskId — prefer live source (most up-to-date progress)
            Object.keys(taskMap).forEach(robotId => {
                const byKey = {};
                // Sort so 'live' entries come first — they have the freshest progress
                const prioritized = [...taskMap[robotId]].sort((a, b) => {
                    const sourcePri = { live: 0, state: 1, local: 2, stream: 3 };
                    return (sourcePri[a.source] ?? 4) - (sourcePri[b.source] ?? 4);
                });
                prioritized.forEach(entry => {
                    const key = entry.taskId || `${entry.taskName}-${entry.robotId}-${Math.floor(entry.timestamp / 60000)}`;
                    if (!byKey[key]) {
                        byKey[key] = entry;
                    } else {
                        // Merge live progress into existing entry if source is older
                        const existing = byKey[key];
                        if (entry.source === 'live' || (entry.progress != null && existing.progress == null)) {
                            byKey[key] = { ...existing, progress: entry.progress, phase: entry.phase || existing.phase, status: entry.status || existing.status };
                        }
                    }
                });
                taskMap[robotId] = Object.values(byKey).sort((a, b) => b.timestamp - a.timestamp);
            });

            setRobotTaskMap(taskMap);

            // Auto-expand robots that have tasks
            setExpandedRobots(prev => {
                const next = { ...prev };
                Object.entries(taskMap).forEach(([robotId, tasks]) => {
                    if (tasks.length > 0 && prev[robotId] === undefined) next[robotId] = true;
                });
                return next;
            });
        } catch (err) {
            console.error('[Analysis] ❌ Task history fetch failed', err);
            setRobotTaskMap({});
        } finally {
            setHistoryLoading(false);
        }
    }, [selectedDeviceId, deviceRobots, currentRobots, parseTaskPayload, getLocalTaskHistory]);

    // Delete a task: clear the robot's task topic by sending an empty payload
    const handleDeleteTask = useCallback(async (robotId, taskEntry) => {
        if (!selectedDeviceId || !robotId) return;

        const confirmMsg = taskEntry.taskName
            ? `Delete task "${taskEntry.taskName}" from ${taskEntry.robotName || robotId}?`
            : `Delete this task from ${taskEntry.robotName || robotId}?`;

        if (!window.confirm(confirmMsg)) return;

        try {
            // Clear the task state by sending a cleared payload
            await updateStateDetails(selectedDeviceId, `fleetMS/robots/${robotId}/task`, {
                task: null,
                taskId: null,
                status: 'cleared',
                clearedAt: new Date().toISOString(),
                clearedBy: 'user'
            });

            // Optimistically remove from local state
            setRobotTaskMap(prev => {
                const updated = { ...prev };
                if (updated[robotId]) {
                    const key = taskEntry.taskId || `${taskEntry.taskName}-${taskEntry.timestamp}`;
                    updated[robotId] = updated[robotId].filter(t => {
                        const tKey = t.taskId || `${t.taskName}-${t.timestamp}`;
                        return tKey !== key;
                    });
                }
                return updated;
            });

            console.log(`[Analysis] 🗑️ Task deleted for ${robotId}:`, taskEntry.taskId || taskEntry.taskName);
        } catch (err) {
            console.error(`[Analysis] ❌ Failed to delete task for ${robotId}:`, err);
            alert('Failed to delete task. Please try again.');
        }
    }, [selectedDeviceId]);

    // Fetch data from API
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        const { startTime, endTime } = getTimeRange(timeRange);

        try {
            // Fetch environment topic which contains temperature/humidity/pressure
            const envRes = await getTopicStreamData(selectedDeviceId, 'fleetMS/environment', startTime, endTime, '0', '100', { silent: true }).catch(() => ({ status: 'Failed', data: [] }));

            const dataByTimestamp = {};

            if (envRes.status === 'Success' && Array.isArray(envRes.data)) {
                envRes.data.forEach(record => {
                    try {
                        const payload = JSON.parse(record.payload || '{}');
                        const timestamp = record.timestamp;
                        const temp = payload.temperature ?? payload.temp ?? payload.ambient_temp ?? null;
                        const humidity = payload.humidity ?? payload.ambient_hum ?? null;
                        const pressure = payload.pressure ?? payload.atmospheric_pressure ?? null;

                        if (!dataByTimestamp[timestamp]) dataByTimestamp[timestamp] = { timestamp, temp: null, humidity: null, pressure: null };
                        if (temp !== null) dataByTimestamp[timestamp].temp = Number(temp);
                        if (humidity !== null) dataByTimestamp[timestamp].humidity = Number(humidity);
                        if (pressure !== null) dataByTimestamp[timestamp].pressure = Number(pressure);
                    } catch (e) { /* ignore parse */ }
                });
            }

            const transformed = Object.values(dataByTimestamp)
                .map(record => ({
                    time: new Date(record.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    }),
                    fullTime: record.timestamp,
                    temp: record.temp,
                    humidity: record.humidity,
                    pressure: record.pressure
                }))
                .sort((a, b) => new Date(a.fullTime) - new Date(b.fullTime));

            if (transformed.length > 0) {
                setChartData(transformed);
                setDataSource('api');
                console.log(`[Analysis] ✅ Historical data updated (${transformed.length} points)`);
            } else {
                setChartData([]);
                setDataSource('empty');
            }

        } catch (err) {
            console.error('[Analysis] ❌ Historical data fetch failed:', err);
            setError(err.message || 'Failed to fetch data');
            setDataSource('error');
        } finally {
            setIsLoading(false);
        }
    }, [selectedDeviceId, timeRange]);

    // Fetch data on mount and when dependencies change
    useEffect(() => {
        fetchData();
        fetchRobotData();
        fetchTaskHistory();
        fetchRobotSensorData();
    }, [fetchData, fetchRobotData, fetchRobotSensorData, fetchTaskHistory]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        const id = window.setInterval(() => {
            fetchData();
            fetchRobotData();
            fetchTaskHistory();
            fetchRobotSensorData();
        }, 30000);
        return () => window.clearInterval(id);
    }, [fetchData, fetchRobotData, fetchRobotSensorData, fetchTaskHistory]);

    // Refresh task history when tasks are updated from Settings page
    useEffect(() => {
        if (taskUpdateVersion > 0) {
            console.log('[Analysis] 🔄 Task update detected, refreshing task history...');
            fetchTaskHistory();
        }
    }, [taskUpdateVersion, fetchTaskHistory]);

    const toggleMetric = (metric) => {
        setActiveMetrics(prev => ({
            ...prev,
            [metric]: !prev[metric]
        }));
    };

    const handleExportCSV = () => {
        if (chartData.length === 0) {
            alert('No data to export');
            return;
        }

        const headers = ['Time', 'Full Timestamp', 'Temperature (°C)', 'Humidity (%)', 'Pressure (hPa)'];
        const rows = chartData.map(row => [
            row.time,
            row.fullTime,
            row.temp ?? '',
            row.humidity ?? '',
            row.pressure ?? ''
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${selectedDeviceId}_data.csv`;
        link.click();
        console.log('[Analysis] ✅ CSV exported');
    };

    // Styles (Condensed for brevity, same as original but removed comments/logs inside)
    const styles = {
        container: { padding: '12px', maxWidth: '100%', minHeight: '100%' },
        header: { marginBottom: '16px' },
        title: { fontSize: '22px', fontWeight: '600', color: '#1F2937', marginBottom: '4px' },
        chartCard: { background: 'white', borderRadius: '14px', border: '1px solid #E5E7EB', padding: '14px', marginBottom: '16px' },
        chartHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' },
        chartTitle: { fontSize: '15px', fontWeight: '600', color: '#374151' },
        filterGroup: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
        filterPill: { padding: '5px 10px', borderRadius: '18px', fontSize: '12px', fontWeight: '500', border: '1px solid #E5E7EB', background: 'white', color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' },
        filterPillActive: { background: '#F3F4F6', borderColor: '#9CA3AF' },
        legendGroup: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
        legendItem: { display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '18px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s' },
        legendDot: { width: '9px', height: '9px', borderRadius: '50%' },
        exportBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #E5E7EB', background: 'white', color: '#374151', fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s' },
        select: { padding: '6px 10px', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '13px', color: '#374151', background: 'white', cursor: 'pointer' },
        tableCard: { background: 'white', borderRadius: '14px', border: '1px solid #E5E7EB', overflow: 'hidden', marginTop: '16px' },
        tableTitle: { fontSize: '16px', fontWeight: '600', color: '#1F2937', padding: '12px 16px', borderBottom: '1px solid #E5E7EB' },
        table: { width: '100%', borderCollapse: 'collapse' },
        th: { textAlign: 'left', padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#374151', borderBottom: '1px solid #E5E7EB', background: '#FAFAFA' },
        td: { padding: '12px 16px', fontSize: '13px', color: '#6B7280', borderBottom: '1px solid #F3F4F6' },
        statusBadge: { padding: '4px 10px', borderRadius: '18px', fontSize: '12px', fontWeight: '500' }
    };

    const metricColors = { temp: '#D97706', humidity: '#059669', battery: '#7C3AED', pressure: '#3B82F6' };

    const getStatusStyle = (status, phase) => {
        // Phase-based coloring (preferred)
        if (phase && PHASE_COLORS[phase]) {
            return PHASE_COLORS[phase];
        }
        const s = status?.toLowerCase();
        if (s?.includes('completed') || s?.includes('done') || s?.includes('finished') || s?.includes('delivered')) return { background: '#D1FAE5', color: '#065F46' };
        if (s?.includes('en route') || s?.includes('progress') || s?.includes('active') || s?.includes('moving') || s?.includes('executing')) return { background: '#DBEAFE', color: '#1D4ED8' };
        if (s?.includes('at source') || s?.includes('picking') || s?.includes('at destination') || s?.includes('delivering')) return { background: '#FEF3C7', color: '#92400E' };
        if (s?.includes('assigned') || s?.includes('pending') || s?.includes('queued') || s?.includes('scheduled')) return { background: '#E0E7FF', color: '#4F46E5' };
        if (s?.includes('failed') || s?.includes('error') || s?.includes('aborted') || s?.includes('cancelled')) return { background: '#FEE2E2', color: '#991B1B' };
        if (s?.includes('stalled')) return { background: '#FEF3C7', color: '#B45309' };
        if (s?.includes('ready') || s?.includes('idle')) return { background: '#E0E7FF', color: '#3730A3' };
        if (s?.includes('warning') || s?.includes('low')) return { background: '#FEF3C7', color: '#92400E' };
        return { background: '#F3F4F6', color: '#6B7280' };
    };

    const InsightCard = ({ title, value, sub, color, icon: Icon }) => (
        <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '16px',
            border: `1px solid ${color}20`,
            flex: '1',
            minWidth: '200px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div style={{ position: 'absolute', right: '-10px', top: '-10px', opacity: 0.1, color }}>
                {Icon && <Icon size={80} />}
            </div>
            <p style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', marginBottom: '8px' }}>{title}</p>
            <h3 style={{ fontSize: '28px', fontWeight: '700', color: '#1F2937' }}>{value}</h3>
            <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>{sub}</p>
        </div>
    );

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.title}>Fleet Intelligence & Analysis</h1>
                <p style={{ color: '#6B7280', fontSize: '14px' }}>Real-time sensor metrics and predictive fleet insights for {selectedDeviceId}</p>
            </div>

            {/* Smart Insight Panel */}
            {fleetInsights && (
                <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    <InsightCard
                        title="Avg Fleet Battery"
                        value={`${fleetInsights.avgBattery}%`}
                        sub={`${fleetInsights.lowBattery} robots need charging`}
                        color="#7C3AED"
                        icon={Battery}
                    />
                    <InsightCard
                        title="Fleet Temperature"
                        value={`${fleetInsights.avgTemp}°C`}
                        sub={fleetInsights.highTemp > 0 ? `${fleetInsights.highTemp} units running hot` : "Optimal thermal range"}
                        color="#D97706"
                        icon={Thermometer}
                    />
                    <InsightCard
                        title="Active Missions"
                        value={fleetInsights.activeTasks}
                        sub={`Out of ${fleetInsights.totalRobots} total units`}
                        color="#059669"
                        icon={RefreshCw}
                    />
                    <InsightCard
                        title="System Health"
                        value={fleetInsights.lowBattery > 0 ? "Caution" : "Nominal"}
                        sub={fleetInsights.criticalUnit ? `Check ${fleetInsights.criticalUnit}` : "All systems stable"}
                        color={fleetInsights.lowBattery > 0 ? "#EF4444" : "#22C55E"}
                        icon={AlertCircle}
                    />
                </div>
            )}

            <div style={styles.chartCard}>
                <div style={styles.chartHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <span style={styles.chartTitle}>Historical Environmental Trends</span>
                        <div style={styles.filterGroup}>
                            <button style={{ ...styles.filterPill, ...(timeRange === '6h' ? styles.filterPillActive : {}) }} onClick={() => setTimeRange('6h')}>
                                <Clock size={12} /> Last 6 Hours
                            </button>
                            <button style={styles.filterPill}>{displayInterval}</button>
                            <button style={styles.filterPill}>{chartData.length} points</button>
                        </div>
                    </div>

                    <div style={styles.legendGroup}>
                        {['temp', 'humidity', 'pressure'].map(metric => (
                            <div key={metric}
                                style={{
                                    ...styles.legendItem,
                                    background: activeMetrics[metric] ?
                                        (metric === 'temp' ? '#FEF3C7' : metric === 'humidity' ? '#D1FAE5' : '#EDE9FE') : '#F9FAFB',
                                    border: `1px solid ${activeMetrics[metric] ? metricColors[metric] : '#E5E7EB'}`
                                }}
                                onClick={() => toggleMetric(metric)}
                            >
                                <div style={{ ...styles.legendDot, background: metricColors[metric] }} />
                                <span style={{ color: activeMetrics[metric] ? 'inherit' : '#9CA3AF' }}>
                                    {metric === 'temp' ? 'Temp' : metric === 'pressure' ? 'Pressure' : metric.charAt(0).toUpperCase() + metric.slice(1)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="analysis-controls" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', marginBottom: '16px' }}>
                    <button className="export-btn" style={styles.exportBtn} onClick={fetchData} disabled={isLoading} aria-label="Refresh">
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button className="export-btn" style={styles.exportBtn} onClick={handleExportCSV}>
                        <Download size={14} /> Export CSV
                    </button>
                    <select style={styles.select} value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
                        <option value="1h">1h</option>
                        <option value="6h">6h</option>
                        <option value="12h">12h</option>
                        <option value="24h">24h</option>
                    </select>
                </div>

                <div style={{ height: '350px', width: '100%', minWidth: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <defs>
                                <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={metricColors.temp} stopOpacity={0.1} />
                                    <stop offset="95%" stopColor={metricColors.temp} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                            <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} tickMargin={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                            {activeMetrics.temp && <Line type="monotone" dataKey="temp" stroke={metricColors.temp} strokeWidth={3} dot={false} activeDot={{ r: 6 }} />}
                            {activeMetrics.humidity && <Line type="monotone" dataKey="humidity" stroke={metricColors.humidity} strokeWidth={3} dot={false} activeDot={{ r: 6 }} />}
                            {activeMetrics.pressure && <Line type="monotone" dataKey="pressure" stroke={metricColors.pressure} strokeWidth={3} dot={false} activeDot={{ r: 6 }} />}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Robot Historical Trends */}
            <div style={styles.chartCard} id="robot-history-card">
                <div style={{ ...styles.chartHeader, alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={styles.chartTitle}>Robot Historical Trends</span>
                        <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Battery and temperature over time for a selected robot</span>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <select style={styles.select} value={selectedRobotForHistory || ''} onChange={(e) => setSelectedRobotForHistory(e.target.value)}>
                            {deviceRobots.map(r => <option key={r.id} value={r.id}>{r.name || r.id}</option>)}
                        </select>
                        <div style={styles.legendGroup}>
                            {['battery', 'temp'].map(metric => (
                                <div key={metric}
                                    style={{
                                        ...styles.legendItem,
                                        background: activeRobotMetrics[metric] ? '#F9FAFB' : '#FFF',
                                        border: `1px solid ${activeRobotMetrics[metric] ? metricColors[metric] : '#E5E7EB'}`
                                    }}
                                    onClick={() => setActiveRobotMetrics(prev => ({ ...prev, [metric]: !prev[metric] }))}
                                >
                                    <div style={{ ...styles.legendDot, background: metricColors[metric] }} />
                                    <span style={{ color: activeRobotMetrics[metric] ? 'inherit' : '#9CA3AF' }}>{metric === 'temp' ? 'Temp' : 'Battery'}</span>
                                </div>
                            ))}
                        </div>
                        <button className="export-btn" style={styles.exportBtn} onClick={fetchRobotHistory} aria-label="Refresh"><RefreshCw size={14} /></button>
                    </div>
                </div>

                <div style={{ height: '400px', width: '100%', minWidth: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={robotChartData} margin={{ top: 20, right: 60, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                            <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                            <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#7C3AED' }} unit="%" domain={[0, 100]} />
                            <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#D97706' }} unit="°C" domain={[0, 60]} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                            <Legend />
                            {activeRobotMetrics.battery && <Line yAxisId="left" type="monotone" dataKey="battery" stroke={metricColors.battery} strokeWidth={3} dot={false} activeDot={{ r: 6 }} name="Battery %" />}
                            {activeRobotMetrics.temp && <Line yAxisId="right" type="monotone" dataKey="temp" stroke={metricColors.temp} strokeWidth={3} dot={false} activeDot={{ r: 6 }} name="Temp °C" />}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

{/* Per-Robot Task History Tables (last 24 hours) */}
            <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1F2937' }}>
                        <Bot size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />
                        Robot Task History (24h)
                    </h2>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button style={styles.exportBtn} onClick={fetchTaskHistory} disabled={historyLoading} aria-label="Refresh all task history">
                            {historyLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            Refresh All
                        </button>
                        <span style={{ fontSize: 13, color: '#6B7280' }}>
                            {Object.values(robotTaskMap).reduce((sum, arr) => sum + arr.length, 0)} total entries
                        </span>
                    </div>
                </div>

                {historyLoading && Object.keys(robotTaskMap).length === 0 ? (
                    <div style={{ ...styles.tableCard, textAlign: 'center', padding: '40px', color: '#6B7280' }}>
                        <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                        <p>Loading task history...</p>
                    </div>
                ) : deviceRobots.length === 0 ? (
                    <div style={{ ...styles.tableCard, textAlign: 'center', padding: '40px', color: '#6B7280' }}>
                        No robots registered for this device
                    </div>
                ) : (
                    deviceRobots.map(robot => {
                        const robotId = robot.id;
                        const tasks = robotTaskMap[robotId] || [];
                        const isExpanded = expandedRobots[robotId] ?? false;
                        const filter = robotStatusFilter[robotId] || 'all';

                        // Count by status (phase-aware)
                        const counts = { all: tasks.length, allocated: 0, completed: 0, incomplete: 0 };
                        tasks.forEach(t => {
                            const phase = t.phase;
                            if (phase === TASK_PHASES.COMPLETED) { counts.completed++; return; }
                            if (phase === TASK_PHASES.ASSIGNED) { counts.allocated++; return; }
                            if (phase && phase !== TASK_PHASES.FAILED) { counts.incomplete++; return; }
                            // Legacy fallback
                            const s = String(t.status || '').toLowerCase();
                            if (s.includes('complete') || s.includes('done') || s.includes('delivered')) counts.completed++;
                            else if (s.includes('assigned') || s === 'pending' || s === 'queued' || s === 'scheduled') counts.allocated++;
                            else counts.incomplete++;
                        });

                        // Filter tasks (phase-aware)
                        const filteredTasks = tasks.filter(t => {
                            if (filter === 'all') return true;
                            const phase = t.phase;
                            const s = String(t.status || '').toLowerCase();
                            if (filter === 'allocated') return phase === TASK_PHASES.ASSIGNED || (!phase && (s.includes('assigned') || s === 'pending'));
                            if (filter === 'completed') return phase === TASK_PHASES.COMPLETED || (!phase && (s.includes('complete') || s.includes('done')));
                            if (filter === 'incomplete') {
                                if (phase) return phase !== TASK_PHASES.COMPLETED && phase !== TASK_PHASES.ASSIGNED;
                                return !s.includes('complete') && !s.includes('done') && !s.includes('assigned') && s !== 'pending';
                            }
                            return true;
                        }).sort((a, b) => (b.allocatedAt || b.timestamp) - (a.allocatedAt || a.timestamp));

                        // Get live robot state for status indicator
                        const liveRobot = currentRobots?.[robotId];
                        const robotState = liveRobot?.status?.state || 'Unknown';
                        const stateColor = robotState === 'ACTIVE' || robotState === 'MOVING' ? '#22C55E'
                            : robotState === 'READY' ? '#3B82F6'
                            : robotState === 'CHARGING' ? '#F59E0B'
                            : robotState === 'OFFLINE' || robotState === 'ERROR' ? '#EF4444'
                            : '#9CA3AF';

                        return (
                            <div key={robotId} style={{ ...styles.tableCard, marginBottom: '12px' }}>
                                {/* Robot header - clickable to expand/collapse */}
                                <div
                                    onClick={() => setExpandedRobots(prev => ({ ...prev, [robotId]: !isExpanded }))}
                                    style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '12px 16px', cursor: 'pointer', userSelect: 'none',
                                        borderBottom: isExpanded ? '1px solid #E5E7EB' : 'none',
                                        transition: 'background 0.15s',
                                        borderRadius: isExpanded ? '14px 14px 0 0' : '14px'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontSize: '16px' }}>{isExpanded ? '▼' : '▶'}</span>
                                        <Bot size={18} style={{ color: stateColor }} />
                                        <div>
                                            <span style={{ fontWeight: '600', color: '#1F2937', fontSize: '14px' }}>
                                                {robot.name || robotId}
                                            </span>
                                            <span style={{ marginLeft: '8px', fontSize: '12px', color: '#9CA3AF' }}>
                                                {robotId}
                                            </span>
                                        </div>
                                        <span style={{
                                            padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600',
                                            background: `${stateColor}18`, color: stateColor
                                        }}>
                                            {robotState}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <span style={{ ...styles.statusBadge, background: '#DBEAFE', color: '#1D4ED8', fontSize: '11px' }}>
                                            {counts.allocated} Allocated
                                        </span>
                                        <span style={{ ...styles.statusBadge, background: '#FEF3C7', color: '#92400E', fontSize: '11px' }}>
                                            {counts.incomplete} In Progress
                                        </span>
                                        <span style={{ ...styles.statusBadge, background: '#D1FAE5', color: '#065F46', fontSize: '11px' }}>
                                            {counts.completed} Completed
                                        </span>
                                        <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: '500' }}>
                                            {counts.all} total
                                        </span>
                                    </div>
                                </div>

                                {/* Expanded: filter tabs + task table */}
                                {isExpanded && (
                                    <div>
                                        {/* Status filter tabs */}
                                        <div style={{ display: 'flex', gap: '4px', padding: '8px 16px', borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }}>
                                            {[
                                                { key: 'all', label: 'All', count: counts.all },
                                                { key: 'allocated', label: 'Allocated', count: counts.allocated },
                                                { key: 'incomplete', label: 'In Progress', count: counts.incomplete },
                                                { key: 'completed', label: 'Completed', count: counts.completed }
                                            ].map(tab => (
                                                <button
                                                    key={tab.key}
                                                    onClick={(e) => { e.stopPropagation(); setRobotStatusFilter(prev => ({ ...prev, [robotId]: tab.key })); }}
                                                    style={{
                                                        padding: '4px 12px', borderRadius: '14px', fontSize: '12px', fontWeight: '600',
                                                        border: filter === tab.key ? '1px solid #6366F1' : '1px solid #E5E7EB',
                                                        background: filter === tab.key ? '#EEF2FF' : 'white',
                                                        color: filter === tab.key ? '#4F46E5' : '#6B7280',
                                                        cursor: 'pointer', transition: 'all 0.15s'
                                                    }}
                                                >
                                                    {tab.label} ({tab.count})
                                                </button>
                                            ))}
                                        </div>

                                        {/* Task table */}
                                        <div style={{ overflowX: 'auto', maxHeight: 280, overflowY: 'auto' }}>
                                            <table style={styles.table}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ ...styles.th, fontSize: '12px' }}>Allocated At</th>
                                                        <th style={{ ...styles.th, fontSize: '12px' }}>Task Name</th>
                                                        <th style={{ ...styles.th, fontSize: '12px' }}>Task ID</th>
                                                        <th style={{ ...styles.th, fontSize: '12px' }}>Status</th>
                                                        <th style={{ ...styles.th, fontSize: '12px' }}>Progress</th>
                                                        <th style={{ ...styles.th, fontSize: '12px' }}>Route</th>
                                                        <th style={{ ...styles.th, fontSize: '12px' }}>Source</th>
                                                        <th style={{ ...styles.th, fontSize: '12px', width: '50px', textAlign: 'center' }}>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredTasks.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="8" style={{ ...styles.td, textAlign: 'center', padding: '24px', color: '#9CA3AF' }}>
                                                                {filter === 'all'
                                                                    ? `No tasks recorded for ${robot.name || robotId} in the last 24 hours`
                                                                    : `No ${filter} tasks for ${robot.name || robotId}`}
                                                            </td>
                                                        </tr>
                                                    ) : filteredTasks.map((row, idx) => {
                                                        const formatLoc = (name, lat, lng) => {
                                                            if (name) return name;
                                                            if (lat != null && lng != null) return `(${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)})`;
                                                            return null;
                                                        };
                                                        const src = formatLoc(row.sourceLocation, row.source_lat, row.source_lng);
                                                        const dst = formatLoc(row.destinationLocation, row.destination_lat, row.destination_lng);
                                                        const route = src && dst ? `${src} → ${dst}` : (src ? `From: ${src}` : dst ? `To: ${dst}` : '—');

                                                        const progressVal = row.progress;
                                                        const progressColor = progressVal >= 100 ? '#059669' : progressVal >= 50 ? '#2563EB' : progressVal > 0 ? '#D97706' : '#9CA3AF';

                                                        // Format elapsed time
                                                        const formatElapsed = (ms) => {
                                                            if (!ms) return null;
                                                            const secs = Math.floor(ms / 1000);
                                                            if (secs < 60) return `${secs}s`;
                                                            const mins = Math.floor(secs / 60);
                                                            if (mins < 60) return `${mins}m ${secs % 60}s`;
                                                            return `${Math.floor(mins / 60)}h ${mins % 60}m`;
                                                        };

                                                        // Source badge: state / stream / live
                                                        const sourceBadge = {
                                                            state: { bg: '#EDE9FE', color: '#6D28D9', label: 'State' },
                                                            stream: { bg: '#DBEAFE', color: '#1D4ED8', label: 'Stream' },
                                                            live: { bg: '#D1FAE5', color: '#065F46', label: 'Live' },
                                                            local: { bg: '#FEF3C7', color: '#92400E', label: 'Local' }
                                                        }[row.source] || { bg: '#F3F4F6', color: '#6B7280', label: row.source || '?' };

                                                        return (
                                                            <tr key={`${row.taskId}-${row.timestamp}-${idx}`} style={{ transition: 'background 0.15s' }}
                                                                onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                            >
                                                                <td style={{ ...styles.td, fontSize: '12px', whiteSpace: 'nowrap' }}>
                                                                    {row.allocatedAt ? (
                                                                        <>
                                                                            {new Date(row.allocatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                                                                            <div style={{ fontSize: '10px', color: '#9CA3AF' }}>
                                                                                {new Date(row.allocatedAt).toLocaleDateString()}
                                                                            </div>
                                                                        </>
                                                                    ) : (
                                                                        <span style={{ color: '#D1D5DB' }}>—</span>
                                                                    )}
                                                                </td>
                                                                <td style={{ ...styles.td, fontSize: '12px' }}>
                                                                    <div style={{ fontWeight: '600', color: '#1F2937' }}>
                                                                        {row.taskName || 'Unnamed Task'}
                                                                    </div>
                                                                    {row.rawTaskType && (
                                                                        <span style={{
                                                                            fontSize: '10px', fontFamily: 'monospace', color: '#6B7280',
                                                                            background: '#F3F4F6', padding: '1px 4px', borderRadius: '4px', marginTop: '2px', display: 'inline-block'
                                                                        }}>
                                                                            {row.rawTaskType}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td style={{ ...styles.td, fontSize: '11px', fontFamily: 'monospace', color: '#6B7280' }}>
                                                                    {row.taskId ? (
                                                                        <span title={row.taskId}>
                                                                            {row.taskId.length > 12 ? `${row.taskId.slice(0, 12)}…` : row.taskId}
                                                                        </span>
                                                                    ) : (
                                                                        <span style={{ color: '#D1D5DB' }}>—</span>
                                                                    )}
                                                                </td>
                                                                <td style={styles.td}>
                                                                    <span style={{ ...styles.statusBadge, ...getStatusStyle(row.status, row.phase), fontSize: '11px' }}>
                                                                        {row.status}
                                                                    </span>
                                                                    {row.elapsedMs && (
                                                                        <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '2px' }}>
                                                                            {formatElapsed(row.elapsedMs)}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td style={styles.td}>
                                                                    {progressVal != null ? (
                                                                        <div>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                <div style={{ width: '60px', height: '6px', background: '#F3F4F6', borderRadius: '3px', overflow: 'hidden' }}>
                                                                                    <div style={{ width: `${Math.min(progressVal, 100)}%`, height: '100%', background: progressColor, borderRadius: '3px', transition: 'width 0.3s' }} />
                                                                                </div>
                                                                                <span style={{ fontSize: '11px', fontWeight: '600', color: progressColor }}>{progressVal}%</span>
                                                                            </div>
                                                                            {row.phase && PHASE_LABELS[row.phase] && row.phase !== TASK_PHASES.COMPLETED && row.phase !== TASK_PHASES.ASSIGNED && (
                                                                                <div style={{ fontSize: '9px', color: '#6B7280', marginTop: '2px', whiteSpace: 'nowrap' }}>
                                                                                    {PHASE_LABELS[row.phase]}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <span style={{ fontSize: '11px', color: '#D1D5DB' }}>—</span>
                                                                    )}
                                                                </td>
                                                                <td style={{ ...styles.td, fontSize: '11px', color: '#6B7280', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={route !== '—' ? route : undefined}>
                                                                    {route}
                                                                </td>
                                                                <td style={styles.td}>
                                                                    <span style={{
                                                                        padding: '1px 5px', borderRadius: '6px', fontSize: '9px', fontWeight: '600',
                                                                        background: sourceBadge.bg, color: sourceBadge.color
                                                                    }}>
                                                                        {sourceBadge.label}
                                                                    </span>
                                                                </td>
                                                                <td style={{ ...styles.td, textAlign: 'center' }}>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleDeleteTask(robotId, row); }}
                                                                        title={`Delete task${row.taskName ? ': ' + row.taskName : ''}`}
                                                                        style={{
                                                                            background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                                                                            borderRadius: '6px', color: '#9CA3AF', transition: 'all 0.15s',
                                                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                                                                        }}
                                                                        onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = '#FEE2E2'; }}
                                                                        onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.background = 'none'; }}
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export default Analysis;
