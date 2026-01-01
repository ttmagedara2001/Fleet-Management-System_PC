import React, { useState } from 'react';
import {
    Bot,
    Thermometer,
    Droplets,
    Gauge,
    AlertTriangle,
    CheckCircle,
    Battery,
    MapPin
} from 'lucide-react';
import { useDevice } from '../contexts/DeviceContext';
import { useStomp } from '../contexts/StompContext';

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
        { id: 'maintenance', name: 'Maintenance', left: '65%', top: '55%', width: '25%', height: '35%', type: 'storage' },
    ];

    const getStatusColor = (robot) => {
        const state = robot?.status?.state;
        if (state === 'ERROR' || state === 'STOPPED') return '#EF4444';
        if (state === 'CHARGING') return '#F59E0B';
        return '#22C55E';
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
                {robots.map(robot => {
                    const x = 15 + (robot.location?.lng || 0) * 70;
                    const y = 15 + (robot.location?.lat || 0) * 70;

                    return (
                        <div
                            key={robot.id}
                            className="robot-marker"
                            style={{ left: `${x}%`, top: `${y}%` }}
                            onClick={() => setSelectedRobot(selectedRobot?.id === robot.id ? null : robot)}
                        >
                            {robot.id.replace('robot-', 'R')}
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
                        <h4>ROBOT {selectedRobot.id.replace('robot-', 'R-')}</h4>
                        <div className="robot-tooltip-row">
                            <span className="label">ZONE:</span>
                            <span className="value">Lithography (Device 00)</span>
                        </div>
                        <div className="robot-tooltip-row">
                            <span className="label">STATUS:</span>
                            <span className="value" style={{ color: getStatusColor(selectedRobot) }}>
                                {selectedRobot.status?.state || 'Online'}
                            </span>
                        </div>
                        <div className="robot-tooltip-row">
                            <span className="label">CURRENT TASK:</span>
                            <span className="value">{selectedRobot.task?.type || 'RETICLE_SWAP'}</span>
                        </div>
                        <div className="robot-tooltip-row">
                            <span className="label">TASK PROGRESS:</span>
                            <span className="value">{selectedRobot.task?.progress || 82}%</span>
                        </div>
                    </div>
                )}

                {/* Task Progress Overlay */}
                <div className="task-progress-overlay">
                    <div className="task-progress-label">Task Progress:</div>
                    <div className="task-progress-value">62 %</div>
                </div>
            </div>
        </div>
    );
}

// Status Card Component
function StatusCard() {
    const { currentDeviceData, selectedDeviceId } = useDevice();
    const { isConnected } = useStomp();

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
                <span className="value">{env.ambient_temp?.toFixed(0) || 24} C</span>
            </div>
            <div className="status-row">
                <span className="label">Humidity:</span>
                <span className="value">{env.ambient_hum?.toFixed(0) || 40}%</span>
            </div>
            <div className="status-row">
                <span className="label">Atmp. Pressure:</span>
                <span className="value">{env.atmospheric_pressure || 28} bar</span>
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
    const [acEnabled, setAcEnabled] = useState(true);
    const [airPurifierEnabled, setAirPurifierEnabled] = useState(true);

    return (
        <div className="controls-section">
            <div className="control-card">
                <div className="control-label">AIR CONDITION (AC):</div>
                <div className="control-toggle">
                    <span className="toggle-label manual">MANUAL</span>
                    <div
                        className={`toggle-switch ${acEnabled ? 'active' : ''}`}
                        onClick={() => setAcEnabled(!acEnabled)}
                    />
                </div>
            </div>
            <div className="control-card">
                <div className="control-label">AIR PURIFIRE:</div>
                <div className="control-toggle">
                    <span className="toggle-label manual">MANUAL</span>
                    <div
                        className={`toggle-switch ${airPurifierEnabled ? 'active' : ''}`}
                        onClick={() => setAirPurifierEnabled(!airPurifierEnabled)}
                    />
                </div>
            </div>
        </div>
    );
}

// Robot Details Section
function RobotDetails() {
    const { currentRobots } = useDevice();
    const robots = Object.values(currentRobots || {});

    // Add some demo robots if none exist
    const displayRobots = robots.length > 0 ? robots : [
        { id: 'robot-01', status: { battery: 76, state: 'ACTIVE' }, environment: { temp: 24 }, task: { type: 'hqdiqdsih0ho' } },
        { id: 'robot-02', status: { battery: 76, state: 'ACTIVE' }, environment: { temp: 24 }, task: { type: 'hqdiqdsih0ho' } },
        { id: 'robot-03', status: { battery: 76, state: 'ACTIVE' }, environment: { temp: 24 }, task: { type: 'hqdiqdsih0ho' } },
        { id: 'robot-04', status: { battery: 22, state: 'WARNING' }, environment: { temp: 24 }, task: { type: 'hqdiqdsih0ho' } },
        { id: 'robot-05', status: { battery: 18, state: 'WARNING' }, environment: { temp: 24 }, task: { type: 'hqdiqdsih0ho' } },
        { id: 'robot-06', status: { battery: null, state: 'OFFLINE' }, environment: { temp: null }, task: null },
    ];

    const getStatusClass = (robot) => {
        const battery = robot.status?.battery;
        if (!battery || robot.status?.state === 'OFFLINE') return 'offline';
        if (battery < 30) return 'warning';
        return 'online';
    };

    return (
        <div className="robot-details-section">
            <div className="robot-details-header">
                <h2 className="robot-details-title">Robot details</h2>
                <a href="#" className="robot-details-link">Read more.</a>
            </div>

            <div className="robot-cards-grid">
                {displayRobots.map(robot => (
                    <div key={robot.id} className="robot-card">
                        <div className={`robot-card-status ${getStatusClass(robot)}`} />
                        <div className="robot-card-id">
                            {robot.id.replace('robot-', 'R-')}
                        </div>
                        <div className="robot-card-icon">
                            <Bot size={32} />
                        </div>
                        <div className="robot-card-task">
                            TASK: {robot.task?.type || '--'}
                        </div>
                        <div className="robot-card-stats">
                            <div className={`robot-stat ${robot.status?.battery && robot.status.battery < 30 ? 'text-red-500' : 'battery'}`}>
                                <Battery size={14} />
                                {robot.status?.battery ? `${robot.status.battery}%` : '--'}
                            </div>
                            <div className="robot-stat temp">
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
        <div>
            <div className="dashboard-grid">
                {/* Left Column - Map */}
                <div>
                    <FabMap />
                </div>

                {/* Right Column - Status & Alerts */}
                <div>
                    <StatusCard />
                    <AlertsCard />
                    <ControlToggles />
                </div>
            </div>

            {/* Bottom - Robot Details */}
            <RobotDetails />
        </div>
    );
}

export default Dashboard;
