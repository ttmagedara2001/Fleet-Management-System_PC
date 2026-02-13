/**
 * @module Settings
 * @description Settings page for device thresholds, system mode (Manual/Auto),
 * and robot task allocation. Persists settings to localStorage and
 * syncs task assignments to the backend via the State API.
 */
import { useState, useEffect, useRef } from 'react';
import {
    Thermometer,
    Battery,
    CheckCircle,
    ChevronDown,
    Smartphone,
    Power,
    RefreshCw,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { useDevice } from '../contexts/DeviceContext';
import { updateStateDetails } from '../services/api';
import { ROOM_CENTERS, generateTaskId } from '../utils/telemetryMath';
import {
    getThresholds as getThresholdsShared,
    getTemperatureStatus,
    getHumidityStatus,
    getPressureStatus
} from '../utils/thresholds';

// Default thresholds
const DEFAULT_SETTINGS = {
    temperature: { min: 20, max: 40 },
    humidity: { min: 20, max: 70 },
    pressure: { min: 10, max: 40 },
    battery: { min: 20, critical: 10 },
    systemMode: 'MANUAL',
    robotSettings: {}
};

// ── Validation Rules ──────────────────────────────────────────────
const VALIDATION_RULES = {
    temperature: { absMin: -50, absMax: 100, unit: '°C' },
    humidity:    { absMin: 0,   absMax: 100, unit: '%' },
    pressure:    { absMin: 300, absMax: 1100, unit: 'hPa' },
    battery:     { absMin: 0,   absMax: 100, unit: '%' },
    robotTemp:   { absMin: -20, absMax: 120, unit: '°C' },
};

/**
 * Validate all device/threshold settings.
 * Returns an object keyed by "category.field" with error strings, or {} if valid.
 */
function validateSettings(s) {
    const errors = {};
    const r = VALIDATION_RULES;

    // ── Temperature ──
    const tMin = s.temperature?.min;
    const tMax = s.temperature?.max;
    if (tMin === '' || tMin == null) errors['temperature.min'] = 'Required';
    else if (tMin < r.temperature.absMin || tMin > r.temperature.absMax)
        errors['temperature.min'] = `Must be ${r.temperature.absMin}–${r.temperature.absMax} ${r.temperature.unit}`;
    if (tMax === '' || tMax == null) errors['temperature.max'] = 'Required';
    else if (tMax < r.temperature.absMin || tMax > r.temperature.absMax)
        errors['temperature.max'] = `Must be ${r.temperature.absMin}–${r.temperature.absMax} ${r.temperature.unit}`;
    if (tMin != null && tMax != null && tMin !== '' && tMax !== '' && Number(tMin) >= Number(tMax))
        errors['temperature.min'] = (errors['temperature.min'] || '') + ' Min must be less than Max';

    // ── Humidity ──
    const hMin = s.humidity?.min;
    const hMax = s.humidity?.max;
    if (hMin === '' || hMin == null) errors['humidity.min'] = 'Required';
    else if (hMin < r.humidity.absMin || hMin > r.humidity.absMax)
        errors['humidity.min'] = `Must be ${r.humidity.absMin}–${r.humidity.absMax} ${r.humidity.unit}`;
    if (hMax === '' || hMax == null) errors['humidity.max'] = 'Required';
    else if (hMax < r.humidity.absMin || hMax > r.humidity.absMax)
        errors['humidity.max'] = `Must be ${r.humidity.absMin}–${r.humidity.absMax} ${r.humidity.unit}`;
    if (hMin != null && hMax != null && hMin !== '' && hMax !== '' && Number(hMin) >= Number(hMax))
        errors['humidity.min'] = (errors['humidity.min'] || '') + ' Min must be less than Max';

    // ── Pressure ──
    const pMin = s.pressure?.min;
    const pMax = s.pressure?.max;
    if (pMin === '' || pMin == null) errors['pressure.min'] = 'Required';
    else if (pMin < r.pressure.absMin || pMin > r.pressure.absMax)
        errors['pressure.min'] = `Must be ${r.pressure.absMin}–${r.pressure.absMax} ${r.pressure.unit}`;
    if (pMax === '' || pMax == null) errors['pressure.max'] = 'Required';
    else if (pMax < r.pressure.absMin || pMax > r.pressure.absMax)
        errors['pressure.max'] = `Must be ${r.pressure.absMin}–${r.pressure.absMax} ${r.pressure.unit}`;
    if (pMin != null && pMax != null && pMin !== '' && pMax !== '' && Number(pMin) >= Number(pMax))
        errors['pressure.min'] = (errors['pressure.min'] || '') + ' Min must be less than Max';

    // ── Battery ──
    const bWarn = s.battery?.min;
    const bCrit = s.battery?.critical;
    if (bWarn === '' || bWarn == null) errors['battery.min'] = 'Required';
    else if (bWarn < r.battery.absMin || bWarn > r.battery.absMax)
        errors['battery.min'] = `Must be ${r.battery.absMin}–${r.battery.absMax} ${r.battery.unit}`;
    if (bCrit === '' || bCrit == null) errors['battery.critical'] = 'Required';
    else if (bCrit < r.battery.absMin || bCrit > r.battery.absMax)
        errors['battery.critical'] = `Must be ${r.battery.absMin}–${r.battery.absMax} ${r.battery.unit}`;
    if (bWarn != null && bCrit != null && bWarn !== '' && bCrit !== '' && Number(bCrit) >= Number(bWarn))
        errors['battery.critical'] = (errors['battery.critical'] || '') + ' Critical must be less than Warning';

    // ── Robot Temperature ──
    const rtMin = s.robotThresholds?.tempMin;
    const rtMax = s.robotThresholds?.tempMax;
    if (rtMin != null && rtMin !== '') {
        if (rtMin < r.robotTemp.absMin || rtMin > r.robotTemp.absMax)
            errors['robotTemp.min'] = `Must be ${r.robotTemp.absMin}–${r.robotTemp.absMax} ${r.robotTemp.unit}`;
    }
    if (rtMax != null && rtMax !== '') {
        if (rtMax < r.robotTemp.absMin || rtMax > r.robotTemp.absMax)
            errors['robotTemp.max'] = `Must be ${r.robotTemp.absMin}–${r.robotTemp.absMax} ${r.robotTemp.unit}`;
    }
    if (rtMin != null && rtMax != null && rtMin !== '' && rtMax !== '' && Number(rtMin) >= Number(rtMax))
        errors['robotTemp.min'] = (errors['robotTemp.min'] || '') + ' Min must be less than Max';

    return errors;
}

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
        console.error('[Settings] Failed to load settings:', error);
    }
    return DEFAULT_SETTINGS;
};

