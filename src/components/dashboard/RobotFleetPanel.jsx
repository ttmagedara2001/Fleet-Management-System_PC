import React from 'react';
import {
    Battery,
    Thermometer,
    Package,
    Navigation,
    AlertTriangle,
    CheckCircle,
    Clock,
    Zap,
    RefreshCw,
    Loader2
} from 'lucide-react';
import { useDevice } from '../../contexts/DeviceContext';
import { computeRobotHealth, computeTaskCompletion } from '../../utils/telemetryMath';

function RobotCard({ robot }) {
    // compute robot health from battery percentage
    const batteryValue = robot.status?.battery ?? robot.status?.battery_pct ?? robot.battery_pct ?? robot.battery;
    const health = computeRobotHealth(batteryValue);


    const getTempStatus = () => {
        const userTemp = getUserTempOverride(robot.id);
        const temp = userTemp ?? robot.environment?.temp;
        const thresholds = getThresholdsLocal();
        if (temp == null) return 'normal';
        // Treat values above critical OR below min as critical (show red)
        if (temp > thresholds.temperature.critical) return 'critical';
        if (temp < thresholds.temperature.min) return 'critical';
        if (temp > thresholds.temperature.max) return 'warning';
        return 'normal';
    };

    // Read per-robot temp override from saved settings in localStorage (if user provided)
    function getUserTempOverride(robotId) {
        try {
            const saved = localStorage.getItem('fabrix_settings');
            if (!saved) return null;
            const parsed = JSON.parse(saved);
            const robotSettings = parsed.robotSettings || {};
            const cfg = robotSettings[robotId] || {};
            // Support several possible keys used by the settings UI
            const v = cfg.temp ?? cfg.tempOverride ?? cfg.tempCurrent ?? cfg.tempMin ?? null;
            if (v == null || v === '') return null;
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
        } catch (e) {
            return null;
        }
    }

    // Read thresholds from localStorage saved settings or fallback to defaults
    function getThresholdsLocal() {
        try {
            const saved = localStorage.getItem('fabrix_settings');
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed.thresholds || { temperature: { min: 18, max: 28, critical: 32 } };
            }
        } catch (e) {
            // ignore
        }
        return { temperature: { min: 18, max: 28, critical: 32 } };
    }

    const getStateIcon = () => {
        const state = robot.status?.state;
        switch (state) {
            case 'MOVING':
            case 'ACTIVE':
                return <Navigation size={14} className="text-green-500 animate-pulse" />;
            case 'CHARGING':
                return <Zap size={14} className="text-green-500" />;
            case 'IDLE':
                return <Clock size={14} className="text-gray-400" />;
            case 'ERROR':
                return <AlertTriangle size={14} className="text-red-500" />;
            default:
                return <CheckCircle size={14} className="text-gray-400" />;
        }
    };

    const getStateColor = () => {
        const state = robot.status?.state;
        switch (state) {
            case 'MOVING':
            case 'ACTIVE':
                return 'border-green-500 bg-green-50';
            case 'CHARGING':
                return 'border-green-500 bg-green-50';
            case 'ERROR':
                return 'border-red-500 bg-red-50';
            default:
                return 'border-gray-300 bg-white';
        }
    };

    const batteryStatus = health.label.toLowerCase();
    const tempStatus = getTempStatus();

    // Map battery label to severity used by UI ('normal'|'warning'|'critical')
    const mapBatteryToSeverity = (label) => {
        if (!label) return 'normal';
        const l = String(label).toLowerCase();
        if (l === 'good') return 'normal';
        if (l === 'fair' || l === 'low') return 'warning';
        if (l === 'critical') return 'critical';
        return 'normal';
    };

    const batterySeverity = mapBatteryToSeverity(batteryStatus);

    const getDotStyle = (severity) => {
        switch (severity) {
            // Only red or green: non-critical -> green, critical -> red
            case 'critical': return { width: 10, height: 10, borderRadius: 6, background: '#DC2626' };
            default: return { width: 10, height: 10, borderRadius: 6, background: '#16A34A' };
        }
    };

    // Determine whether the robot is actively receiving sensor/stream data (fresh lastUpdate)
    const isReceivingData = (() => {
        const last = robot.lastUpdate || 0;
        if (!last) return false;
        const ageMs = Date.now() - last;
        return ageMs < 3000; // treat as receiving if updated within last 3s
    })();

    // Connection indicator now depends ONLY on recent data receipt: green when receiving, red otherwise
    const getConnectionColor = () => (isReceivingData ? '#16A34A' : '#DC2626');

    const getBatteryTextStyle = (status) => {
        if (!status) return { color: '#111827' };
        if (status === 'critical') return { color: '#DC2626' };
        // Non-critical states use green
        return { color: '#16A34A' };
    };

    return (
        <div className={`card p-0.5 md:p-1 border-l-4 ${getStateColor()}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-0.5 md:mb-1">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 md:w-6 md:h-6 gradient-primary rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-xs">
                            {robot.id.split('-')[1] || robot.id.substring(0, 2)}
                        </span>
                    </div>

                    <div>
                        <h4 className="font-semibold text-primary-700 text-sm">{robot.id}</h4>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                            {getStateIcon()}
                            <span>{robot.status?.state || 'Unknown'}</span>
                        </div>
                    </div>
                </div>

                {/* Right-corner connection bulb: depends ONLY on stream data freshness */}
                <div
                    role="status"
                    aria-label={isReceivingData ? 'Receiving data' : 'No recent data'}
                    data-conn={isReceivingData ? 'true' : 'false'}
                    style={{
                        width: 10,
                        height: 10,
                        borderRadius: 6,
                        backgroundColor: getConnectionColor(),
                        boxShadow: `0 0 6px ${getConnectionColor()}33`,
                        border: '1px solid rgba(0,0,0,0.05)',
                        flex: '0 0 auto'
                    }}
                    title={
                        `Connectivity: ${isReceivingData ? 'Receiving' : 'Not receiving'} | ` +
                        (robot.lastUpdate ? `Last update: ${new Date(robot.lastUpdate).toLocaleTimeString()} | ` : '') +
                        `Temp status: ${tempStatus} | Battery: ${batteryStatus}`
                    }
                />

                {/* Alert indicator (keeps showing when battery/temp not normal) */}
                {(batteryStatus !== 'normal' || tempStatus !== 'normal') && (
                    <AlertTriangle
                        size={18}
                        className={`${batteryStatus === 'critical' || tempStatus === 'critical' ? 'text-red-500 animate-pulse' : 'text-primary-600'}`}
                    />
                )}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-0.5 md:gap-1">
                {/* Battery */}
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                        <Battery size={14} className="text-primary-600" />
                        <span className="text-xs text-gray-500">Battery</span>
                        <span style={getDotStyle(batterySeverity)} title={`Battery: ${health.label}`} />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 progress-bar">
                            <div
                                className={`progress-bar-fill ${batteryStatus}`}
                                style={{ width: `${health.pct}%` }}
                            />
                        </div>
                        <div className="w-10 text-right">
                            <div className="text-sm font-semibold" style={getBatteryTextStyle(batteryStatus)}>{health.pct}%</div>
                            <div className="text-xs" style={getBatteryTextStyle(batteryStatus)}>{health.label}</div>
                        </div>
                    </div>
                </div>

                {/* Temperature */}
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                        <Thermometer size={14} className="text-primary-600" />
                        <span className="text-xs text-gray-500">Temp</span>
                        <span style={getDotStyle(tempStatus)} title={`Temp status: ${tempStatus}`} />
                    </div>
                    <p className="text-sm font-semibold" style={tempStatus === 'critical' ? { color: '#DC2626' } : { color: '#16A34A' }}>
                        {(getUserTempOverride(robot.id) ?? robot.environment?.temp) != null ? ((getUserTempOverride(robot.id) ?? robot.environment?.temp).toFixed(1)) : '--'}°C
                    </p>
                </div>

                {/* Load Status */}
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                        <Package size={14} className="text-primary-600" />
                        <span className="text-xs text-gray-500">Load</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                        {robot.status?.load || 'None'}
                    </p>
                </div>

                {/* Position */}
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                        <Navigation size={14} className="text-primary-600" />
                        <span className="text-xs text-gray-500">Position</span>
                    </div>
                    <p className="text-xs font-medium text-gray-700">
                        {robot.location?.lat?.toFixed(4) || '--'}, {robot.location?.lng?.toFixed(4) || '--'}
                    </p>
                </div>
            </div>

            {/* Task Progress */}
            {robot.task && (
                <div className="mt-0.5 pt-0.5 md:mt-1 md:pt-1 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-500">Current Task</span>
                        <div className="flex items-center gap-2">
                            {/* Task Status Badge */}
                            {(() => {
                                const status = (robot.task.status || robot.task.state || '').toLowerCase();
                                let bgColor, textColor, label;

                                if (status === 'assigned' || status === 'allocated') {
                                    bgColor = '#E0E7FF';
                                    textColor = '#4F46E5';
                                    label = '📋 Assigned';
                                } else if (status === 'completed') {
                                    bgColor = '#D1FAE5';
                                    textColor = '#059669';
                                    label = '✓ Completed';
                                } else if (status === 'in progress' || status === 'in_progress' || status === 'active' || status === 'moving') {
                                    bgColor = '#DBEAFE';
                                    textColor = '#2563EB';
                                    label = '⟳ In Progress';
                                } else if (status === 'pending' || status === 'queued' || status === 'scheduled') {
                                    bgColor = '#FEF3C7';
                                    textColor = '#D97706';
                                    label = '◷ Pending';
                                } else if (status === 'error' || status === 'failed') {
                                    bgColor = '#FEE2E2';
                                    textColor = '#DC2626';
                                    label = '✕ Failed';
                                } else if (robot.task.task || robot.task.type) {
                                    // Has task but no recognized status - show as assigned
                                    bgColor = '#E0E7FF';
                                    textColor = '#4F46E5';
                                    label = '📋 Assigned';
                                } else {
                                    return null;
                                }

                                return (
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        padding: '2px 6px',
                                        borderRadius: '10px',
                                        fontSize: '9px',
                                        fontWeight: '700',
                                        background: bgColor,
                                        color: textColor
                                    }}>
                                        {label}
                                    </span>
                                );
                            })()}
                            <span className="text-primary-600 font-medium">{robot.task.task || robot.task.type || 'Task'}</span>
                        </div>
                    </div>
                    <div className="progress-bar">
                        <div
                            className="progress-bar-fill normal"
                            style={{ width: `${computeTaskCompletion(robot.task)}%` }}
                        />
                    </div>
                    {robot.task.source && robot.task.destination && (
                        <p className="text-xs text-gray-500 mt-1">
                            {robot.task.source} → {robot.task.destination}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

function RobotFleetPanel() {
    const { currentRobots, fetchRobotTasks } = useDevice();
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const robots = Object.values(currentRobots || {});

    // Fetch robot tasks on initial mount to ensure task data is loaded on refresh
    React.useEffect(() => {
        if (fetchRobotTasks) {
            console.log('[RobotFleetPanel] 🔄 Fetching robot tasks on mount');
            fetchRobotTasks();
        }
    }, [fetchRobotTasks]);

    // Handle manual refresh
    const handleRefresh = async () => {
        if (!fetchRobotTasks) return;
        setIsRefreshing(true);
        try {
            await fetchRobotTasks();
            console.log('[RobotFleetPanel] 🔄 Robot tasks refreshed');
        } catch (err) {
            console.error('[RobotFleetPanel] ❌ Failed to refresh robot tasks:', err);
        } finally {
            setIsRefreshing(false);
        }
    };

    const stats = {
        total: robots.length,
        active: robots.filter(r => r.status?.state === 'MOVING' || r.status?.state === 'ACTIVE').length,
        charging: robots.filter(r => r.status?.state === 'CHARGING').length,
        error: robots.filter(r => r.status?.state === 'ERROR').length
    };

    return (
        <div className="space-y-1 md:space-y-2">
            {/* Header with Stats */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">Robot Fleet</h3>
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        title="Refresh robot tasks"
                    >
                        {isRefreshing ? (
                            <Loader2 size={14} className="animate-spin text-primary-600" />
                        ) : (
                            <RefreshCw size={14} className="text-gray-500 hover:text-primary-600" />
                        )}
                    </button>
                </div>
                <div className="flex items-center gap-3">
                    <span className="bg-accent-gold-light text-primary-700 rounded-full px-3 py-1 text-xs font-medium">{robots.length} robot(s) connected</span>
                    <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            Active: {stats.active}
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            Charging: {stats.charging}
                        </span>
                        {stats.error > 0 && (
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                Error: {stats.error}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Robot Cards Grid */}
            {robots.length > 0 ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-1 md:gap-2">
                    {robots.map(robot => (
                        <RobotCard key={robot.id} robot={robot} />
                    ))}
                </div>
            ) : (
                <div className="card p-1 md:p-3 text-center">
                    <div className="w-12 h-12 mx-auto mb-2 bg-gray-100 rounded-full flex items-center justify-center">
                        <Package size={24} className="text-gray-400" />
                    </div>
                    <p className="text-gray-500 text-sm">No robots discovered yet</p>
                    <p className="text-gray-400 text-xs mt-1">Waiting for robot registration...</p>
                </div>
            )}
        </div>
    );
}

export default RobotFleetPanel;
