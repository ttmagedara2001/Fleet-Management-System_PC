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
    Database
} from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import { useDevice } from '../contexts/DeviceContext';
import { getAllStreamData, getStreamData, getTimeRange } from '../services/api';

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
    const { selectedDeviceId } = useDevice();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [timeRange, setTimeRange] = useState('6h');
    const [interval, setInterval] = useState('5 Seconds');
    const [chartData, setChartData] = useState([]);
    const [dataSource, setDataSource] = useState('loading'); // 'api', 'empty', 'loading', 'error'
    const [robotData, setRobotData] = useState([]); // HTTP fetched robot data
    const [activeMetrics, setActiveMetrics] = useState({
        temp: true,
        humidity: true,
        battery: true
    });

    // Fetch robot data from HTTP
    const fetchRobotData = useCallback(async () => {
        console.log('[Analysis] 🤖 Fetching robot data from fleetMS/robots');

        try {
            const { startTime, endTime } = getTimeRange(timeRange);

            const response = await getStreamData(
                selectedDeviceId,
                'fleetMS/robots',
                startTime,
                endTime,
                0,
                100
            );

            console.log('[Analysis] 📥 Robot HTTP Response:');
            console.log('   Status:', response.status);
            console.log('   Data Length:', response.data?.length || 0);

            if (response.status === 'Success' && response.data && response.data.length > 0) {
                // Parse robot data
                const robots = response.data.map(record => {
                    try {
                        const payload = JSON.parse(record.payload || '{}');
                        return {
                            robotId: payload.robotId || payload.id || 'Unknown',
                            taskId: payload.taskId || payload.task?.taskId || '-',
                            taskName: payload.taskName || payload.task?.type || 'No Task',
                            status: payload.status || payload.task?.status || 'Idle',
                            timestamp: record.timestamp
                        };
                    } catch (parseError) {
                        console.warn('[Analysis] Failed to parse robot record:', record);
                        return null;
                    }
                }).filter(r => r !== null);

                setRobotData(robots);
                console.log('[Analysis] ✅ Robot data updated:', robots.length, 'robots');
            } else {
                setRobotData([]);
                console.log('[Analysis] ℹ️ No robot data available');
            }
        } catch (err) {
            console.error('[Analysis] ❌ Robot data fetch error:', err);
            setRobotData([]);
        }
    }, [selectedDeviceId, timeRange]);

    // Fetch data from API
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        console.log('');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[Analysis] 📊 FETCHING HISTORICAL DATA FOR CHART');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('[Analysis] Device ID:', selectedDeviceId);
        console.log('[Analysis] Time Range:', timeRange);

        try {
            const { startTime, endTime } = getTimeRange(timeRange);

            console.log('[Analysis] ⏰ Calculated Time Range:');
            console.log('   Start Time:', startTime);
            console.log('   End Time:', endTime);
            console.log('');
            console.log('[Analysis] 📡 HTTP Request:');
            console.log('   Endpoint: POST /get-stream-data/device');
            console.log('   Payload:', JSON.stringify({
                deviceId: selectedDeviceId,
                startTime,
                endTime,
                pagination: '0',
                pageSize: '500'
            }, null, 2));
            console.log('');

            const response = await getAllStreamData(
                selectedDeviceId,
                startTime,
                endTime,
                0,
                500
            );

            console.log('[Analysis] 📥 HTTP Response:');
            console.log('   Status:', response.status);
            console.log('   Data Length:', response.data?.length || 0);

            if (response.data && response.data.length > 0) {
                console.log('   Sample Record:', JSON.stringify(response.data[0], null, 2));
            }
            console.log('');

            if (response.status === 'Success' && response.data && response.data.length > 0) {
                console.log('[Analysis] ✅ DATA TRANSFORMATION STARTING');
                console.log('   Raw Records:', response.data.length);

                // Group data by timestamp since API returns separate records for each sensor
                const dataByTimestamp = {};

                response.data.forEach(record => {
                    try {
                        // Parse payload JSON string
                        const payload = JSON.parse(record.payload || '{}');
                        const value = payload.value;
                        const timestamp = record.timestamp;

                        // Initialize timestamp entry if doesn't exist
                        if (!dataByTimestamp[timestamp]) {
                            dataByTimestamp[timestamp] = {
                                timestamp: timestamp,
                                temp: null,
                                humidity: null,
                                battery: null,
                                pressure: null
                            };
                        }

                        // Map value based on topicSuffix
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
                        console.warn('[Analysis] Failed to parse record:', record, parseError);
                    }
                });

                // Convert grouped data to array and format for chart
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
                    .sort((a, b) => new Date(a.fullTime) - new Date(b.fullTime)); // Sort by time

                console.log('[Analysis] ✅ DATA TRANSFORMATION SUCCESS');
                console.log('   Transformed Records:', transformed.length);
                console.log('   Sample Transformed:', JSON.stringify(transformed[0], null, 2));
                console.log('');
                console.log('[Analysis] 📊 Data Point Statistics:');
                const tempCount = transformed.filter(d => d.temp !== null).length;
                const humidityCount = transformed.filter(d => d.humidity !== null).length;
                const batteryCount = transformed.filter(d => d.battery !== null).length;
                console.log(`   Temperature: ${tempCount}/${transformed.length} records`);
                console.log(`   Humidity: ${humidityCount}/${transformed.length} records`);
                console.log(`   Battery: ${batteryCount}/${transformed.length} records`);
                console.log('');

                setChartData(transformed);
                setDataSource('api');
                console.log('[Analysis] ✅ Chart data updated successfully!');
                console.log('═══════════════════════════════════════════════════════════════');
                console.log('');
            } else {
                // No data from API - show empty state
                console.log('[Analysis] ⚠️ NO DATA RECEIVED');
                console.log('   Response Status:', response.status);
                console.log('   Data Array:', response.data ? 'Empty array' : 'Null/Undefined');
                console.log('');
                console.log('[Analysis] 💡 Troubleshooting:');
                console.log('   1. Check if device exists:', selectedDeviceId);
                console.log('   2. Check if data exists in time range:', startTime, 'to', endTime);
                console.log('   3. Check backend logs for errors');
                console.log('   4. Verify device is sending data to the backend');
                console.log('═══════════════════════════════════════════════════════════════');
                console.log('');

                setChartData([]);
                setDataSource('empty');
            }
        } catch (err) {
            console.error('[Analysis] ❌ HTTP REQUEST FAILED');
            console.error('   Error Message:', err.message);
            console.error('   Error Details:', err);
            console.error('   Stack:', err.stack);
            console.log('');
            console.log('[Analysis] 💡 Troubleshooting:');
            console.log('   1. Check network connectivity');
            console.log('   2. Verify API endpoint is correct');
            console.log('   3. Check if JWT token is valid');
            console.log('   4. Review backend server logs');
            console.log('═══════════════════════════════════════════════════════════════');
            console.log('');

            setError(err.message || 'Failed to fetch data');
            setChartData([]);
            setDataSource('error');
        } finally {
            setIsLoading(false);
        }
    }, [selectedDeviceId, timeRange]);

    // Fetch data on mount and when dependencies change
    useEffect(() => {
        fetchData();
        fetchRobotData();
    }, [fetchData, fetchRobotData]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        console.log('[Analysis] ⏰ Setting up 30-second auto-refresh');

        const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds
        const intervalId = setInterval(() => {
            console.log('[Analysis] 🔄 Auto-refresh triggered (30s interval)');
            fetchData();
            fetchRobotData();
        }, AUTO_REFRESH_INTERVAL);

        return () => {
            console.log('[Analysis] 🛑 Clearing auto-refresh interval');
            clearInterval(intervalId);
        };
    }, [fetchData]);

    const toggleMetric = (metric) => {
        setActiveMetrics(prev => ({
            ...prev,
            [metric]: !prev[metric]
        }));
    };

    const handleExportCSV = () => {
        console.log('[Analysis] 📥 Exporting CSV...');

        if (chartData.length === 0) {
            alert('No data to export');
            return;
        }

        // Create CSV content
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

        // Download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${selectedDeviceId}_data_${timeRange}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();

        console.log('[Analysis] ✅ CSV exported');
    };

    // Styles
    const styles = {
        container: {
            padding: '24px',
            maxWidth: '100%',
            minHeight: '100%'
        },
        header: {
            marginBottom: '24px'
        },
        title: {
            fontSize: '24px',
            fontWeight: '600',
            color: '#1F2937',
            marginBottom: '4px'
        },
        subtitle: {
            fontSize: '14px',
            color: '#6B7280'
        },
        deviceName: {
            color: '#7C3AED',
            fontWeight: '500'
        },
        chartCard: {
            background: 'white',
            borderRadius: '16px',
            border: '1px solid #E5E7EB',
            padding: '24px',
            marginBottom: '24px'
        },
        chartHeader: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '16px'
        },
        chartTitle: {
            fontSize: '16px',
            fontWeight: '600',
            color: '#374151'
        },
        filterGroup: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap'
        },
        filterPill: {
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '500',
            border: '1px solid #E5E7EB',
            background: 'white',
            color: '#6B7280',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s'
        },
        filterPillActive: {
            background: '#F3F4F6',
            borderColor: '#9CA3AF'
        },
        legendGroup: {
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap'
        },
        legendItem: {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s'
        },
        legendDot: {
            width: '10px',
            height: '10px',
            borderRadius: '50%'
        },
        controlGroup: {
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
        },
        select: {
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
            fontSize: '13px',
            color: '#374151',
            background: 'white',
            cursor: 'pointer',
            outline: 'none'
        },
        exportBtn: {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
            background: 'white',
            color: '#374151',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s'
        },
        chartContainer: {
            height: '350px',
            width: '100%'
        },
        tableCard: {
            background: 'white',
            borderRadius: '16px',
            border: '1px solid #E5E7EB',
            overflow: 'hidden'
        },
        tableHeader: {
            padding: '20px 24px',
            borderBottom: '1px solid #E5E7EB'
        },
        tableTitle: {
            fontSize: '18px',
            fontWeight: '600',
            color: '#1F2937'
        },
        table: {
            width: '100%',
            borderCollapse: 'collapse'
        },
        th: {
            textAlign: 'left',
            padding: '16px 24px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#374151',
            borderBottom: '1px solid #E5E7EB',
            background: '#FAFAFA'
        },
        td: {
            padding: '16px 24px',
            fontSize: '14px',
            color: '#6B7280',
            borderBottom: '1px solid #F3F4F6'
        },
        statusBadge: {
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '500'
        },
        emptyRow: {
            height: '48px',
            borderBottom: '1px solid #F3F4F6'
        }
    };

    // Metric colors matching the design
    const metricColors = {
        temp: '#D97706',      // Orange/Amber for Temperature
        humidity: '#059669',   // Green for Humidity
        battery: '#7C3AED'     // Purple for Battery
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Completed':
                return { background: '#D1FAE5', color: '#065F46' };
            case 'In Progress':
                return { background: '#DBEAFE', color: '#1D4ED8' };
            case 'Pending':
                return { background: '#FEF3C7', color: '#92400E' };
            default:
                return { background: '#F3F4F6', color: '#6B7280' };
        }
    };

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <h1 style={styles.title}>Environmental Data | {selectedDeviceId}</h1>
                {dataSource === 'fallback' && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#F59E0B',
                        fontSize: '13px',
                        marginTop: '4px'
                    }}>
                        <AlertCircle size={14} />
                        <span>Showing sample data - API returned no records</span>
                    </div>
                )}
            </div>

            {/* Chart Card */}
            <div style={styles.chartCard}>
                {/* Chart Header */}
                <div style={styles.chartHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <span style={styles.chartTitle}>Historical Trends of the Sensors</span>

                        {/* Filter Pills */}
                        <div style={styles.filterGroup}>
                            <button
                                style={{
                                    ...styles.filterPill,
                                    ...(timeRange === '6h' ? styles.filterPillActive : {})
                                }}
                                onClick={() => setTimeRange('6h')}
                            >
                                <Clock size={12} />
                                Last 6 Hours
                            </button>
                            <button style={styles.filterPill}>
                                {interval}
                            </button>
                            <button style={styles.filterPill}>
                                {chartData.length} points
                            </button>
                        </div>
                    </div>

                    {/* Legend */}
                    <div style={styles.legendGroup}>
                        <div
                            style={{
                                ...styles.legendItem,
                                background: activeMetrics.temp ? '#FEF3C7' : '#F9FAFB',
                                border: `1px solid ${activeMetrics.temp ? '#F59E0B' : '#E5E7EB'}`
                            }}
                            onClick={() => toggleMetric('temp')}
                        >
                            <div style={{ ...styles.legendDot, background: metricColors.temp }} />
                            <span style={{ color: activeMetrics.temp ? '#92400E' : '#9CA3AF' }}>Temp</span>
                        </div>

                        <div
                            style={{
                                ...styles.legendItem,
                                background: activeMetrics.humidity ? '#D1FAE5' : '#F9FAFB',
                                border: `1px solid ${activeMetrics.humidity ? '#10B981' : '#E5E7EB'}`
                            }}
                            onClick={() => toggleMetric('humidity')}
                        >
                            <div style={{ ...styles.legendDot, background: metricColors.humidity }} />
                            <span style={{ color: activeMetrics.humidity ? '#065F46' : '#9CA3AF' }}>Humidity</span>
                        </div>

                        <div
                            style={{
                                ...styles.legendItem,
                                background: activeMetrics.battery ? '#EDE9FE' : '#F9FAFB',
                                border: `1px solid ${activeMetrics.battery ? '#8B5CF6' : '#E5E7EB'}`
                            }}
                            onClick={() => toggleMetric('battery')}
                        >
                            <div style={{ ...styles.legendDot, background: metricColors.battery }} />
                            <span style={{ color: activeMetrics.battery ? '#5B21B6' : '#9CA3AF' }}>Battery</span>
                        </div>
                    </div>
                </div>

                {/* Chart Controls */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '16px',
                    marginBottom: '16px'
                }}>
                    <button
                        style={{
                            ...styles.exportBtn,
                            opacity: isLoading ? 0.6 : 1,
                            cursor: isLoading ? 'not-allowed' : 'pointer'
                        }}
                        onClick={() => {
                            console.log('[Analysis] 🔄 Manual refresh triggered by user');
                            fetchData();
                            fetchRobotData();
                        }}
                        disabled={isLoading}
                    >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                    <button
                        style={styles.exportBtn}
                        onClick={handleExportCSV}
                    >
                        <Download size={14} />
                        Export CSV
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', color: '#6B7280' }}>Time Range</span>
                        <select
                            style={styles.select}
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value)}
                        >
                            <option value="1h">1h</option>
                            <option value="6h">6h</option>
                            <option value="12h">12h</option>
                            <option value="24h">24h</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', color: '#6B7280' }}>Interval</span>
                        <select
                            style={styles.select}
                            value={interval}
                            onChange={(e) => setInterval(e.target.value)}
                        >
                            <option value="5 Seconds">5 Seconds</option>
                            <option value="30 Seconds">30 Seconds</option>
                            <option value="1 Minute">1 Minute</option>
                            <option value="5 Minutes">5 Minutes</option>
                        </select>
                    </div>
                </div>

                {/* Chart or Empty State */}
                <div style={styles.chartContainer}>
                    {isLoading ? (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            color: '#6B7280'
                        }}>
                            <Loader2 size={48} className="animate-spin" style={{ color: '#7C3AED', marginBottom: '16px' }} />
                            <p>Loading data...</p>
                        </div>
                    ) : chartData.length === 0 ? (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            color: '#6B7280',
                            textAlign: 'center'
                        }}>
                            <Database size={48} style={{ color: '#D1D5DB', marginBottom: '16px' }} />
                            <p style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>No Historical Data Available</p>
                            <p style={{ fontSize: '13px', maxWidth: '400px' }}>
                                {error
                                    ? `Error: ${error}`
                                    : `No stream data found for ${selectedDeviceId} in the last ${timeRange}. Data will appear here once the device starts streaming.`
                                }
                            </p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                <XAxis
                                    dataKey="time"
                                    tick={{ fontSize: 11, fill: '#6B7280' }}
                                    tickLine={false}
                                    axisLine={{ stroke: '#E5E7EB' }}
                                />
                                <YAxis
                                    yAxisId="left"
                                    tick={{ fontSize: 11, fill: '#6B7280' }}
                                    tickLine={false}
                                    axisLine={{ stroke: '#E5E7EB' }}
                                    domain={[0, 100]}
                                />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    tick={{ fontSize: 11, fill: '#6B7280' }}
                                    tickLine={false}
                                    axisLine={{ stroke: '#E5E7EB' }}
                                    domain={[0, 2400]}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'white',
                                        border: '1px solid #E5E7EB',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                                    }}
                                />

                                {activeMetrics.temp && (
                                    <Line
                                        yAxisId="left"
                                        type="stepAfter"
                                        dataKey="temp"
                                        name="Temperature"
                                        stroke={metricColors.temp}
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                    />
                                )}

                                {activeMetrics.humidity && (
                                    <Line
                                        yAxisId="left"
                                        type="stepAfter"
                                        dataKey="humidity"
                                        name="Humidity"
                                        stroke={metricColors.humidity}
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                    />
                                )}

                                {activeMetrics.battery && (
                                    <Line
                                        yAxisId="left"
                                        type="stepAfter"
                                        dataKey="battery"
                                        name="Battery"
                                        stroke={metricColors.battery}
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                    />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Task History Table */}
            <div style={styles.tableCard}>
                <div style={styles.tableHeader}>
                    <h2 style={styles.tableTitle}>Task History | Robots</h2>
                </div>

                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Task ID</th>
                            <th style={styles.th}>Task Name</th>
                            <th style={styles.th}>Robot ID</th>
                            <th style={styles.th}>Completion Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {robotData.length > 0 ? (
                            robotData.map((task, index) => (
                                <tr key={task.taskId}>
                                    <td style={styles.td}>{task.taskId}</td>
                                    <td style={styles.td}>{task.taskName}</td>
                                    <td style={styles.td}>{task.robotId}</td>
                                    <td style={styles.td}>
                                        <span style={{
                                            ...styles.statusBadge,
                                            ...getStatusStyle(task.status)
                                        }}>
                                            {task.status}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={4} style={{
                                    ...styles.td,
                                    textAlign: 'center',
                                    padding: '40px',
                                    color: '#9CA3AF'
                                }}>
                                    No robot data available - Fetching from HTTP (fleetMS/robots)
                                </td>
                            </tr>
                        )}
                        {/* Empty rows to match design */}
                        {robotData.length > 0 && [...Array(Math.max(0, 6 - robotData.length))].map((_, i) => (
                            <tr key={`empty-${i}`}>
                                <td style={styles.emptyRow}></td>
                                <td style={styles.emptyRow}></td>
                                <td style={styles.emptyRow}></td>
                                <td style={styles.emptyRow}></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default Analysis;
