import React, { useState } from 'react';
import {
    Bot,
    Thermometer,
    Droplets,
    Gauge,
    AlertTriangle,
    CheckCircle,
    Battery,
    MapPin,
    Loader2
} from 'lucide-react';
import { useDevice } from '../contexts/DeviceContext';
import { toggleAC, setAirPurifier } from '../services/api';

// Fab Map Component
function FabMap() {
    const { currentRobots } = useDevice();
    const [selectedRobot, setSelectedRobot] = useState(null);

    const robots = Object.values(currentRobots || {});

    // Zone definitions
    const zones = [
        { id: 'cleanroom-a', name: 'Cleanroom A', left: '5%', top: '5%', width: '35%', height: '40%', type: 'cleanroom' },
        { id: 'cleanroom-b', name: 'Cleanroom B', left: '45%', top: '5%', width: '30%', height: '40%', type: 'cleanroom' },
        { id: 'loading', name: 'Loading Bay', left: '5%', top: '55%', width: '25%', height: '35%', type: 'loading' },
        { id: 'storage', name: 'Storage', left: '35%', top: '55%', width: '25%', height: '35%', type: 'storage' },
        { id: 'maintenance', name: 'Maintenance', left: '65%', top: '55%', width: '25%', height: '25%', type: 'storage' },
        { id: 'parking', name: 'Reset Position (Ready)', left: '65%', top: '82%', width: '25%', height: '10%', type: 'reset' },
    ];

    const getStatusColor = (robot) => {
        const state = robot?.status?.state?.toUpperCase();
        if (state === 'ERROR' || state === 'STOPPED') return '#EF4444';
        if (state === 'CHARGING') return '#F59E0B';
        if (state === 'ACTIVE' || state === 'MOVING') return '#22C55E';
        return '#9CA3AF'; // Gray for Ready/Idle
    };

    return (
        <div className="fab-map-container">
            <div className="fab-map">
                {/* Zones */}
                {zones.map(zone => (
                    <div
                        key={zone.id}
                        className={`fab-zone ${zone.type}`}
                        style={{
                            left: zone.left,
                            top: zone.top,
                            width: zone.width,
                            height: zone.height,
                        }}
                    >
                        {zone.name}
                    </div>
                ))}

                {/* Robot Markers */}
                {robots.map((robot, index) => {
                    // Check if robot has valid location data
                    const hasLocation = robot.location &&
                        robot.location.lat !== null &&
                        robot.location.lng !== null &&
                        (robot.location.lat !== 0 || robot.location.lng !== 0);

                    let x, y;
                    if (hasLocation) {
                        // Map normalized 0-1 coordinates directly to map percentage
                        // lng (0-1) -> x% (5% to 95% of map width)
                        // lat (0-1) -> y% (5% to 95% of map height)
                        x = 5 + (robot.location.lng * 90);  // 0 -> 5%, 1 -> 95%
                        y = 5 + (robot.location.lat * 90);  // 0 -> 5%, 1 -> 95%

                        console.log(`[Map] 📍 ${robot.id} at lat:${robot.location.lat}, lng:${robot.location.lng} -> x:${x.toFixed(1)}%, y:${y.toFixed(1)}%`);
                    } else {
                        // Spread robots across different functional zones by default
                        const defaultPositions = [
                            { x: 20, y: 25 }, // Cleanroom A
                            { x: 60, y: 25 }, // Cleanroom B
                            { x: 18, y: 72 }, // Loading Bay
                            { x: 48, y: 72 }, // Storage
                            { x: 78, y: 68 }  // Maintenance
                        ];
                        const pos = defaultPositions[index % defaultPositions.length];
                        x = pos.x;
                        y = pos.y;
                    }

                    return (
                        <div
                            key={robot.id}
                            className="robot-marker"
                            style={{ left: `${x}%`, top: `${y}%` }}
                            onClick={() => setSelectedRobot(selectedRobot?.id === robot.id ? null : robot)}
                        >
                            {robot.id.replace('R-', 'R')}
                            <div
                                className="status-dot"
                                style={{ background: getStatusColor(robot) }}
                            />
                        </div>
                    );
                })}

                {/* Robot Tooltip */}
                {selectedRobot && (
                    <div
                        className="robot-tooltip"
                        style={{
                            left: `${20 + (selectedRobot.location?.lng || 0) * 60}%`,
                            top: `${10 + (selectedRobot.location?.lat || 0) * 50}%`
                        }}
                    >
                        <h4>ROBOT {selectedRobot.id}</h4>
                        <div className="robot-tooltip-row">
                            <span className="label">LOC (LAT/LNG):</span>
                            <span className="value">
                                {selectedRobot.location?.lat?.toFixed(3) || '0.000'},
                                {selectedRobot.location?.lng?.toFixed(3) || '0.000'}
                            </span>
                        </div>
                        <div className="robot-tooltip-row">
                            <span className="label">STATUS:</span>
                            <span className="value" style={{ color: getStatusColor(selectedRobot) }}>
                                {selectedRobot.status?.state || 'READY'}
                            </span>
                        </div>
                        <div className="robot-tooltip-row">
                            <span className="label">BATTERY:</span>
                            <span className="value">{selectedRobot.status?.battery != null ? `${selectedRobot.status.battery}%` : '--'}</span>
                        </div>
                        <div className="robot-tooltip-row">
                            <span className="label">CURRENT TASK:</span>
                            <span className="value">{selectedRobot.task?.type || 'None'}</span>
                        </div>
                        {selectedRobot.task?.progress != null && (
                            <div className="robot-tooltip-row">
                                <span className="label">PROGRESS:</span>
                                <span className="value">{selectedRobot.task.progress}%</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Task Progress Overlay - Shows only when there are active tasks */}
                {robots.length > 0 && robots.some(r => r.task) && (
                    <div className="task-progress-overlay">
                        <div className="task-progress-label">Active Tasks:</div>
                        <div className="task-progress-value">{robots.filter(r => r.task).length}</div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Status Card Component
function StatusCard() {
    const { currentDeviceData, selectedDeviceId, isConnected } = useDevice();

    const env = currentDeviceData?.environment || {};

    return (
        <div className="status-card">
            <div className="status-card-header">
                <span className="status-card-title">{`{${selectedDeviceId}}`} STATUS</span>
                <span className={`status-badge ${isConnected ? 'online' : 'offline'}`}>
                    {isConnected ? 'ONLINE' : 'OFFLINE'}
                </span>
            </div>
            <div className="status-row">
                <span className="label">Env Temperature:</span>
                <span className="value">{env.ambient_temp != null ? `${Number(env.ambient_temp).toFixed(0)} C` : '-- C'}</span>
            </div>
            <div className="status-row">
                <span className="label">Humidity:</span>
                <span className="value">{env.ambient_hum != null ? `${Number(env.ambient_hum).toFixed(0)}%` : '--%'}</span>
            </div>
            <div className="status-row">
                <span className="label">Atmp. Pressure:</span>
                <span className="value">{env.atmospheric_pressure != null ? `${env.atmospheric_pressure} hPa` : '-- hPa'}</span>
            </div>
        </div>
    );
}

// Alerts Card Component
function AlertsCard() {
    const { alerts } = useDevice();

    const activeAlerts = alerts.slice(0, 3);

    return (
        <div className="alerts-card">
            <div className="alerts-header">
                <AlertTriangle size={20} className="text-red-500" />
                <span className="alerts-title">ACTIVE ALERTS</span>
            </div>

            {activeAlerts.length > 0 ? (
                activeAlerts.map(alert => (
                    <div key={alert.id} className={`alert-item ${alert.type}`}>
                        {alert.message}
                    </div>
                ))
            ) : (
                <div className="no-alerts">
                    <div className="no-alerts-icon">
                        <CheckCircle size={24} />
                    </div>
                    <p>No active alerts</p>
                    <p style={{ fontSize: '12px' }}>All systems operating normally</p>
                </div>
            )}
        </div>
    );
}

// Control Toggles Component
function ControlToggles() {
    const { currentDeviceData, selectedDeviceId } = useDevice();
    const state = currentDeviceData?.state || {};
    const [isLoading, setIsLoading] = useState({ ac: false, airPurifier: false });

    // Use WebSocket state or default to false
    const acEnabled = state.ac_power === 'ON' || state.ac_power === 'ACTIVE';
    const airPurifierEnabled = state.air_purifier === 'ON' || state.air_purifier === 'ACTIVE';

    // Handle AC toggle
    const handleACToggle = async () => {
        setIsLoading(prev => ({ ...prev, ac: true }));
        try {
            const newState = !acEnabled;
            console.log(`[Dashboard] 🔄 Toggling AC to ${newState ? 'ON' : 'OFF'} for device: ${selectedDeviceId}`);

            const result = await toggleAC(selectedDeviceId, newState);
            console.log('[Dashboard] ✅ AC toggle result:', result);

            // State will update via WebSocket
        } catch (error) {
            console.error('[Dashboard] ❌ Failed to toggle AC:', error);
            alert('Failed to toggle AC. Please try again.');
        } finally {
            setIsLoading(prev => ({ ...prev, ac: false }));
        }
    };

    // Handle Air Purifier toggle
    const handleAirPurifierToggle = async () => {
        setIsLoading(prev => ({ ...prev, airPurifier: true }));
        try {
            const newMode = airPurifierEnabled ? 'INACTIVE' : 'ACTIVE';
            console.log(`[Dashboard] 🔄 Setting Air Purifier to ${newMode} for device: ${selectedDeviceId}`);

            const result = await setAirPurifier(selectedDeviceId, newMode);
            console.log('[Dashboard] ✅ Air purifier result:', result);

            // State will update via WebSocket
        } catch (error) {
            console.error('[Dashboard] ❌ Failed to toggle Air Purifier:', error);
            alert('Failed to toggle Air Purifier. Please try again.');
        } finally {
            setIsLoading(prev => ({ ...prev, airPurifier: false }));
        }
    };

    return (
        <div className="controls-section">
            <div className="control-card">
                <div className="control-label">AIR CONDITION (AC):</div>
                <div className="control-toggle">
                    <span className="toggle-label manual">{state.ac_power || 'UNKNOWN'}</span>
                    {isLoading.ac ? (
                        <Loader2 size={20} className="animate-spin" style={{ color: '#7C3AED' }} />
                    ) : (
                        <div
                            className={`toggle-switch ${acEnabled ? 'active' : ''}`}
                            onClick={handleACToggle}
                            style={{ cursor: 'pointer' }}
                            title="Click to toggle AC"
                        />
                    )}
                </div>
            </div>
            <div className="control-card">
                <div className="control-label">AIR PURIFIER:</div>
                <div className="control-toggle">
                    <span className="toggle-label manual">{state.air_purifier || 'UNKNOWN'}</span>
                    {isLoading.airPurifier ? (
                        <Loader2 size={20} className="animate-spin" style={{ color: '#7C3AED' }} />
                    ) : (
                        <div
                            className={`toggle-switch ${airPurifierEnabled ? 'active' : ''}`}
                            onClick={handleAirPurifierToggle}
                            style={{ cursor: 'pointer' }}
                            title="Click to toggle Air Purifier"
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

// Robot Details Section
function RobotDetails() {
    const { currentRobots } = useDevice();
    const robots = Object.values(currentRobots || {});

    const getStatusClass = (robot) => {
        const battery = robot.status?.battery;
        if (!battery || robot.status?.state === 'OFFLINE') return 'offline';
        if (battery < 30) return 'warning';
        return 'online';
    };

    const getTempClass = (temp) => {
        if (temp == null) return '';
        if (temp > 32) return 'critical'; // Match DEFAULT_THRESHOLDS.temperature.critical
        if (temp > 28) return 'warning';  // Match DEFAULT_THRESHOLDS.temperature.max
        return 'normal';
    };

    if (robots.length === 0) {
        return (
            <div className="robot-details-section">
                <div className="robot-details-header">
                    <h2 className="robot-details-title">Robot details</h2>
                </div>
                <div className="no-robots-message" style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
                    <Bot size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                    <p>No robots discovered yet</p>
                    <p style={{ fontSize: '12px', marginTop: '8px' }}>Waiting for robot data from WebSocket...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="robot-details-section">
            <div className="robot-details-header">
                <h2 className="robot-details-title">Robot details</h2>
                <span className="robot-details-count">{robots.length} robot(s) connected</span>
            </div>

            <div className="robot-cards-grid">
                {robots.map(robot => (
                    <div key={robot.id} className="robot-card">
                        <div className={`robot-card-status ${getStatusClass(robot)}`} />
                        <div className="robot-card-id">
                            {robot.id.replace('robot-', 'R-')}
                        </div>
                        <div className="robot-card-icon">
                            <Bot size={32} />
                        </div>
                        <div className="robot-card-task">
                            TASK: {robot.task?.task || robot.task?.type || '--'}
                        </div>
                        <div className="robot-card-stats">
                            <div className={`robot-stat ${robot.status?.battery && robot.status.battery < 30 ? 'text-red-500' : 'battery'}`}>
                                <Battery size={14} />
                                {robot.status?.battery ? `${robot.status.battery}%` : '--'}
                            </div>
                            <div className={`robot-stat temp ${getTempClass(robot.environment?.temp)}`}>
                                <Thermometer size={14} />
                                {robot.environment?.temp ? `${robot.environment.temp} C` : '--'}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Main Dashboard Component
function Dashboard() {
    return (
        <div className="dashboard-content">
            <div className="dashboard-grid">
                {/* Left Column - Map */}
                <div className="map-column">
                    <FabMap />
                </div>

                {/* Right Column - Status & Alerts */}
                <div className="side-column">
                    <StatusCard />
                    <AlertsCard />
                    <ControlToggles />
                </div>
            </div>

            <div className="bottom-section">
                <RobotDetails />
            </div>
        </div>
    );
}

export default Dashboard;
