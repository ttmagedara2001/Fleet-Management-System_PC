/**
 * @module RobotFleetPanel
 * @description Displays the robot fleet grid with per-robot health cards.
 * Each card shows battery level, temperature, load, position, task phase,
 * connection status, and collision alerts in real time.
 */
import { useState, useEffect } from 'react';
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
    Loader2,
    ShieldAlert
} from 'lucide-react';
import { useDevice } from '../../contexts/DeviceContext';
import { PHASE_LABELS, PHASE_COLORS } from '../../utils/telemetryMath';
import {
    getRobotTempStatus,
    getBatteryStatus,
    computeRobotHealthFromSettings
} from '../../utils/thresholds';

function RobotCard({ robot }) {
    // compute robot health from battery percentage using user-defined thresholds
    const batteryValue = robot.status?.battery ?? robot.status?.battery_pct ?? robot.battery_pct ?? robot.battery;
    const health = computeRobotHealthFromSettings(batteryValue);


    const getTempStatus = () => {
        const temp = robot.environment?.temp;
        return getRobotTempStatus(temp);
    };

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
            case 'BLOCKED':
                return <ShieldAlert size={14} className="text-orange-500 animate-pulse" />;
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
            case 'BLOCKED':
                return 'border-orange-500 bg-orange-50';
            default:
                return 'border-gray-300 bg-white';
        }
    };

    const batteryStatus = health.status;
    const tempStatus = getTempStatus();

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

            {/* Collision / Blocked Banner */}
            {robot.status?.state === 'BLOCKED' && (
                <div className="flex items-center gap-2 px-2 py-1.5 mb-1 rounded-lg bg-orange-100 border border-orange-300">
                    <ShieldAlert size={14} className="text-orange-600 shrink-0 animate-pulse" />
                    <span className="text-xs font-semibold text-orange-700">
                        Collision risk — Movement paused
                        {robot.status?.blockedBy?.length > 0 && (
                            <span className="font-normal text-orange-600"> (near {robot.status.blockedBy.join(', ')})</span>
                        )}
                    </span>
                </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-0.5 md:gap-1">
                {/* Battery */}
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                        <Battery size={14} className="text-primary-600" />
                        <span className="text-xs text-gray-500">Battery</span>
                        <span style={getDotStyle(batteryStatus)} title={`Battery: ${health.label}`} />
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
                    <p className="text-sm font-semibold" style={tempStatus === 'critical' ? { color: '#DC2626' } : tempStatus === 'warning' ? { color: '#D97706' } : { color: '#16A34A' }}>
                        {robot.environment?.temp != null ? (robot.environment.temp.toFixed(1)) : '--'}°C
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

            {/* Task Status */}
            {robot.task && (
                <div className="mt-0.5 pt-0.5 md:mt-1 md:pt-1 border-t border-gray-100"
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', width: '100%' }}>
                    {/* Status indicator */}
                    {(() => {
                        const phase = robot.task.phase || 'ASSIGNED';
                        const isCompleted = phase === 'COMPLETED';
                        const isFailed = phase === 'FAILED';

                        if (isCompleted) {
                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                    <CheckCircle size={20} style={{ color: '#059669' }} />
                                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#059669' }}>
                                        Completed
                                    </span>
                                </div>
                            );
                        }
                        if (isFailed) {
                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                    <AlertTriangle size={20} style={{ color: '#DC2626' }} />
                                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#DC2626' }}>
                                        Failed
                                    </span>
                                </div>
                            );
                        }

                        const phaseStyle = PHASE_COLORS[phase] || { bg: '#E0E7FF', color: '#4F46E5' };
                        const label = PHASE_LABELS[phase] || phase;
                        return (
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 10px',
                                borderRadius: '12px',
                                fontSize: '10px',
                                fontWeight: '700',
                                background: phaseStyle.bg,
                                color: phaseStyle.color
                            }}>
                                {label}
                            </span>
                        );
                    })()}
                    {(robot.task['initiate location'] || robot.task.source) && robot.task.destination && (
                        <span className="text-gray-500 text-xs" style={{ marginTop: '4px' }}>
                            {robot.task['initiate location'] || robot.task.source} → {robot.task.destination}
                        </span>
                    )}
                    <span className="text-gray-400" style={{ fontSize: '8px', marginTop: '2px' }}>
                        {robot.task.task_id || robot.task.taskId || ''}
                    </span>
                </div>
            )}
        </div>
    );
}

function RobotFleetPanel() {
    const { currentRobots, fetchRobotTasks } = useDevice();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const robots = Object.values(currentRobots || {});

    // Fetch robot tasks on initial mount to ensure task data is loaded on refresh
    useEffect(() => {
        if (fetchRobotTasks) {
            fetchRobotTasks();
        }
    }, [fetchRobotTasks]);

    // Handle manual refresh
    const handleRefresh = async () => {
        if (!fetchRobotTasks) return;
        setIsRefreshing(true);
        try {
            await fetchRobotTasks();
        } catch (err) {
            console.error('[RobotFleetPanel] Failed to refresh robot tasks:', err);
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
