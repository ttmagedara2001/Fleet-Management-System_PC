import React from 'react';
import {
    Battery,
    Thermometer,
    Package,
    Navigation,
    AlertTriangle,
    CheckCircle,
    Clock,
    Zap
} from 'lucide-react';
import { useDevice } from '../../contexts/DeviceContext';
import { computeRobotHealth, computeTaskCompletion } from '../../utils/telemetryMath';

function RobotCard({ robot }) {
    // compute robot health from battery percentage
    const batteryValue = robot.status?.battery ?? robot.status?.battery_pct ?? robot.battery_pct ?? robot.battery;
    const health = computeRobotHealth(batteryValue);


    const getTempStatus = () => {
        const temp = robot.environment?.temp;
        if (!temp) return 'normal';
        if (temp > 40) return 'critical';
        if (temp > 35) return 'warning';
        return 'normal';
    };

    const getStateIcon = () => {
        const state = robot.status?.state;
        switch (state) {
            case 'MOVING':
            case 'ACTIVE':
                return <Navigation size={14} className="text-green-500 animate-pulse" />;
            case 'CHARGING':
                return <Zap size={14} className="text-amber-500" />;
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
                return 'border-amber-500 bg-amber-50';
            case 'ERROR':
                return 'border-red-500 bg-red-50';
            default:
                return 'border-gray-300 bg-white';
        }
    };

    const batteryStatus = health.label.toLowerCase();
    const tempStatus = getTempStatus();

    const getBatteryTextStyle = (status) => {
        if (!status) return { color: '#111827' };
        if (status === 'critical') return { color: '#DC2626' };
        if (status === 'warning') return { color: '#D97706' };
        return { color: '#16A34A' };
    };

    return (
        <div className={`card p-4 border-l-4 ${getStateColor()}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-xs">
                            {robot.id.split('-')[1] || robot.id.substring(0, 2)}
                        </span>
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-900 text-sm">{robot.id}</h4>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                            {getStateIcon()}
                            <span>{robot.status?.state || 'Unknown'}</span>
                        </div>
                    </div>
                </div>

                {/* Alert indicator */}
                {(batteryStatus !== 'normal' || tempStatus !== 'normal') && (
                    <AlertTriangle
                        size={18}
                        className={`${batteryStatus === 'critical' || tempStatus === 'critical' ? 'text-red-500 animate-pulse' : 'text-amber-500'}`}
                    />
                )}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
                {/* Battery */}
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                        <Battery
                            size={14}
                            className={`${batteryStatus === 'normal' ? 'text-green-500' :
                                    batteryStatus === 'warning' ? 'text-amber-500' : 'text-red-500'
                                }`}
                        />
                        <span className="text-xs text-gray-500">Battery</span>
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
                        <Thermometer
                            size={14}
                            className={`${tempStatus === 'normal' ? 'text-blue-500' :
                                    tempStatus === 'warning' ? 'text-amber-500' : 'text-red-500'
                                }`}
                        />
                        <span className="text-xs text-gray-500">Temp</span>
                    </div>
                    <p className="text-sm font-semibold" style={tempStatus === 'critical' ? { color: '#DC2626' } : tempStatus === 'warning' ? { color: '#D97706' } : { color: '#16A34A' }}>
                        {robot.environment?.temp?.toFixed(1) || '--'}°C
                    </p>
                </div>

                {/* Load Status */}
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                        <Package size={14} className="text-purple-500" />
                        <span className="text-xs text-gray-500">Load</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                        {robot.status?.load || 'None'}
                    </p>
                </div>

                {/* Position */}
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                        <Navigation size={14} className="text-purple-500" />
                        <span className="text-xs text-gray-500">Position</span>
                    </div>
                    <p className="text-xs font-medium text-gray-700">
                        {robot.location?.lat?.toFixed(4) || '--'}, {robot.location?.lng?.toFixed(4) || '--'}
                    </p>
                </div>
            </div>

            {/* Task Progress */}
            {robot.task && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-gray-500">Current Task</span>
                        <span className="text-purple-600 font-medium">{robot.task.type || 'In Progress'}</span>
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
    const { currentRobots } = useDevice();

    const robots = Object.values(currentRobots || {});

    const stats = {
        total: robots.length,
        active: robots.filter(r => r.status?.state === 'MOVING' || r.status?.state === 'ACTIVE').length,
        charging: robots.filter(r => r.status?.state === 'CHARGING').length,
        error: robots.filter(r => r.status?.state === 'ERROR').length
    };

    return (
        <div className="space-y-4">
            {/* Header with Stats */}
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Robot Fleet</h3>
                <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        Active: {stats.active}
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
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

            {/* Robot Cards Grid */}
            {robots.length > 0 ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {robots.map(robot => (
                        <RobotCard key={robot.id} robot={robot} />
                    ))}
                </div>
            ) : (
                <div className="card p-8 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
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
