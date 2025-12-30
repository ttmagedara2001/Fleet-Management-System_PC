import React, { useState, useCallback } from 'react';
import {
    Calendar,
    Download,
    RefreshCw,
    Filter,
    TrendingUp,
    Thermometer,
    Droplets,
    Battery,
    Loader2
} from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    Legend
} from 'recharts';
import { useDevice } from '../contexts/DeviceContext';
import { useApi } from '../hooks/useApi';

// Mock historical data for display
const generateMockData = (hours = 24, metric = 'temp') => {
    const data = [];
    const now = new Date();

    for (let i = hours; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 60 * 60 * 1000);
        const baseValue = metric === 'temp' ? 22 : metric === 'humidity' ? 45 : 75;
        const variance = Math.sin(i / 4) * 2 + (Math.random() - 0.5) * 3;

        data.push({
            time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: date.toLocaleDateString(),
            value: +(baseValue + variance).toFixed(1),
            threshold: metric === 'temp' ? 28 : metric === 'humidity' ? 60 : 20
        });
    }

    return data;
};

function DateRangePicker({ startDate, endDate, onStartChange, onEndChange }) {
    return (
        <div className="flex items-center gap-2">
            <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => onStartChange(e.target.value)}
                    className="input pl-9 pr-4 py-2 text-sm"
                />
            </div>
            <span className="text-gray-400">to</span>
            <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => onEndChange(e.target.value)}
                    className="input pl-9 pr-4 py-2 text-sm"
                />
            </div>
        </div>
    );
}

