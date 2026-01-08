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
import { getAllStreamData, getTimeRange } from '../services/api';

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
    const [activeMetrics, setActiveMetrics] = useState({
        temp: true,
        humidity: true,
        battery: true
    });

    // Fetch data from API
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        console.log(`[Analysis] 📊 Fetching data for device: ${selectedDeviceId}, range: ${timeRange}`);

        try {
            const { startTime, endTime } = getTimeRange(timeRange);
            
            const response = await getAllStreamData(
                selectedDeviceId,
                startTime,
                endTime,
                0,
                500
            );

            if (response.status === 'Success' && response.data && response.data.length > 0) {
                // Transform API data for chart
                const transformed = response.data.map(record => ({
                    time: new Date(record.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true 
                    }),
                    fullTime: record.timestamp,
                    temp: record.temperature ?? null,
                    humidity: record.humidity ?? null,
                    battery: record.battery ?? null,
                    pressure: record.pressure ?? null
                }));

                setChartData(transformed);
                setDataSource('api');
                console.log(`[Analysis] ✅ Loaded ${transformed.length} data points from API`);
            } else {
                // No data from API - show empty state
                console.log('[Analysis] ℹ️ No data available from API');
                setChartData([]);
                setDataSource('empty');
            }
        } catch (err) {
            console.error('[Analysis] ❌ API error:', err);
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
    }, [fetchData]);

    // Generate task history from current robots
    const taskHistory = useMemo(() => generateTaskHistory(currentRobots), [currentRobots]);

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

    const handleFetchData = async () => {
        await fetchData();
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
                            <button 
                                style={{
                                    ...styles.filterPill,
                                    background: dataSource === 'api' ? '#D1FAE5' : (dataSource === 'empty' || dataSource === 'error') ? '#FEE2E2' : '#F3F4F6',
                                    borderColor: dataSource === 'api' ? '#10B981' : (dataSource === 'empty' || dataSource === 'error') ? '#EF4444' : '#E5E7EB',
                                    color: dataSource === 'api' ? '#065F46' : (dataSource === 'empty' || dataSource === 'error') ? '#991B1B' : '#6B7280'
                                }}
                            >
                                <Globe size={12} />
                                {dataSource === 'api' ? 'HTTP API' : dataSource === 'loading' ? 'Loading...' : 'No Data'}
                            </button>
                            <button
                                style={{
                                    ...styles.filterPill,
                                    cursor: isLoading ? 'not-allowed' : 'pointer'
                                }}
                                onClick={handleFetchData}
                                disabled={isLoading}
                            >
                                <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                                {isLoading ? 'Loading...' : 'Refresh'}
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
                            <button
                                style={{
                                    marginTop: '16px',
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    border: '1px solid #7C3AED',
                                    background: '#7C3AED',
                                    color: 'white',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                                onClick={handleFetchData}
                            >
                                <RefreshCw size={14} />
                                Try Again
                            </button>
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
                        {taskHistory.length > 0 ? (
                            taskHistory.map((task, index) => (
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
                                    No active tasks - Waiting for robot data from WebSocket
                                </td>
                            </tr>
                        )}
                        {/* Empty rows to match design */}
                        {taskHistory.length > 0 && [...Array(Math.max(0, 6 - taskHistory.length))].map((_, i) => (
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
