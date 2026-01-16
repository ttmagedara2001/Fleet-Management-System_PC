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
        battery: true
    });

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
        try {
            const { startTime, endTime } = getTimeRange(timeRange);

            const response = await getDeviceStreamData(
                selectedDeviceId,
                startTime,
                endTime,
                "0",
                "500"
            );

            if (response.status === 'Success' && response.data) {
                const robotSensorMap = {};

                response.data.forEach(record => {
                    const topic = record.topicSuffix || '';
                    const match = topic.match(/fleetMS\/robots\/([^/]+)\/(battery|temperature|humidity|status)/);

                    if (match) {
                        const robotId = match[1];
                        const sensorType = match[2];

                        try {
                            const payload = JSON.parse(record.payload || '{}');
                            const value = payload.value ?? payload;

                            if (!robotSensorMap[robotId]) {
                                const robotInfo = deviceRobots.find(r => r.id === robotId);
                                robotSensorMap[robotId] = {
                                    robotId,
                                    name: robotInfo?.name || robotId,
                                    battery: null,
                                    temperature: null,
                                    humidity: null,
                                    status: 'Unknown'
                                };
                            }

                            if (sensorType === 'battery') {
                                robotSensorMap[robotId].battery = typeof value === 'number' ? value : parseFloat(value) || 0;
                            } else if (sensorType === 'temperature') {
                                robotSensorMap[robotId].temperature = typeof value === 'number' ? value : parseFloat(value) || 0;
                            } else if (sensorType === 'humidity') {
                                robotSensorMap[robotId].humidity = typeof value === 'number' ? value : parseFloat(value) || 0;
                            } else if (sensorType === 'status') {
                                robotSensorMap[robotId].status = value || 'Unknown';
                            }
                        } catch (e) {
                            // Ignored
                        }
                    }
                });

                const chartData = Object.values(robotSensorMap);

                if (chartData.length === 0) {
                    const defaultData = deviceRobots.map(robot => ({
                        robotId: robot.id,
                        name: robot.name,
                        battery: Math.floor(Math.random() * 40) + 60,
                        temperature: Math.floor(Math.random() * 10) + 20,
                        humidity: Math.floor(Math.random() * 20) + 40,
                        status: 'Active'
                    }));
                    setRobotSensorData(defaultData);
                } else {
                    setRobotSensorData(chartData);
                }
                console.log(`[Analysis] ✅ Robot sensor data updated (${chartData.length || deviceRobots.length} robots)`);
            } else {
                const defaultData = deviceRobots.map(robot => ({
                    robotId: robot.id,
                    name: robot.name,
                    battery: 80,
                    temperature: 25,
                    humidity: 50,
                    status: 'Active'
                }));
                setRobotSensorData(defaultData);
            }
        } catch (err) {
            console.error('[Analysis] ❌ Robot sensor data fetch failed');
        }
    }, [selectedDeviceId, timeRange, deviceRobots]);

    // Fetch data from API
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        const { startTime, endTime } = getTimeRange(timeRange);

        try {
            const response = await getDeviceStreamData(
                selectedDeviceId,
                startTime,
                endTime,
                "0",
                "500"
            );

            if (response.status === 'Success' && response.data && response.data.length > 0) {
                const dataByTimestamp = {};

                response.data.forEach(record => {
                    try {
                        const payload = JSON.parse(record.payload || '{}');
                        const value = payload.value;
                        const timestamp = record.timestamp;

                        if (!dataByTimestamp[timestamp]) {
                            dataByTimestamp[timestamp] = {
                                timestamp: timestamp,
                                temp: null,
                                humidity: null,
                                battery: null,
                                pressure: null
                            };
                        }

                        const topic = record.topicSuffix || '';
                        if (topic.includes('temperature')) {
                            dataByTimestamp[timestamp].temp = value;
                        } else if (topic.includes('humidity')) {
                            dataByTimestamp[timestamp].humidity = value;
                        } else if (topic.includes('battery')) {
                            dataByTimestamp[timestamp].battery = value;
                        } else if (topic.includes('pressure')) {
                            dataByTimestamp[timestamp].pressure = value;
                        }
                    } catch (parseError) {
                        // Ignored
                    }
                });

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
                        battery: record.battery,
                        pressure: record.pressure
                    }))
                    .sort((a, b) => new Date(a.fullTime) - new Date(b.fullTime));

                setChartData(transformed);
                setDataSource('api');
                console.log(`[Analysis] ✅ Historical data updated (${transformed.length} points)`);
            } else {
                setChartData([]);
                setDataSource('empty');
            }
        } catch (err) {
            console.error('[Analysis] ❌ Historical data fetch failed');
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

        const headers = ['Time', 'Full Timestamp', 'Temperature (°C)', 'Humidity (%)', 'Battery (%)'];
        const rows = chartData.map(row => [
            row.time,
            row.fullTime,
            row.temp ?? '',
            row.humidity ?? '',
            row.battery ?? ''
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

    const metricColors = { temp: '#D97706', humidity: '#059669', battery: '#7C3AED' };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Completed': return { background: '#D1FAE5', color: '#065F46' };
            case 'In Progress': return { background: '#DBEAFE', color: '#1D4ED8' };
            case 'Pending': return { background: '#FEF3C7', color: '#92400E' };
            default: return { background: '#F3F4F6', color: '#6B7280' };
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.title}>Environmental Data | {selectedDeviceId}</h1>
            </div>

            <div style={styles.chartCard}>
                <div style={styles.chartHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <span style={styles.chartTitle}>Historical Trends of the Sensors</span>
                        <div style={styles.filterGroup}>
                            <button style={{ ...styles.filterPill, ...(timeRange === '6h' ? styles.filterPillActive : {}) }} onClick={() => setTimeRange('6h')}>
                                <Clock size={12} /> Last 6 Hours
                            </button>
                            <button style={styles.filterPill}>{interval}</button>
                            <button style={styles.filterPill}>{chartData.length} points</button>
                        </div>
                    </div>

                    <div style={styles.legendGroup}>
                        {['temp', 'humidity', 'battery'].map(metric => (
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
                                    {metric === 'temp' ? 'Temp' : metric.charAt(0).toUpperCase() + metric.slice(1)}
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
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                            <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} tickMargin={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                            {activeMetrics.temp && <Line type="monotone" dataKey="temp" stroke={metricColors.temp} strokeWidth={3} dot={false} activeDot={{ r: 6 }} />}
                            {activeMetrics.humidity && <Line type="monotone" dataKey="humidity" stroke={metricColors.humidity} strokeWidth={3} dot={false} activeDot={{ r: 6 }} />}
                            {activeMetrics.battery && <Line type="monotone" dataKey="battery" stroke={metricColors.battery} strokeWidth={3} dot={false} activeDot={{ r: 6 }} />}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Robot Sensor Data Bar Chart */}
            <div style={styles.chartCard} id="robot-sensors-card">
                <div style={styles.chartHeader}>
                    <span style={styles.chartTitle}>Robot Status Overview</span>
                </div>
                <div style={{ height: '300px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={robotSensorData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                            <Legend />
                            <Bar dataKey="battery" name="Battery %" fill={metricColors.battery} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="temperature" name="Temp °C" fill={metricColors.temp} radius={[4, 4, 0, 0]} />
                        </BarChart>
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
                                <th style={styles.th}>Task ID</th>
                                <th style={styles.th}>Robot</th>
                                <th style={styles.th}>Task Type</th>
                                <th style={styles.th}>Destination</th>
                                <th style={styles.th}>Priority</th>
                                <th style={styles.th}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {robotData.length > 0 ? robotData.map((robot, idx) => (
                                <tr key={idx}>
                                    <td style={styles.td}>{robot.taskId || '--'}</td>
                                    <td style={styles.td}>{robot.robotId}</td>
                                    <td style={styles.td}>{robot.taskName}</td>
                                    <td style={styles.td}>{robot.location}</td>
                                    <td style={styles.td}>{robot.priority}</td>
                                    <td style={styles.td}>
                                        <span style={{ ...styles.statusBadge, ...getStatusStyle(robot.status) }}>
                                            {robot.status}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="6" style={{ ...styles.td, textAlign: 'center', padding: '40px' }}>
                                        No task history available
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default Analysis;
