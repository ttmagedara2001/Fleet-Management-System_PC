import React, { useState, useEffect } from 'react';
import {
    Thermometer,
    Battery,
    CheckCircle,
    ChevronDown
} from 'lucide-react';
import { useDevice } from '../contexts/DeviceContext';
import { updateStateDetails } from '../services/api';

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
            // Deep merge to ensure new keys in DEFAULT are present
            return {
                ...DEFAULT_SETTINGS,
                ...parsed,
                robotSettings: { ...DEFAULT_SETTINGS.robotSettings, ...parsed.robotSettings }
            };
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
    // 1. Context Access
    // Ensure selectedDeviceId is available from context for API calls
    const { currentRobots, currentDeviceData, updateRobotTaskLocal, selectedDeviceId, refreshDeviceState } = useDevice();

    // 2. Local State
    const [settings, setSettings] = useState(loadSettings());
    const [deviceSaveMessage, setDeviceSaveMessage] = useState(null);
    const [robotSaveMessage, setRobotSaveMessage] = useState(null);

    // 3. Derived Data
    // Safely extract current environment values from streaming device data
    const currentValues = (currentDeviceData && currentDeviceData.environment) || {};
    // `currentRobots` is an object map in context — coerce to array for UI iteration
    const connectedRobots = Array.isArray(currentRobots) ? currentRobots : Object.values(currentRobots || {});

    // Helper: normalize environment metric keys (supports different payload shapes)
    const getMetricValue = (key) => {
        const env = currentValues || {};
        if (key === 'temperature') return env.temperature ?? env.ambient_temp ?? env.temp ?? env.ambientTemp ?? null;
        if (key === 'humidity') return env.humidity ?? env.ambient_hum ?? env.hum ?? env.ambientHum ?? null;
        if (key === 'pressure') return env.pressure ?? env.atmospheric_pressure ?? env.atm_pressure ?? env.atmosphericPressure ?? null;
        return null;
    };

    // Status helpers (match logic used in DeviceEnvironmentPanel)
    const getTemperatureStatus = (temp) => {
        if (temp == null) return 'normal';
        if (temp > 28) return 'critical';
        if (temp > 25) return 'warning';
        return 'normal';
    };

    const getHumidityStatus = (hum) => {
        if (hum == null) return 'normal';
        if (hum > 60 || hum < 30) return 'critical';
        if (hum > 55 || hum < 35) return 'warning';
        return 'normal';
    };

    const getPressureStatus = (p) => {
        if (p == null) return 'normal';
        if (p < 980 || p > 1050) return 'critical';
        if (p < 990 || p > 1040) return 'warning';
        return 'normal';
    };

    const getValueColorStyle = (status) => {
        switch (status) {
            case 'warning': return { color: '#D97706' };
            case 'critical': return { color: '#DC2626' };
            default: return { color: '#16A34A' };
        }
    };
    // 4. Handlers

    // Update Device/System Settings (Nested updates)
    const updateDeviceSetting = (category, key, value) => {
        setSettings(prev => {
            // Handle System Mode (Root level)
            if (key === null) {
                return { ...prev, [category]: value };
            }
            // Handle Nested Settings (e.g., temperature.min)
            return {
                ...prev,
                [category]: {
                    ...prev[category],
                    [key]: value
                }
            };
        });
    };

    // Update Robot Configuration
    const updateRobotSetting = (robotId, key, value) => {
        setSettings(prev => ({
            ...prev,
            robotSettings: {
                ...prev.robotSettings,
                [robotId]: {
                    ...(prev.robotSettings[robotId] || {}),
                    [key]: value
                }
            }
        }));
    };

    // Save Device Settings (Local + API for System Mode)
    const handleSaveDeviceSettings = async () => {
        saveSettingsToStorage(settings);

        // If System Mode changed, sync it to the cloud
        if (settings.systemMode && selectedDeviceId) {
            try {
                // Topic suffix for system mode
                const topic = 'settings/systemMode';
                const payload = { mode: settings.systemMode };
                await updateStateDetails(selectedDeviceId, topic, payload);
            } catch (err) {
                console.error("Failed to sync system mode", err);
            }
        }

        setDeviceSaveMessage({ type: 'success', text: 'Device settings saved!' });
        setTimeout(() => setDeviceSaveMessage(null), 3000);
    };

    // Save Robot Fleet Settings (API Sync)
    const handleSaveRobotSettings = async () => {
        // Save to local storage first
        saveSettingsToStorage(settings);

        if (!selectedDeviceId) {
            setRobotSaveMessage({ type: 'error', text: 'No device selected for sync.' });
            return;
        }

        try {
            // Send updates to API for each configured robot
            const updates = Object.entries(settings.robotSettings || {}).map(async ([robotId, config]) => {
                // Only send if a task is selected
                if (!config.task || config.task === 'Select Task') return;

                // Topic: fleetMS/robots/<RobotID>/task
                // Note: According to docs, topic should be a suffix. 
                // Adjusting based on your snippet's format.
                const topic = `fleetMS/robots/${robotId}/task`;

                // Payload structure
                const payload = {
                    "robotId": robotId,
                    "task": config.task,
                    "initiate location": config.source || "Unknown",
                    "destination": config.destination || "Unknown"
                };

                // Optimistic update in context
                if (updateRobotTaskLocal) {
                    updateRobotTaskLocal(robotId, payload);
                }

                console.log(`[Settings] 🚀 Sending task update for ${robotId}:`, payload);
                
                // Call API Service
                return updateStateDetails(selectedDeviceId, topic, payload);
            });

            await Promise.all(updates);
            setRobotSaveMessage({ type: 'success', text: 'Robot fleet settings saved & synced!' });
        } catch (error) {
            console.error('[Settings] ❌ Failed to sync robot settings:', error);
            setRobotSaveMessage({ type: 'error', text: 'Saved locally, but failed to sync online.' });
        }

        setTimeout(() => setRobotSaveMessage(null), 5000);
    };

    // Helper: Get robot status
    const getRobotStatus = (robot) => {
        const robotStatus = robot?.['robot-status'] || robot?.robotStatus;
        if (robotStatus === 'online') return 'online';
        if (robotStatus === 'offline') return 'offline';

        const state = robot?.status?.state || robot?.status;
        if (state === 'Active' || state === 'online' || state === 'ACTIVE') return 'online';
        if (state === 'ERROR' || state === 'STOPPED' || state === 'offline') return 'offline';
        if (state === 'CHARGING' || state === 'IDLE' || state === 'Idle') return 'warning';

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
                            onClick={async () => {
                                // Optimistic UI update and send control request
                                const prevMode = settings.systemMode;
                                const newMode = prevMode === 'MANUAL' ? 'AUTOMATIC' : 'MANUAL';
                                // Optimistically update local UI
                                updateDeviceSetting('systemMode', null, newMode);

                                if (!selectedDeviceId) {
                                    setDeviceSaveMessage({ type: 'error', text: 'No device selected' });
                                    setTimeout(() => setDeviceSaveMessage(null), 3000);
                                    return;
                                }

                                try {
                                    // Send update to device topic 'fleetMS/mode'
                                    await updateStateDetails(selectedDeviceId, 'fleetMS/mode', { mode: newMode });

                                    // After updating, refresh device state from API to sync local context
                                    try {
                                        if (refreshDeviceState) await refreshDeviceState();
                                    } catch (err) {
                                        console.warn('[Settings] ⚠️ Failed to refresh device state after mode update', err);
                                    }

                                    setDeviceSaveMessage({ type: 'success', text: `System mode set to ${newMode}` });
                                } catch (err) {
                                    console.error('[Settings] ❌ Failed to update system mode:', err);
                                    // Revert optimistic change on failure
                                    updateDeviceSetting('systemMode', null, prevMode);
                                    setDeviceSaveMessage({ type: 'error', text: 'Failed to update system mode' });
                                } finally {
                                    setTimeout(() => setDeviceSaveMessage(null), 3000);
                                }
                            }}
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                    {[
                        { title: 'Temperature', fields: [{ l: 'Min (°C)', k: 'min' }, { l: 'Max (°C)', k: 'max' }], key: 'temperature' },
                        { title: 'Humidity', fields: [{ l: 'Min (%)', k: 'min' }, { l: 'Max (%)', k: 'max' }], key: 'humidity' },
                        { title: 'Pressure', fields: [{ l: 'Min (hPa)', k: 'min' }, { l: 'Max (hPa)', k: 'max' }], key: 'pressure' }
                    ].map((card) => {
                        const raw = getMetricValue(card.key);
                        let formatted;
                        let status = 'normal';
                        if (card.key === 'temperature') {
                            formatted = raw != null ? `${Number(raw).toFixed(1)}°C` : '-- °C';
                            status = getTemperatureStatus(raw);
                        } else if (card.key === 'humidity') {
                            formatted = raw != null ? `${Number(raw).toFixed(1)}%` : '-- %';
                            status = getHumidityStatus(raw);
                        } else if (card.key === 'pressure') {
                            formatted = raw != null ? `${raw} hPa` : '-- hPa';
                            status = getPressureStatus(raw);
                        }

                        return (
                            <div key={card.title} style={{ background: 'white', borderRadius: '16px', padding: '16px 18px', border: '1px solid #F3F4F6' }}>
                                <div style={{ borderBottom: '2px solid #F3F4F6', paddingBottom: '8px', marginBottom: '12px' }}>
                                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1F2937', margin: 4 }}>{card.title}</h3>
                                    <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Current: <span style={{ ...getValueColorStyle(status), fontWeight: '600' }}>{formatted}</span></p>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: card.fields.length > 1 ? '1fr 1fr' : '1fr', gap: '12px' }}>
                                    {card.fields.map(f => (
                                        <div key={f.k}>
                                            <label style={{ fontSize: '11px', color: '#9CA3AF', display: 'block', marginBottom: '4px' }}>{f.l}</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={settings[card.key]?.[f.k] ?? ''}
                                                onChange={(e) => updateDeviceSetting(card.key, f.k, e.target.value === '' ? '' : Number(e.target.value))}
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
                        );
                    })}
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