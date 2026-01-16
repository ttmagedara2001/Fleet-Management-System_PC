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
        <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Device Settings Section */}
            <div
                style={{
                    background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
                    borderRadius: '24px',
                    padding: '24px 28px',
                    border: '1px solid #DDD6FE',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1F2937', margin: 0 }}>
                        Device Settings
                    </h2>

                    {/* System Control Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'white', padding: '8px 16px', borderRadius: '16px', border: '1px solid #E5E7EB' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#4B5563' }}>System Mode:</span>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#7C3AED' }}>{settings.systemMode}</span>
                        <button
                            onClick={() => updateDeviceSetting('systemMode', null, settings.systemMode === 'MANUAL' ? 'AUTOMATIC' : 'MANUAL')}
                            style={{
                                width: '48px',
                                height: '26px',
                                borderRadius: '13px',
                                border: 'none',
                                cursor: 'pointer',
                                position: 'relative',
                                background: settings.systemMode === 'AUTOMATIC' ? '#7C3AED' : '#D1D5DB',
                                transition: 'background 0.3s'
                            }}
                        >
                            <span style={{
                                position: 'absolute',
                                top: '3px',
                                left: settings.systemMode === 'AUTOMATIC' ? '25px' : '3px',
                                width: '20px',
                                height: '20px',
                                background: 'white',
                                borderRadius: '50%',
                                transition: 'left 0.3s'
                            }} />
                        </button>
                    </div>
                </div>

                {/* Expanded Threshold Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                    {[
                        { title: 'Temperature', current: currentValues.temperature != null ? `${currentValues.temperature.toFixed(1)}°C` : '-- °C', fields: [{ l: 'Min (°C)', k: 'min' }, { l: 'Max (°C)', k: 'max' }], key: 'temperature' },
                        { title: 'Humidity', current: currentValues.humidity != null ? `${currentValues.humidity.toFixed(1)}%` : '-- %', fields: [{ l: 'Min (%)', k: 'min' }, { l: 'Max (%)', k: 'max' }], key: 'humidity' },
                        { title: 'Pressure', current: currentValues.pressure != null ? `${currentValues.pressure} hPa` : '-- hPa', fields: [{ l: 'Min (hPa)', k: 'min' }, { l: 'Max (hPa)', k: 'max' }], key: 'pressure' },
                        { title: 'Battery', current: 'Per Robot', fields: [{ l: 'Min (%)', k: 'min' }], key: 'battery' }
                    ].map((card) => (
                        <div key={card.title} style={{ background: 'white', borderRadius: '16px', padding: '16px 18px', border: '1px solid #F3F4F6' }}>
                            <div style={{ borderBottom: '2px solid #7C3AED', paddingBottom: '8px', marginBottom: '12px' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1F2937', margin: 4 }}>{card.title}</h3>
                                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Current: <span style={{ color: '#7C3AED', fontWeight: '600' }}>{card.current}</span></p>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: card.fields.length > 1 ? '1fr 1fr' : '1fr', gap: '12px' }}>
                                {card.fields.map(f => (
                                    <div key={f.k}>
                                        <label style={{ fontSize: '11px', color: '#9CA3AF', display: 'block', marginBottom: '4px' }}>{f.l}</label>
                                        <input
                                            type="text"
                                            value={settings[card.key]?.[f.k] || ''}
                                            onChange={(e) => updateDeviceSetting(card.key, f.k, e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                background: '#F3F4F6',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontSize: '13px',
                                                fontWeight: '600'
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Save Message & Action */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {deviceSaveMessage && (
                        <div style={{ padding: '12px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }}>
                            <CheckCircle size={18} />
                            {deviceSaveMessage.text}
                        </div>
                    )}
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
                            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
                            transition: 'transform 0.2s'
                        }}
                    >
                        Save Device Settings
                    </button>
                </div>
            </div>

            {/* Robot Settings Section */}
            <div
                style={{
                    background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
                    borderRadius: '24px',
                    padding: '24px 28px',
                    border: '1px solid #DDD6FE',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1F2937', margin: 0 }}>
                        Robot Fleet Overview
                        <span style={{ fontSize: '14px', fontWeight: '400', color: '#6B7280', marginLeft: '12px' }}>
                            ({connectedRobots.length} Robots Online)
                        </span>
                    </h2>
                </div>

                {connectedRobots.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', background: 'rgba(255,255,255,0.4)', borderRadius: '16px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
                        <p style={{ fontSize: '16px', color: '#6B7280' }}>Waiting for robot data sync...</p>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(5, 1fr)',
                        gap: '12px',
                        marginBottom: '24px'
                    }}>
                        {connectedRobots.map((robot, index) => {
                            const robotId = robot.id;
                            const robotSettings = settings.robotSettings?.[robotId] || {};
                            const status = getRobotStatus(robot);
                            const robotNumber = robotId.match(/\d+/)?.[0] || String(index + 1).padStart(2, '0');
                            const displayId = `R-${robotNumber}`;

                            return (
                                <div
                                    key={robotId}
                                    style={{
                                        background: 'white',
                                        borderRadius: '16px',
                                        padding: '16px 14px',
                                        border: '1px solid #E5E7EB',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '10px',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6', paddingBottom: '8px' }}>
                                        <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1F2937' }}>{displayId}</h3>
                                        <div style={{
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '50%',
                                            background: status === 'online' ? '#22C55E' : status === 'warning' ? '#F59E0B' : '#EF4444',
                                            boxShadow: `0 0 8px ${status === 'online' ? 'rgba(34,197,94,0.4)' : 'transparent'}`
                                        }} />
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '12px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>Mission Task</label>
                                        <div style={{ position: 'relative' }}>
                                            <select
                                                value={robotSettings.task || ''}
                                                onChange={(e) => updateRobotSetting(robotId, 'task', e.target.value)}
                                                style={{ width: '100%', padding: '8px 32px 8px 12px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '12px', appearance: 'none', cursor: 'pointer' }}
                                            >
                                                {TASK_OPTIONS.map(opt => <option key={opt} value={opt === 'Select Task' ? '' : opt}>{opt}</option>)}
                                            </select>
                                            <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9CA3AF' }} />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '12px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>Initiate Location</label>
                                        <div style={{ position: 'relative' }}>
                                            <select
                                                value={robotSettings.source || ''}
                                                onChange={(e) => updateRobotSetting(robotId, 'source', e.target.value)}
                                                style={{ width: '100%', padding: '8px 32px 8px 12px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '12px', appearance: 'none', cursor: 'pointer' }}
                                            >
                                                {LOCATION_OPTIONS.map(opt => <option key={opt} value={opt === 'Select' ? '' : opt}>{opt}</option>)}
                                            </select>
                                            <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9CA3AF' }} />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '12px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>Destination</label>
                                        <div style={{ position: 'relative' }}>
                                            <select
                                                value={robotSettings.destination || ''}
                                                onChange={(e) => updateRobotSetting(robotId, 'destination', e.target.value)}
                                                style={{ width: '100%', padding: '8px 32px 8px 12px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '12px', appearance: 'none', cursor: 'pointer' }}
                                            >
                                                {LOCATION_OPTIONS.map(opt => <option key={opt} value={opt === 'Select' ? '' : opt}>{opt}</option>)}
                                            </select>
                                            <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9CA3AF' }} />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                                        {[
                                            { icon: <Battery size={12} />, label: 'Min%', key: 'batteryMin', def: '20' },
                                            { icon: <Thermometer size={12} />, label: 'Min°', key: 'tempMin', def: '20' },
                                            { icon: <Thermometer size={12} />, label: 'Max°', key: 'tempMax', def: '45' }
                                        ].map(stat => (
                                            <div key={stat.key} style={{ background: '#F3F4F6', borderRadius: '8px', padding: '6px 4px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '9px', color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>{stat.label}</div>
                                                <input
                                                    type="text"
                                                    value={robotSettings[stat.key] || stat.def}
                                                    onChange={(e) => updateRobotSetting(robotId, stat.key, e.target.value)}
                                                    style={{ width: '100%', textAlign: 'center', fontSize: '12px', fontWeight: '800', border: 'none', background: 'transparent', color: '#1F2937' }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Robot Fleet Save Message & Action */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {robotSaveMessage && (
                        <div style={{ padding: '12px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }}>
                            <CheckCircle size={18} />
                            {robotSaveMessage.text}
                        </div>
                    )}
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
                            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
                            transition: 'transform 0.2s'
                        }}
                    >
                        Save Robot Fleet Settings
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Settings;