// Save settings to localStorage
const saveSettingsToStorage = (settings) => {
    try {
        localStorage.setItem('fabrix_settings', JSON.stringify(settings));
        return true;
    } catch (error) {
        console.error('[Settings] Failed to save settings:', error);
        return false;
    }
};

// Options — single Deliver task type (no dropdown needed)
const LOCATION_OPTIONS = ['Select', 'Cleanroom A', 'Cleanroom B', 'Loading Bay', 'Storage', 'Maintenance'];

// Room center coordinates from telemetryMath.js (derived from FabMap SVG zone geometry)
const LOCATION_COORDS = ROOM_CENTERS;

const getLocationCoordinates = (name) => {
    if (!name) return null;
    return LOCATION_COORDS[name] || null;
};

function Settings() {
    // 1. Context Access
    // Ensure selectedDeviceId is available from context for API calls
    const {
        currentRobots,
        currentDeviceData,
        updateRobotTaskLocal,
        selectedDeviceId,
        refreshDeviceState,
        isConnected,
        notifyTaskUpdate,
        fetchRobotTasks,     // Fetch robot tasks from API
        isRobotBusy,         // Check if robot has active task
        getRobotActiveTask   // Get robot's current active task
    } = useDevice();

    // 2. Local State
    const [settings, setSettings] = useState(loadSettings());
    const [deviceSaveMessage, setDeviceSaveMessage] = useState(null);
    const [robotSaveMessage, setRobotSaveMessage] = useState(null);
    const [isMobile, setIsMobile] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});
    const [showValidation, setShowValidation] = useState(false);

    // Re-validate whenever settings change (only show if user already attempted save)
    useEffect(() => {
        if (showValidation) {
            setValidationErrors(validateSettings(settings));
        }
    }, [settings, showValidation]);

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

    const getValueColorStyle = (status) => {
        switch (status) {
            case 'warning': return { color: '#D97706' };
            case 'critical': return { color: '#DC2626' };
            default: return { color: '#16A34A' };
        }
    };
    // 4. Handlers

    useEffect(() => {
        function onResize() {
            setIsMobile(window.innerWidth <= 768);
        }
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

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

    // Save Device Settings (Local + API for System Mode) — with validation
    const handleSaveDeviceSettings = async () => {
        setShowValidation(true);
        const errors = validateSettings(settings);
        setValidationErrors(errors);

        if (Object.keys(errors).length > 0) {
            setDeviceSaveMessage({ type: 'error', text: 'Please fix the highlighted errors before saving.' });
            setTimeout(() => setDeviceSaveMessage(null), 4000);
            return;
        }

        // Build the thresholds object used by DeviceContext for severity computation
        const thresholds = {
            temperature: {
                min: Number(settings.temperature.min),
                max: Number(settings.temperature.max),
                critical: Number(settings.temperature.max) + 4,
            },
            humidity: {
                min: Number(settings.humidity.min),
                max: Number(settings.humidity.max),
                critical: Number(settings.humidity.max) + 15,
            },
            pressure: {
                min: Number(settings.pressure.min),
                max: Number(settings.pressure.max),
            },
            battery: {
                low: Number(settings.battery.min),
                critical: Number(settings.battery.critical ?? 10),
            },
        };

        saveSettingsToStorage({ ...settings, thresholds });

        // If System Mode changed, sync it to the cloud
        if (settings.systemMode && selectedDeviceId) {
            try {
                const topic = 'settings/systemMode';
                const payload = { mode: settings.systemMode };
                await updateStateDetails(selectedDeviceId, topic, payload);
            } catch (err) {
                console.error("Failed to sync system mode", err);
            }
        }

        setShowValidation(false);
        setDeviceSaveMessage({ type: 'success', text: 'Device settings saved!' });
        setTimeout(() => setDeviceSaveMessage(null), 3000);
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

    // Handle refresh to fetch robot tasks from API
    const handleRefreshTasks = async () => {
        setIsRefreshing(true);
        try {
            await fetchRobotTasks();
            setRobotSaveMessage({ type: 'success', text: 'Robot tasks refreshed from server' });
        } catch (err) {
            console.error('[Settings] Failed to refresh robot tasks:', err);
            setRobotSaveMessage({ type: 'error', text: 'Failed to refresh robot tasks' });
        } finally {
            setIsRefreshing(false);
            setTimeout(() => setRobotSaveMessage(null), 3000);
        }
    };

    // Fetch robot tasks only once on initial load (page refresh)
    // This runs once when the component mounts and device is available
    const hasFetchedRef = useRef(false);
    useEffect(() => {
        if (selectedDeviceId && fetchRobotTasks && !hasFetchedRef.current) {
            hasFetchedRef.current = true;
            fetchRobotTasks();
        }
        // Reset when device changes
        if (!selectedDeviceId) {
            hasFetchedRef.current = false;
        }
    }, [selectedDeviceId]); // Only depend on selectedDeviceId, not fetchRobotTasks

    return (
        <div style={{ padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Device Settings Section */}
            <div
                style={{
                    background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
                    borderRadius: '20px',
                    padding: '14px 16px',
                    border: '1px solid #DDD6FE',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}
            >
                <div className="device-settings-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1F2937', margin: 0 }}>
                            Device Settings
                        </h2>
                        <div title={isConnected ? 'Live (connected)' : 'Disconnected'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 9999, background: isConnected ? '#22C55E' : '#DC2626', boxShadow: isConnected ? '0 0 8px rgba(34,197,94,0.32)' : 'none' }} />
                            <span style={{ fontSize: 12, color: '#6B7280' }}>{isConnected ? 'Live' : 'Disconnected'}</span>
                        </div>
                    </div>

                    {/* System Control Toggle */}
                    <div className="system-toggle">
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
                                        console.warn('[Settings] Failed to refresh device state after mode update', err);
                                    }

                                    setDeviceSaveMessage({ type: 'success', text: `System mode set to ${newMode}` });
                                } catch (err) {
                                    console.error('[Settings] Failed to update system mode:', err);
                                    // Revert optimistic change on failure
                                    updateDeviceSetting('systemMode', null, prevMode);
                                    setDeviceSaveMessage({ type: 'error', text: 'Failed to update system mode' });
                                } finally {
                                    setTimeout(() => setDeviceSaveMessage(null), 3000);
                                }
                            }}
                            style={{
                                width: '64px',
                                height: '34px',
                                borderRadius: '18px',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                background: settings.systemMode === 'AUTOMATIC' ? '#7C3AED' : '#D1D5DB',
                                transition: 'background 0.3s'
                            }}
                        >
                            <Power size={16} style={{ color: settings.systemMode === 'AUTOMATIC' ? '#fff' : '#6B7280' }} />
                            <Smartphone size={16} style={{ color: settings.systemMode === 'AUTOMATIC' ? '#fff' : '#6B7280' }} />
                        </button>
                    </div>
                </div>

                {/* Expanded Threshold Cards - Device + Robot Sensors */}
                <div className="settings-threshold-grid">
                    {[
                        { title: 'Temperature', fields: [{ l: 'Min (°C)', k: 'min' }, { l: 'Max (°C)', k: 'max' }], key: 'temperature', rule: VALIDATION_RULES.temperature },
                        { title: 'Humidity', fields: [{ l: 'Min (%)', k: 'min' }, { l: 'Max (%)', k: 'max' }], key: 'humidity', rule: VALIDATION_RULES.humidity },
                        { title: 'Pressure', fields: [{ l: 'Min (hPa)', k: 'min' }, { l: 'Max (hPa)', k: 'max' }], key: 'pressure', rule: VALIDATION_RULES.pressure }
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
                            <div key={card.title} style={{ background: 'white', borderRadius: '14px', padding: '14px 16px', border: '1px solid #F3F4F6' }}>
                                <div style={{ borderBottom: '1px solid #F3F4F6', paddingBottom: '6px', marginBottom: '10px' }}>
                                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1F2937', margin: 0 }}>{card.title}</h3>
                                    <p style={{ fontSize: '12px', color: '#6B7280', margin: '2px 0 0 0' }}>Current: <span style={{ ...getValueColorStyle(status), fontWeight: '600' }}>{formatted}</span></p>
                                    <p style={{ fontSize: '10px', color: '#9CA3AF', margin: '2px 0 0 0' }}>Range: {card.rule.absMin} – {card.rule.absMax} {card.rule.unit}</p>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: card.fields.length > 1 ? '1fr 1fr' : '1fr', gap: '8px' }}>
                                    {card.fields.map(f => {
                                        const errKey = `${card.key}.${f.k}`;
                                        const hasError = showValidation && validationErrors[errKey];
                                        return (
                                            <div key={f.k}>
                                                <label style={{ fontSize: '10px', color: '#9CA3AF', display: 'block', marginBottom: '3px' }}>{f.l}</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={settings[card.key]?.[f.k] ?? ''}
                                                    onChange={(e) => updateDeviceSetting(card.key, f.k, e.target.value === '' ? '' : Number(e.target.value))}
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px 10px',
                                                        background: hasError ? '#FEF2F2' : '#F3F4F6',
                                                        border: hasError ? '1.5px solid #EF4444' : '1.5px solid transparent',
                                                        borderRadius: '8px',
                                                        fontSize: '13px',
                                                        fontWeight: '600',
                                                        outline: 'none',
                                                        transition: 'border 0.2s, background 0.2s'
                                                    }}
                                                />
                                                {hasError && (
                                                    <p style={{ fontSize: '10px', color: '#EF4444', margin: '3px 0 0 0', lineHeight: '1.3' }}>{validationErrors[errKey]}</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    {/* Robot Battery Threshold - in same grid */}
                    <div style={{ background: 'white', borderRadius: '14px', padding: '14px 16px', border: '1px solid #F3F4F6' }}>
                        <div style={{ borderBottom: '1px solid #F3F4F6', paddingBottom: '6px', marginBottom: '10px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1F2937', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                Battery
                                <span style={{ fontSize: '9px', fontWeight: '600', color: '#7C3AED', background: 'rgba(124, 58, 237, 0.1)', padding: '2px 6px', borderRadius: '8px' }}>Robot</span>
                            </h3>
                            <p style={{ fontSize: '12px', color: '#6B7280', margin: '2px 0 0 0' }}>Battery levels</p>
                            <p style={{ fontSize: '10px', color: '#9CA3AF', margin: '2px 0 0 0' }}>Warning must be greater than Critical (0–100%)</p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                                <label style={{ fontSize: '10px', color: '#9CA3AF', display: 'block', marginBottom: '3px' }}>Warning (%)</label>
                                <input
                                    type="number"
                                    value={settings.battery?.min ?? 20}
                                    onChange={(e) => updateDeviceSetting('battery', 'min', e.target.value === '' ? '' : Number(e.target.value))}
                                    style={{
                                        width: '100%',
                                        padding: '8px 10px',
                                        background: (showValidation && validationErrors['battery.min']) ? '#FEF2F2' : '#F3F4F6',
                                        border: (showValidation && validationErrors['battery.min']) ? '1.5px solid #EF4444' : '1.5px solid transparent',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        outline: 'none',
                                        transition: 'border 0.2s, background 0.2s'
                                    }}
                                />
                                {showValidation && validationErrors['battery.min'] && (
                                    <p style={{ fontSize: '10px', color: '#EF4444', margin: '3px 0 0 0', lineHeight: '1.3' }}>{validationErrors['battery.min']}</p>
                                )}
                            </div>
                            <div>
                                <label style={{ fontSize: '10px', color: '#9CA3AF', display: 'block', marginBottom: '3px' }}>Critical (%)</label>
                                <input
                                    type="number"
                                    value={settings.battery?.critical ?? 10}
                                    onChange={(e) => updateDeviceSetting('battery', 'critical', e.target.value === '' ? '' : Number(e.target.value))}
                                    style={{
                                        width: '100%',
                                        padding: '8px 10px',
                                        background: (showValidation && validationErrors['battery.critical']) ? '#FEF2F2' : '#F3F4F6',
                                        border: (showValidation && validationErrors['battery.critical']) ? '1.5px solid #EF4444' : '1.5px solid transparent',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        outline: 'none',
                                        transition: 'border 0.2s, background 0.2s'
                                    }}
                                />
                                {showValidation && validationErrors['battery.critical'] && (
                                    <p style={{ fontSize: '10px', color: '#EF4444', margin: '3px 0 0 0', lineHeight: '1.3' }}>{validationErrors['battery.critical']}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Robot Temperature Threshold - in same grid */}
                    <div style={{ background: 'white', borderRadius: '14px', padding: '14px 16px', border: '1px solid #F3F4F6' }}>
                        <div style={{ borderBottom: '1px solid #F3F4F6', paddingBottom: '6px', marginBottom: '10px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1F2937', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                Temperature
                                <span style={{ fontSize: '9px', fontWeight: '600', color: '#7C3AED', background: 'rgba(124, 58, 237, 0.1)', padding: '2px 6px', borderRadius: '8px' }}>Robot</span>
                            </h3>
                            <p style={{ fontSize: '12px', color: '#6B7280', margin: '2px 0 0 0' }}>Motor/body temp</p>
                            <p style={{ fontSize: '10px', color: '#9CA3AF', margin: '2px 0 0 0' }}>Range: {VALIDATION_RULES.robotTemp.absMin} – {VALIDATION_RULES.robotTemp.absMax} {VALIDATION_RULES.robotTemp.unit}</p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                                <label style={{ fontSize: '10px', color: '#9CA3AF', display: 'block', marginBottom: '3px' }}>Min (°C)</label>
                                <input
                                    type="number"
                                    value={settings.robotThresholds?.tempMin ?? 15}
                                    onChange={(e) => setSettings(prev => ({
                                        ...prev,
                                        robotThresholds: {
                                            ...prev.robotThresholds,
                                            tempMin: e.target.value === '' ? '' : Number(e.target.value)
                                        }
                                    }))}
                                    style={{
                                        width: '100%',
                                        padding: '8px 10px',
                                        background: (showValidation && validationErrors['robotTemp.min']) ? '#FEF2F2' : '#F3F4F6',
                                        border: (showValidation && validationErrors['robotTemp.min']) ? '1.5px solid #EF4444' : '1.5px solid transparent',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        outline: 'none',
                                        transition: 'border 0.2s, background 0.2s'
                                    }}
                                />
                                {showValidation && validationErrors['robotTemp.min'] && (
                                    <p style={{ fontSize: '10px', color: '#EF4444', margin: '3px 0 0 0', lineHeight: '1.3' }}>{validationErrors['robotTemp.min']}</p>
                                )}
                            </div>
                            <div>
                                <label style={{ fontSize: '10px', color: '#9CA3AF', display: 'block', marginBottom: '3px' }}>Max (°C)</label>
                                <input
                                    type="number"
                                    value={settings.robotThresholds?.tempMax ?? 45}
                                    onChange={(e) => setSettings(prev => ({
                                        ...prev,
                                        robotThresholds: {
                                            ...prev.robotThresholds,
                                            tempMax: e.target.value === '' ? '' : Number(e.target.value)
                                        }
                                    }))}
                                    style={{
                                        width: '100%',
                                        padding: '8px 10px',
                                        background: (showValidation && validationErrors['robotTemp.max']) ? '#FEF2F2' : '#F3F4F6',
                                        border: (showValidation && validationErrors['robotTemp.max']) ? '1.5px solid #EF4444' : '1.5px solid transparent',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        outline: 'none',
                                        transition: 'border 0.2s, background 0.2s'
                                    }}
                                />
                                {showValidation && validationErrors['robotTemp.max'] && (
                                    <p style={{ fontSize: '10px', color: '#EF4444', margin: '3px 0 0 0', lineHeight: '1.3' }}>{validationErrors['robotTemp.max']}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Save Message & Action */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {deviceSaveMessage && (
                        <div style={{
                            padding: '12px 16px',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: deviceSaveMessage.type === 'error' ? '#FEF2F2' : '#F0FDF4',
                            color: deviceSaveMessage.type === 'error' ? '#DC2626' : '#15803D',
                            border: deviceSaveMessage.type === 'error' ? '1px solid #FECACA' : '1px solid #BBF7D0'
                        }}>
                            {deviceSaveMessage.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
                            {deviceSaveMessage.text}
                        </div>
                    )}
                    <button
                        onClick={handleSaveDeviceSettings}
                        style={{
                            width: '100%',
                            padding: '14px 24px',
                            background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
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
                    <button
                        onClick={handleRefreshTasks}
                        disabled={isRefreshing}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            background: 'white',
                            border: '1px solid #E5E7EB',
                            borderRadius: '10px',
                            fontSize: '13px',
                            fontWeight: '600',
                            color: '#374151',
                            cursor: isRefreshing ? 'not-allowed' : 'pointer',
                            opacity: isRefreshing ? 0.7 : 1,
                            transition: 'all 0.2s'
                        }}
                        title="Refresh robot tasks from server"
                    >
                        {isRefreshing ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <RefreshCw size={14} />
                        )}
                        Refresh
                    </button>
                </div>

                {connectedRobots.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', background: 'rgba(255,255,255,0.4)', borderRadius: '16px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
                        <p style={{ fontSize: '16px', color: '#6B7280' }}>Waiting for robot data sync...</p>
                    </div>
                ) : (
                    <div className="robot-settings-grid">
                        {connectedRobots.map((robot, index) => {
                            const robotId = robot.id;
                            const robotSettings = settings.robotSettings?.[robotId] || {};
                            const status = getRobotStatus(robot);
                            const robotNumber = robotId.match(/\d+/)?.[0] || String(index + 1).padStart(2, '0');
                            const displayId = `R-${robotNumber}`;

                            // Check if robot is busy with an active task
                            const isBusy = isRobotBusy ? isRobotBusy(robotId) : false;
                            const activeTask = getRobotActiveTask ? getRobotActiveTask(robotId) : null;

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
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1F2937' }}>{displayId}</h3>
                                            {isBusy && (
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    fontSize: '10px',
                                                    fontWeight: '600',
                                                    background: '#DBEAFE',
                                                    color: '#1D4ED8'
                                                }}>
                                                    <AlertCircle size={10} />
                                                    Active Task
                                                </span>
                                            )}
                                        </div>
                                        <div style={{
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '50%',
                                            // Default to red; turn green only when robot has recent stream data
                                            background: (Date.now() - (robot.lastUpdate || 0)) / 1000 <= 60 ? '#22C55E' : '#DC2626',
                                            boxShadow: ((Date.now() - (robot.lastUpdate || 0)) / 1000 <= 60) ? '0 0 8px rgba(34,197,94,0.32)' : 'transparent'
                                        }} title={robot.lastUpdate ? `Last stream: ${new Date(robot.lastUpdate).toLocaleTimeString()}` : 'No recent stream data'} />
                                    </div>

                                    {/* Show active task info when robot is busy */}
                                    {isBusy && activeTask && (
                                        <div style={{
                                            background: '#FEF3C7',
                                            borderRadius: '8px',
                                            padding: '8px 10px',
                                            border: '1px solid #FDE68A',
                                            marginBottom: '4px'
                                        }}>
                                            <div style={{ fontSize: '11px', color: '#92400E', fontWeight: '600' }}>
                                                Delivering — {activeTask.task_id || activeTask.taskId || 'In Progress'}
                                            </div>
                                            {activeTask.destination && (
                                                <div style={{ fontSize: '10px', color: '#B45309', marginTop: '2px' }}>
                                                    {activeTask['initiate location'] || activeTask.source || '?'} → {typeof activeTask.destination === 'string' ? activeTask.destination : 'Destination'}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div>
                                        <label style={{ fontSize: '12px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>Task Type</label>
                                        <div style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            background: '#F0FDF4',
                                            border: '1px solid #BBF7D0',
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                            fontWeight: '700',
                                            color: '#059669',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                            📦 Deliver
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '12px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>Initiate Location</label>
                                        <div style={{ position: 'relative' }}>
                                            <select
                                                value={robotSettings.source || ''}
                                                onChange={(e) => updateRobotSetting(robotId, 'source', e.target.value)}
                                                disabled={isBusy}
                                                style={{ width: '100%', padding: '8px 32px 8px 12px', background: isBusy ? '#E5E7EB' : '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '12px', appearance: 'none', cursor: isBusy ? 'not-allowed' : 'pointer', opacity: isBusy ? 0.6 : 1 }}
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
                                                disabled={isBusy}
                                                style={{ width: '100%', padding: '8px 32px 8px 12px', background: isBusy ? '#E5E7EB' : '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '12px', appearance: 'none', cursor: isBusy ? 'not-allowed' : 'pointer', opacity: isBusy ? 0.6 : 1 }}
                                            >
                                                {LOCATION_OPTIONS.map(opt => <option key={opt} value={opt === 'Select' ? '' : opt}>{opt}</option>)}
                                            </select>
                                            <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9CA3AF' }} />
                                        </div>
                                    </div>

                                    {/* Assign/Clear buttons directly below Destination */}
                                    <div style={{ display: 'flex', gap: '0', marginTop: 8 }}>
                                        <button
                                            disabled={isBusy}
                                            onClick={async () => {
                                                // Check if robot is busy before assigning
                                                if (isBusy) {
                                                    setRobotSaveMessage({
                                                        type: 'error',
                                                        text: `${displayId} is busy with an active task. Please wait until the current task is completed.`
                                                    });
                                                    setTimeout(() => setRobotSaveMessage(null), 4000);
                                                    return;
                                                }

                                                const config = settings.robotSettings?.[robotId] || {};

                                                // Require source and destination for a Deliver task
                                                if (!config.source || config.source === 'Select') {
                                                    setRobotSaveMessage({ type: 'error', text: `Select a source for ${displayId}` });
                                                    setTimeout(() => setRobotSaveMessage(null), 3000);
                                                    return;
                                                }
                                                if (!config.destination || config.destination === 'Select') {
                                                    setRobotSaveMessage({ type: 'error', text: `Select a destination for ${displayId}` });
                                                    setTimeout(() => setRobotSaveMessage(null), 3000);
                                                    return;
                                                }
                                                if (config.source === config.destination) {
                                                    setRobotSaveMessage({ type: 'error', text: `Source and destination cannot be the same for ${displayId}` });
                                                    setTimeout(() => setRobotSaveMessage(null), 3000);
                                                    return;
                                                }

                                                if (!selectedDeviceId) {
                                                    setRobotSaveMessage({ type: 'error', text: 'No device selected for sync.' });
                                                    setTimeout(() => setRobotSaveMessage(null), 3000);
                                                    return;
                                                }

                                                try {
                                                    const srcCoords = getLocationCoordinates(config.source);
                                                    const dstCoords = getLocationCoordinates(config.destination);
                                                    const taskId = generateTaskId();

                                                    const payload = {
                                                        robotId: robotId,
                                                        task_type: 'Deliver',
                                                        task_id: taskId,
                                                        status: 'Assigned',
                                                        assignedAt: new Date().toISOString(),
                                                        'initiate location': config.source || 'Unknown',
                                                        destination: config.destination || 'Unknown',
                                                        source_lat: srcCoords?.lat ?? null,
                                                        source_lng: srcCoords?.lng ?? null,
                                                        destination_lat: dstCoords?.lat ?? null,
                                                        destination_lng: dstCoords?.lng ?? null
                                                    };

                                                    // Optimistic local update
                                                    if (updateRobotTaskLocal) updateRobotTaskLocal(robotId, payload);

                                                    // Send to API
                                                    await updateStateDetails(selectedDeviceId, `fleetMS/robots/${robotId}/task`, payload);

                                                    // Notify other components (like Analysis) that task was updated
                                                    if (notifyTaskUpdate) notifyTaskUpdate();

                                                    setRobotSaveMessage({ type: 'success', text: `Saved task for ${robotId}` });
                                                } catch (err) {
                                                    console.error('[Settings] Failed to save robot setting:', err);
                                                    setRobotSaveMessage({ type: 'error', text: `Failed to sync ${robotId}` });
                                                } finally {
                                                    setTimeout(() => setRobotSaveMessage(null), 3500);
                                                }
                                            }}
                                            style={{
                                                flex: 1,
                                                padding: '10px 12px',
                                                background: isBusy ? '#9CA3AF' : '#7C3AED',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '8px 0 0 8px',
                                                cursor: isBusy ? 'not-allowed' : 'pointer',
                                                fontWeight: 700,
                                                opacity: isBusy ? 0.7 : 1
                                            }}
                                            title={isBusy ? 'Robot is busy with an active task' : 'Assign task to robot'}
                                        >
                                            {isBusy ? 'Busy' : 'Assign'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                // Clear robot-specific settings
                                                updateRobotSetting(robotId, 'source', '');
                                                updateRobotSetting(robotId, 'destination', '');
                                                setRobotSaveMessage({ type: 'success', text: `Cleared settings for ${displayId}` });
                                                setTimeout(() => setRobotSaveMessage(null), 2000);
                                            }}
                                            style={{ flex: 1, padding: '10px 12px', background: '#F3F4F6', color: '#111827', border: '1px solid #E5E7EB', borderRadius: '0 8px 8px 0', cursor: 'pointer', fontWeight: 700 }}
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {/* Robot Fleet Save Message */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: 12 }}>
                    {robotSaveMessage && (
                        <div style={{
                            padding: '12px 16px',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: robotSaveMessage.type === 'error' ? '#FEF2F2' : '#F0FDF4',
                            color: robotSaveMessage.type === 'error' ? '#DC2626' : '#15803D',
                            border: robotSaveMessage.type === 'error' ? '1px solid #FECACA' : '1px solid #BBF7D0'
                        }}>
                            {robotSaveMessage.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
                            {robotSaveMessage.text}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Settings;