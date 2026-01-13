import React, { useState } from 'react';
import {
    Thermometer,
    Battery,
    CheckCircle,
    ChevronDown
} from 'lucide-react';
import { useDevice } from '../contexts/DeviceContext';

// Default thresholds
const DEFAULT_SETTINGS = {
    temperature: { min: 20, max: 40 },
    humidity: { min: 20, max: 70 },
    pressure: { min: 10, max: 40 },
    battery: { min: 20 },
    systemMode: 'MANUAL',
    robotSettings: {}
};

// Load settings from localStorage
const loadSettings = () => {
    try {
        const saved = localStorage.getItem('fabrix_settings');
        if (saved) {
            const parsed = JSON.parse(saved);
            return { ...DEFAULT_SETTINGS, ...parsed };
        }
    } catch (error) {
        console.error('[Settings] ❌ Failed to load settings:', error);
    }
    return DEFAULT_SETTINGS;
};

// Save settings to localStorage
const saveSettingsToStorage = (settings) => {
    try {
        localStorage.setItem('fabrix_settings', JSON.stringify(settings));
        return true;
    } catch (error) {
        console.error('[Settings] ❌ Failed to save settings:', error);
        return false;
    }
};

// Options
const TASK_OPTIONS = ['Select Task', 'MOVE_FOUP', 'PICKUP', 'DELIVERY', 'RETURN_HOME', 'CHARGE'];
const LOCATION_OPTIONS = ['Select', 'Cleanroom A', 'Cleanroom B', 'Loading Bay', 'Storage', 'Maintenance'];

