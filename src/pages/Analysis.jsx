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
    Bot
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
import { getDeviceStreamData, getTopicStreamData, getDeviceStateDetails, getTimeRange } from '../services/api';
import { getRobotsForDevice } from '../config/robotRegistry';

// Get task history from robots context
const generateTaskHistory = (robots) => {
    const tasks = [];
    Object.values(robots || {}).forEach(robot => {
        if (robot.task) {
            tasks.push({
                taskId: robot.task.taskId || `TSK-${robot.id}`,
                taskName: robot.task.type || 'Unknown Task',
                robotId: robot.id.replace('robot-', 'R-'),
                status: robot.task.status || 'In Progress'
            });
        }
    });

    // If no real tasks, return empty array
    return tasks;
};

function Analysis() {
    const { selectedDeviceId, currentRobots } = useDevice();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [timeRange, setTimeRange] = useState('6h');
    const [interval, setInterval] = useState('5 Seconds');
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

        const avgBattery = Math.round(robotsArr.reduce((acc, r) => acc + (r.status?.battery || 0), 0) / robotsArr.length);
        const avgTemp = (robotsArr.reduce((acc, r) => acc + (r.environment?.temp || 0), 0) / robotsArr.length).toFixed(1);

        const lowBattery = robotsArr.filter(r => (r.status?.battery || 100) < 30);
        const highTemp = robotsArr.filter(r => (r.environment?.temp || 0) > 35);
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
                                const taskData = typeof value === 'string' ? JSON.parse(value) : value;

                                if (!robotMap[robotId]) {
                                    robotMap[robotId] = { robotId: robotId };
                                }

                                robotMap[robotId] = {
                                    ...robotMap[robotId],
                                    taskId: taskData.taskId || '-',
                                    taskName: taskData.taskName || 'No Task',
                                    status: taskData.status || 'Assigned',
                                    location: taskData.location || '-',
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
                        getTopicStreamData(selectedDeviceId, `fleetMS/robots/${robotId}/battery`, startTime, endTime).catch(() => null),
                        getTopicStreamData(selectedDeviceId, `fleetMS/robots/${robotId}/temperature`, startTime, endTime).catch(() => null)
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

    const fetchRobotHistory = useCallback(async () => {
        if (!selectedRobotForHistory) return;
        try {
            const { startTime, endTime } = getTimeRange(timeRange);

            const [batRes, tempRes] = await Promise.all([
                getTopicStreamData(selectedDeviceId, `fleetMS/robots/${selectedRobotForHistory}/battery`, startTime, endTime).catch(() => ({ status: 'Failed', data: [] })),
                getTopicStreamData(selectedDeviceId, `fleetMS/robots/${selectedRobotForHistory}/temperature`, startTime, endTime).catch(() => ({ status: 'Failed', data: [] }))
            ]);

            const dataByTimestamp = {};

            const process = (records, type) => {
                if (!Array.isArray(records)) return;
                records.forEach(record => {
                    try {
                        const payload = JSON.parse(record.payload || '{}');
                        const value = payload.value ?? payload.battery ?? payload.temperature ?? payload.temp ?? payload;
                        const timestamp = record.timestamp;
                        if (!dataByTimestamp[timestamp]) dataByTimestamp[timestamp] = { timestamp, battery: null, temp: null };
                        if (type === 'battery') dataByTimestamp[timestamp].battery = Number(value);
                        if (type === 'temp') dataByTimestamp[timestamp].temp = Number(value);
                    } catch (e) { }
                });
            };

            if (batRes.status === 'Success') process(batRes.data, 'battery');
            if (tempRes.status === 'Success') process(tempRes.data, 'temp');

            const transformed = Object.values(dataByTimestamp)
                .map(r => ({
                    time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
                    fullTime: r.timestamp,
                    battery: r.battery,
                    temp: r.temp
                }))
                .sort((a, b) => new Date(a.fullTime) - new Date(b.fullTime));

            setRobotChartData(transformed);
        } catch (err) {
            console.error('[Analysis] ❌ Robot history fetch failed', err);
            setRobotChartData([]);
        }
    }, [selectedDeviceId, selectedRobotForHistory, timeRange]);

    useEffect(() => {
        fetchRobotHistory();
    }, [fetchRobotHistory]);

    // Fetch data from API
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        const { startTime, endTime } = getTimeRange(timeRange);

        try {
            // Fetch specific topics in parallel
            const [tempRes, humRes, pressRes] = await Promise.all([
                getTopicStreamData(selectedDeviceId, 'fleetMS/temperature', startTime, endTime).catch(() => ({ status: 'Failed', data: [] })),
                getTopicStreamData(selectedDeviceId, 'fleetMS/humidity', startTime, endTime).catch(() => ({ status: 'Failed', data: [] })),
                getTopicStreamData(selectedDeviceId, 'fleetMS/pressure', startTime, endTime).catch(() => ({ status: 'Failed', data: [] }))
            ]);

            const dataByTimestamp = {};

            const processRecords = (records, type) => {
                if (!Array.isArray(records)) return;

                records.forEach(record => {
                    try {
                        const payload = JSON.parse(record.payload || '{}');
                        const value = payload.value ?? payload.temperature ?? payload.humidity ?? payload.pressure ?? payload;
                        const timestamp = record.timestamp;

                        if (!dataByTimestamp[timestamp]) {
                            dataByTimestamp[timestamp] = {
                                timestamp: timestamp,
                                temp: null,
                                humidity: null,
                                pressure: null
                            };
                        }

                        if (type === 'temp') dataByTimestamp[timestamp].temp = value;
                        if (type === 'humidity') dataByTimestamp[timestamp].humidity = value;
                        if (type === 'pressure') dataByTimestamp[timestamp].pressure = value;
                    } catch (e) {
                        // ignore
                    }
                });
            };

            if (tempRes.status === 'Success') processRecords(tempRes.data, 'temp');
            if (humRes.status === 'Success') processRecords(humRes.data, 'humidity');
            if (pressRes.status === 'Success') processRecords(pressRes.data, 'pressure');

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

    // Fetch data on mount and dependencies change
    useEffect(() => {
        fetchData();
        fetchRobotData();
        fetchRobotSensorData();
    }, [fetchData, fetchRobotData, fetchRobotSensorData]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        const intervalId = setInterval(() => {
            fetchData();
            fetchRobotData();
            fetchRobotSensorData();
        }, 30000);
        return () => clearInterval(intervalId);
    }, [fetchData, fetchRobotData, fetchRobotSensorData]);

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
        container: { padding: '24px', maxWidth: '100%', minHeight: '100%' },
        header: { marginBottom: '24px' },
        title: { fontSize: '24px', fontWeight: '600', color: '#1F2937', marginBottom: '4px' },
        chartCard: { background: 'white', borderRadius: '16px', border: '1px solid #E5E7EB', padding: '24px', marginBottom: '24px' },
        chartHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' },
        chartTitle: { fontSize: '16px', fontWeight: '600', color: '#374151' },
        filterGroup: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
        filterPill: { padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', border: '1px solid #E5E7EB', background: 'white', color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' },
        filterPillActive: { background: '#F3F4F6', borderColor: '#9CA3AF' },
        legendGroup: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
        legendItem: { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s' },
        legendDot: { width: '10px', height: '10px', borderRadius: '50%' },
        exportBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', background: 'white', color: '#374151', fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s' },
        select: { padding: '8px 12px', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '13px', color: '#374151', background: 'white', cursor: 'pointer' },
        tableCard: { background: 'white', borderRadius: '16px', border: '1px solid #E5E7EB', overflow: 'hidden', marginTop: '24px' },
        tableTitle: { fontSize: '18px', fontWeight: '600', color: '#1F2937', padding: '20px 24px', borderBottom: '1px solid #E5E7EB' },
        table: { width: '100%', borderCollapse: 'collapse' },
        th: { textAlign: 'left', padding: '16px 24px', fontSize: '14px', fontWeight: '600', color: '#374151', borderBottom: '1px solid #E5E7EB', background: '#FAFAFA' },
        td: { padding: '16px 24px', fontSize: '14px', color: '#6B7280', borderBottom: '1px solid #F3F4F6' },
        statusBadge: { padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }
    };

    const metricColors = { temp: '#D97706', humidity: '#059669', battery: '#7C3AED', pressure: '#3B82F6' };

    const getStatusStyle = (status) => {
        const s = status?.toLowerCase();
        if (s?.includes('completed') || s?.includes('ready') || s?.includes('idle')) return { background: '#D1FAE5', color: '#065F46' };
        if (s?.includes('progress') || s?.includes('active')) return { background: '#DBEAFE', color: '#1D4ED8' };
        if (s?.includes('pending') || s?.includes('assigned')) return { background: '#FEF3C7', color: '#92400E' };
        if (s?.includes('warning') || s?.includes('low')) return { background: '#FEE2E2', color: '#991B1B' };
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
                            <button style={styles.filterPill}>{interval}</button>
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

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', marginBottom: '16px' }}>
                    <button style={styles.exportBtn} onClick={fetchData} disabled={isLoading}>
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Refresh
                    </button>
                    <button style={styles.exportBtn} onClick={handleExportCSV}>
                        <Download size={14} /> Export CSV
                    </button>
                    <select style={styles.select} value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
                        <option value="1h">1h</option>
                        <option value="6h">6h</option>
                        <option value="12h">12h</option>
                        <option value="24h">24h</option>
                    </select>
                </div>

                <div style={{ height: '350px', width: '100%' }}>
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
                        <button style={styles.exportBtn} onClick={fetchRobotHistory}><RefreshCw size={14} /> Refresh</button>
                    </div>
                </div>

                <div style={{ height: '400px', width: '100%' }}>
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

            {/* Robot Task History Table */}
            <div style={styles.tableCard}>
                <h2 style={styles.tableTitle}>Fleet Task History</h2>
                <div style={{ overflowX: 'auto' }}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Robot ID</th>
                                <th style={styles.th}>Name</th>
                                <th style={styles.th}>Current Task</th>
                                <th style={styles.th}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                // Merge data sources for table
                                const liveRobots = Object.values(currentRobots || {});
                                const hasLive = liveRobots.length > 0 && liveRobots.some(r => r.status?.battery > 0);

                                // Source to render
                                const displayData = hasLive ? liveRobots : robotSensorData;

                                if (displayData.length === 0) {
                                    return (
                                        <tr>
                                            <td colSpan="4" style={{ ...styles.td, textAlign: 'center', padding: '40px' }}>
                                                No fleet data available
                                            </td>
                                        </tr>
                                    );
                                }

                                return displayData.map((robot, idx) => {
                                    // Normalize fields
                                    const id = robot.id || robot.robotId;
                                    const name = robot.name || robot.robotName || id;
                                    const task = robot.task?.task || robot.task?.type || robot.taskName || 'Idle';
                                    const state = robot.status?.state ?? robot.status ?? 'Unknown';

                                    // Determine effective status
                                    const isOnline = Boolean(state && String(state).toUpperCase() !== 'UNKNOWN');

                                    return (
                                        <tr key={idx}>
                                            <td style={styles.td}>{id}</td>
                                            <td style={{ ...styles.td, fontWeight: '600', color: '#1F2937' }}>{name}</td>
                                            <td style={styles.td}>{task}</td>
                                            <td style={styles.td}>
                                                <span style={{ ...styles.statusBadge, ...getStatusStyle(state) }}>
                                                    {state === 'Unknown' && isOnline ? 'ONLINE' : state}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                });
                            })()}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default Analysis;