function ChartCard({ title, icon: Icon, data, dataKey = 'value', color = '#9333ea', unit = '' }) {
    return (
        <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Icon size={18} className="text-purple-600" />
                    <h4 className="font-semibold text-gray-900">{title}</h4>
                </div>
                <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        Current
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full border-2 border-red-500" />
                        Threshold
                    </span>
                </div>
            </div>

            <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            dataKey="time"
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            tickLine={false}
                            axisLine={{ stroke: '#e5e7eb' }}
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            tickLine={false}
                            axisLine={{ stroke: '#e5e7eb' }}
                            unit={unit}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                            }}
                            formatter={(value) => [`${value}${unit}`, title]}
                        />
                        <Area
                            type="monotone"
                            dataKey={dataKey}
                            stroke={color}
                            strokeWidth={2}
                            fill={`url(#gradient-${title})`}
                        />
                        <Line
                            type="monotone"
                            dataKey="threshold"
                            stroke="#ef4444"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function DataTable({ data, columns }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-gray-200">
                        {columns.map(col => (
                            <th key={col.key} className="text-left py-3 px-4 font-semibold text-gray-700">
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, i) => (
                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                            {columns.map(col => (
                                <td key={col.key} className="py-3 px-4 text-gray-600">
                                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Analysis() {
    const { selectedDeviceId, devices } = useDevice();
    const { getDeviceStreamData, getTopicStreamData } = useApi();

    const [isLoading, setIsLoading] = useState(false);
    const [selectedMetric, setSelectedMetric] = useState('temperature');
    const [timeRange, setTimeRange] = useState('24h');
    const [startDate, setStartDate] = useState(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );
    const [endDate, setEndDate] = useState(
        new Date().toISOString().split('T')[0]
    );
    const [streamData, setStreamData] = useState(null);

    // Generate mock data based on metric
    const chartData = generateMockData(24, selectedMetric === 'temperature' ? 'temp' : selectedMetric);

    const fetchHistoricalData = useCallback(async () => {
        setIsLoading(true);
        console.log('[Analysis] 📊 Fetching historical data...');

        try {
            const data = await getDeviceStreamData(
                selectedDeviceId,
                `${startDate}T00:00:00Z`,
                `${endDate}T23:59:59Z`,
                0,
                100
            );

            console.log('[Analysis] ✅ Data received:', data);
            setStreamData(data);
        } catch (error) {
            console.error('[Analysis] ❌ Failed to fetch data:', error);
        } finally {
            setIsLoading(false);
        }
    }, [selectedDeviceId, startDate, endDate, getDeviceStreamData]);

    const metrics = [
        { id: 'temperature', label: 'Temperature', icon: Thermometer, unit: '°C', color: '#ef4444' },
        { id: 'humidity', label: 'Humidity', icon: Droplets, unit: '%', color: '#3b82f6' },
        { id: 'battery', label: 'Battery', icon: Battery, unit: '%', color: '#22c55e' },
    ];

    const timeRanges = [
        { id: '1h', label: '1 Hour' },
        { id: '6h', label: '6 Hours' },
        { id: '24h', label: '24 Hours' },
        { id: '7d', label: '7 Days' },
        { id: 'custom', label: 'Custom' },
    ];

    // Mock table data
    const tableData = chartData.slice(0, 10).map((d, i) => ({
        timestamp: `${d.date} ${d.time}`,
        temperature: (22 + Math.random() * 3).toFixed(1),
        humidity: (45 + Math.random() * 5).toFixed(1),
        pressure: (1013 + Math.random() * 5).toFixed(0),
        status: i % 5 === 0 ? 'Warning' : 'Normal'
    }));

    const tableColumns = [
        { key: 'timestamp', label: 'Timestamp' },
        { key: 'temperature', label: 'Temp (°C)' },
        { key: 'humidity', label: 'Humidity (%)' },
        { key: 'pressure', label: 'Pressure (hPa)' },
        {
            key: 'status',
            label: 'Status',
            render: (value) => (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${value === 'Normal' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                    {value}
                </span>
            )
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Historical Analysis</h2>
                    <p className="text-sm text-gray-500">
                        View and analyze historical data for{' '}
                        <span className="text-purple-600 font-medium">{selectedDeviceId}</span>
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchHistoricalData}
                        disabled={isLoading}
                        className="btn btn-primary"
                    >
                        {isLoading ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <RefreshCw size={16} />
                        )}
                        Fetch Data
                    </button>
                    <button className="btn btn-secondary">
                        <Download size={16} />
                        Export
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card p-4">
                <div className="flex flex-wrap items-center gap-4">
                    {/* Metric Selector */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Metric</label>
                        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                            {metrics.map(metric => {
                                const Icon = metric.icon;
                                return (
                                    <button
                                        key={metric.id}
                                        onClick={() => setSelectedMetric(metric.id)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${selectedMetric === metric.id
                                                ? 'bg-white text-purple-700 shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'
                                            }`}
                                    >
                                        <Icon size={14} />
                                        {metric.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Time Range */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Time Range</label>
                        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                            {timeRanges.map(range => (
                                <button
                                    key={range.id}
                                    onClick={() => setTimeRange(range.id)}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${timeRange === range.id
                                            ? 'bg-white text-purple-700 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    {range.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom Date Range */}
                    {timeRange === 'custom' && (
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Date Range</label>
                            <DateRangePicker
                                startDate={startDate}
                                endDate={endDate}
                                onStartChange={setStartDate}
                                onEndChange={setEndDate}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard
                    title="Temperature"
                    icon={Thermometer}
                    data={generateMockData(24, 'temp')}
                    color="#ef4444"
                    unit="°C"
                />
                <ChartCard
                    title="Humidity"
                    icon={Droplets}
                    data={generateMockData(24, 'humidity')}
                    color="#3b82f6"
                    unit="%"
                />
            </div>

            {/* Combined Chart */}
            <div className="card p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <TrendingUp size={18} className="text-purple-600" />
                        <h4 className="font-semibold text-gray-900">Environment Overview</h4>
                    </div>
                </div>

                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                                dataKey="time"
                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                tickLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px'
                                }}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="value"
                                name="Temperature"
                                stroke="#9333ea"
                                strokeWidth={2}
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Data Table */}
            <div className="card">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">Raw Data</h4>
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-gray-400" />
                        <span className="text-sm text-gray-500">Showing latest 10 records</span>
                    </div>
                </div>
                <DataTable data={tableData} columns={tableColumns} />
            </div>
        </div>
    );
}

export default Analysis;