function Settings() {
    const { currentRobots, currentDeviceData } = useDevice();

    // Get current values from WebSocket data (no mock data)
    const currentValues = {
        temperature: currentDeviceData?.environment?.ambient_temp,
        humidity: currentDeviceData?.environment?.ambient_hum,
        pressure: currentDeviceData?.environment?.atmospheric_pressure,
        battery: null // Battery is per-robot, not device-level
    };

    const [settings, setSettings] = useState(loadSettings);
    const [deviceSaveMessage, setDeviceSaveMessage] = useState(null);
    const [robotSaveMessage, setRobotSaveMessage] = useState(null);

    // Get connected robots list from WebSocket
    const connectedRobots = Object.values(currentRobots || {});

    const updateDeviceSetting = (category, field, value) => {
        setSettings(prev => ({
            ...prev,
            [category]: field
                ? { ...prev[category], [field]: Number(value) || value }
                : value
        }));
        setDeviceSaveMessage(null);
    };

    const updateRobotSetting = (robotId, field, value) => {
        setSettings(prev => ({
            ...prev,
            robotSettings: {
                ...prev.robotSettings,
                [robotId]: {
                    ...prev.robotSettings?.[robotId],
                    [field]: value
                }
            }
        }));
        setRobotSaveMessage(null);
    };

    const handleSaveDeviceSettings = () => {
        const success = saveSettingsToStorage(settings);
        if (success) {
            setDeviceSaveMessage({ type: 'success', text: 'Device settings saved successfully!' });
            setTimeout(() => setDeviceSaveMessage(null), 5000);
        }
    };

    const handleSaveRobotSettings = () => {
        const success = saveSettingsToStorage(settings);
        if (success) {
            setRobotSaveMessage({ type: 'success', text: 'Robot settings saved successfully!' });
            setTimeout(() => setRobotSaveMessage(null), 5000);
        }
    };

    // Get robot status from WebSocket payload
    // Payload format: {"robot-status": "online"} or {"robot-status": "offline"}
    const getRobotStatus = (robot) => {
        // Check for robot-status field (from WebSocket payload)
        const robotStatus = robot?.['robot-status'] || robot?.robotStatus;
        if (robotStatus === 'online') return 'online';
        if (robotStatus === 'offline') return 'offline';

        // Fallback to legacy status field
        const state = robot?.status?.state || robot?.status;
        if (state === 'Active' || state === 'online' || state === 'ACTIVE') return 'online';
        if (state === 'ERROR' || state === 'STOPPED' || state === 'offline') return 'offline';
        if (state === 'CHARGING' || state === 'IDLE' || state === 'Idle') return 'warning';

        // Default to offline (red) if status is unknown
        return 'offline';
    };

    return (
        <div style={{ padding: '24px 32px' }}>
            {/* Device Settings Section */}
            <div
                style={{
                    background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
                    borderRadius: '24px',
                    padding: '24px 28px',
                    marginBottom: '24px'
                }}
            >
                <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1F2937', marginBottom: '20px' }}>
                    Device Settings
                </h2>

                {/* Threshold Cards - 4 columns */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                    {/* Temperature */}
                    <div style={{ background: 'white', borderRadius: '16px', padding: '16px 18px' }}>
                        <h3 style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#1F2937',
                            paddingBottom: '8px',
                            marginBottom: '8px',
                            borderBottom: '2px solid #7C3AED'
                        }}>
                            Temperature
                        </h3>
                        <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '12px' }}>
                            Current Temperature: <span style={{ color: '#7C3AED', fontWeight: '600' }}>{currentValues.temperature != null ? `${currentValues.temperature.toFixed(1)}°C` : '-- °C'}</span>
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                                <label style={{ fontSize: '11px', color: '#9CA3AF', display: 'block', marginBottom: '4px' }}>Min (°C)</label>
                                <input
                                    type="text"
                                    value={settings.temperature?.min || 20}
                                    onChange={(e) => updateDeviceSetting('temperature', 'min', e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        background: '#F3F4F6',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: '500'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '11px', color: '#9CA3AF', display: 'block', marginBottom: '4px' }}>Max (°C)</label>
                                <input
                                    type="text"
                                    value={settings.temperature?.max || 40}
                                    onChange={(e) => updateDeviceSetting('temperature', 'max', e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        background: '#F3F4F6',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: '500'
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Humidity */}
                    <div style={{ background: 'white', borderRadius: '16px', padding: '16px 18px' }}>
                        <h3 style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#1F2937',
                            paddingBottom: '8px',
                            marginBottom: '8px',
                            borderBottom: '2px solid #7C3AED'
                        }}>
                            Humidity
                        </h3>
                        <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '12px' }}>
                            Current Humidity: <span style={{ color: '#7C3AED', fontWeight: '600' }}>{currentValues.humidity != null ? `${currentValues.humidity.toFixed(1)}%` : '-- %'}</span>
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                                <label style={{ fontSize: '11px', color: '#9CA3AF', display: 'block', marginBottom: '4px' }}>Min (%)</label>
                                <input
                                    type="text"
                                    value={settings.humidity?.min || 20}
                                    onChange={(e) => updateDeviceSetting('humidity', 'min', e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        background: '#F3F4F6',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: '500'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '11px', color: '#9CA3AF', display: 'block', marginBottom: '4px' }}>Max (%)</label>
                                <input
                                    type="text"
                                    value={settings.humidity?.max || 70}
                                    onChange={(e) => updateDeviceSetting('humidity', 'max', e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        background: '#F3F4F6',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: '500'
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Pressure */}
                    <div style={{ background: 'white', borderRadius: '16px', padding: '16px 18px' }}>
                        <h3 style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#1F2937',
                            paddingBottom: '8px',
                            marginBottom: '8px',
                            borderBottom: '2px solid #7C3AED'
                        }}>
                            Pressure
                        </h3>
                        <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '12px' }}>
                            Current Pressure: <span style={{ color: '#7C3AED', fontWeight: '600' }}>{currentValues.pressure != null ? `${currentValues.pressure} hPa` : '-- hPa'}</span>
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                                <label style={{ fontSize: '11px', color: '#9CA3AF', display: 'block', marginBottom: '4px' }}>Min (bar)</label>
                                <input
                                    type="text"
                                    value={settings.pressure?.min || 10}
                                    onChange={(e) => updateDeviceSetting('pressure', 'min', e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        background: '#F3F4F6',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: '500'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '11px', color: '#9CA3AF', display: 'block', marginBottom: '4px' }}>Max (bar)</label>
                                <input
                                    type="text"
                                    value={settings.pressure?.max || 40}
                                    onChange={(e) => updateDeviceSetting('pressure', 'max', e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        background: '#F3F4F6',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: '500'
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Battery */}
                    <div style={{ background: 'white', borderRadius: '16px', padding: '16px 18px' }}>
                        <h3 style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#1F2937',
                            paddingBottom: '8px',
                            marginBottom: '8px',
                            borderBottom: '2px solid #7C3AED'
                        }}>
                            Battery
                        </h3>
                        <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '12px' }}>
                            Battery Threshold: <span style={{ color: '#7C3AED', fontWeight: '600' }}>Per Robot</span>
                        </p>
                        <div>
                            <label style={{ fontSize: '11px', color: '#9CA3AF', display: 'block', marginBottom: '4px' }}>Min (%)</label>
                            <input
                                type="text"
                                value={settings.battery?.min || 20}
                                onChange={(e) => updateDeviceSetting('battery', 'min', e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: '#F3F4F6',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: '500'
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* System Control */}
                <div style={{ background: 'white', borderRadius: '16px', padding: '16px 20px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#1F2937' }}>System Control :</span>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#7C3AED' }}>{settings.systemMode}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '13px', color: '#6B7280' }}>Turn on for Automatic Mode:</span>
                        <button
                            onClick={() => updateDeviceSetting('systemMode', null, settings.systemMode === 'MANUAL' ? 'AUTOMATIC' : 'MANUAL')}
                            style={{
                                width: '52px',
                                height: '28px',
                                borderRadius: '14px',
                                border: 'none',
                                cursor: 'pointer',
                                position: 'relative',
                                background: settings.systemMode === 'AUTOMATIC' ? '#7C3AED' : '#D1D5DB',
                                transition: 'background 0.3s'
                            }}
                        >
                            <span style={{
                                position: 'absolute',
                                top: '4px',
                                left: settings.systemMode === 'AUTOMATIC' ? '28px' : '4px',
                                width: '20px',
                                height: '20px',
                                background: 'white',
                                borderRadius: '50%',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                transition: 'left 0.3s'
                            }} />
                        </button>
                    </div>
                </div>

                {/* Save Message */}
                {deviceSaveMessage && (
                    <div style={{
                        marginBottom: '16px',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: '#F0FDF4',
                        color: '#15803D',
                        border: '1px solid #BBF7D0'
                    }}>
                        <CheckCircle size={18} />
                        {deviceSaveMessage.text}
                    </div>
                )}

                {/* Save Device Settings Button */}
                <button
                    onClick={handleSaveDeviceSettings}
                    style={{
                        width: '100%',
                        padding: '14px 24px',
                        background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50px',
                        fontSize: '15px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(124, 58, 237, 0.35)'
                    }}
                >
                    Save Device Settings
                </button>
            </div>

            {/* Robot Settings Section */}
            <div
                style={{
                    background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
                    borderRadius: '24px',
                    padding: '24px 28px'
                }}
            >
                <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1F2937', marginBottom: '20px' }}>
                    Robot Settings
                    <span style={{ fontSize: '14px', fontWeight: '400', color: '#6B7280', marginLeft: '12px' }}>
                        ({connectedRobots.length} robot{connectedRobots.length !== 1 ? 's' : ''} connected)
                    </span>
                </h2>

                {/* No Robots Connected Message */}
                {connectedRobots.length === 0 ? (
                    <div style={{
                        background: 'rgba(237, 233, 254, 0.6)',
                        borderRadius: '16px',
                        padding: '40px 20px',
                        textAlign: 'center',
                        border: '1px solid #DDD6FE',
                        marginBottom: '20px'
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>
                            No Robots Connected
                        </h3>
                        <p style={{ fontSize: '14px', color: '#6B7280' }}>
                            Robots will appear here once they connect via WebSocket.
                            <br />
                            The green indicator shows connection status.
                        </p>
                    </div>
                ) : (
                    /* Robot Cards - Dynamic grid based on connected robots */
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${Math.min(connectedRobots.length, 3)}, 1fr)`,
                        gap: '16px',
                        marginBottom: '20px'
                    }}>
                        {connectedRobots.map((robot, index) => {
                            const robotId = robot.id;
                            const robotSettings = settings.robotSettings?.[robotId] || {};
                            const status = getRobotStatus(robot);
                            // Extract robot number from ID or use index
                            const robotNumber = robotId.match(/\d+/)?.[0] || String(index + 1).padStart(2, '0');
                            const displayId = `R-${robotNumber}`;

                            return (
                                <div
                                    key={robotId}
                                    style={{
                                        background: 'rgba(237, 233, 254, 0.6)',
                                        borderRadius: '16px',
                                        padding: '16px 18px',
                                        border: '1px solid #DDD6FE'
                                    }}
                                >
                                    {/* Robot Header */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                                        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1F2937' }}>{displayId}</h3>
                                        <div style={{
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '50%',
                                            background: status === 'online' ? '#22C55E' : status === 'warning' ? '#F59E0B' : '#EF4444',
                                            boxShadow: `0 0 8px ${status === 'online' ? '#22C55E' : status === 'warning' ? '#F59E0B' : '#EF4444'}`
                                        }} />
                                    </div>

                                    {/* Task */}
                                    <div style={{ marginBottom: '10px' }}>
                                        <label style={{ fontSize: '13px', color: '#4B5563', display: 'block', marginBottom: '4px' }}>Task:</label>
                                        <div style={{ position: 'relative' }}>
                                            <select
                                                value={robotSettings.task || ''}
                                                onChange={(e) => updateRobotSetting(robotId, 'task', e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '8px 32px 8px 12px',
                                                    background: 'white',
                                                    border: '1px solid #E5E7EB',
                                                    borderRadius: '8px',
                                                    fontSize: '13px',
                                                    appearance: 'none',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {TASK_OPTIONS.map(opt => (
                                                    <option key={opt} value={opt === 'Select Task' ? '' : opt}>{opt}</option>
                                                ))}
                                            </select>
                                            <ChevronDown size={16} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                                        </div>
                                    </div>

                                    {/* Initiate Location */}
                                    <div style={{ marginBottom: '10px' }}>
                                        <label style={{ fontSize: '13px', color: '#4B5563', display: 'block', marginBottom: '4px' }}>Initiate Location :</label>
                                        <div style={{ position: 'relative' }}>
                                            <select
                                                value={robotSettings.source || ''}
                                                onChange={(e) => updateRobotSetting(robotId, 'source', e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '8px 32px 8px 12px',
                                                    background: 'white',
                                                    border: '1px solid #E5E7EB',
                                                    borderRadius: '8px',
                                                    fontSize: '13px',
                                                    appearance: 'none',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {LOCATION_OPTIONS.map(opt => (
                                                    <option key={opt} value={opt === 'Select' ? '' : opt}>{opt}</option>
                                                ))}
                                            </select>
                                            <ChevronDown size={16} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                                        </div>
                                    </div>

                                    {/* Destination */}
                                    <div style={{ marginBottom: '14px' }}>
                                        <label style={{ fontSize: '13px', color: '#4B5563', display: 'block', marginBottom: '4px' }}>Destination:</label>
                                        <div style={{ position: 'relative' }}>
                                            <select
                                                value={robotSettings.destination || ''}
                                                onChange={(e) => updateRobotSetting(robotId, 'destination', e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '8px 32px 8px 12px',
                                                    background: 'white',
                                                    border: '1px solid #E5E7EB',
                                                    borderRadius: '8px',
                                                    fontSize: '13px',
                                                    appearance: 'none',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {LOCATION_OPTIONS.map(opt => (
                                                    <option key={opt} value={opt === 'Select' ? '' : opt}>{opt}</option>
                                                ))}
                                            </select>
                                            <ChevronDown size={16} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                                        </div>
                                    </div>

                                    {/* Threshold Inputs */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                        <div style={{ background: 'white', borderRadius: '10px', padding: '10px 8px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
                                                <Battery size={12} style={{ color: '#6B7280' }} />
                                                <span style={{ fontSize: '10px', color: '#6B7280' }}>Min (%)</span>
                                            </div>
                                            <input
                                                type="text"
                                                value={robotSettings.batteryMin || '20'}
                                                onChange={(e) => updateRobotSetting(robotId, 'batteryMin', e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    textAlign: 'center',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: '#374151'
                                                }}
                                            />
                                        </div>
                                        <div style={{ background: 'white', borderRadius: '10px', padding: '10px 8px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
                                                <Thermometer size={12} style={{ color: '#6B7280' }} />
                                                <span style={{ fontSize: '10px', color: '#6B7280' }}>Min (°C)</span>
                                            </div>
                                            <input
                                                type="text"
                                                value={robotSettings.tempMin || '20'}
                                                onChange={(e) => updateRobotSetting(robotId, 'tempMin', e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    textAlign: 'center',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: '#374151'
                                                }}
                                            />
                                        </div>
                                        <div style={{ background: 'white', borderRadius: '10px', padding: '10px 8px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
                                                <Thermometer size={12} style={{ color: '#6B7280' }} />
                                                <span style={{ fontSize: '10px', color: '#6B7280' }}>Max (°C)</span>
                                            </div>
                                            <input
                                                type="text"
                                                value={robotSettings.tempMax || '45'}
                                                onChange={(e) => updateRobotSetting(robotId, 'tempMax', e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    textAlign: 'center',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: '#374151'
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Save Message */}
                {robotSaveMessage && (
                    <div style={{
                        marginBottom: '16px',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: '#F0FDF4',
                        color: '#15803D',
                        border: '1px solid #BBF7D0'
                    }}>
                        <CheckCircle size={18} />
                        {robotSaveMessage.text}
                    </div>
                )}

                {/* Save Robot Settings Button */}
                <button
                    onClick={handleSaveRobotSettings}
                    style={{
                        width: '100%',
                        padding: '14px 24px',
                        background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50px',
                        fontSize: '15px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(124, 58, 237, 0.35)'
                    }}
                >
                    Save Robot Settings
                </button>
            </div>
        </div>
    );
}

export default Settings;
