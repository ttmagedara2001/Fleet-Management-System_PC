import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { connectWebSocket } from '../services/webSocketClient';
import { getStateDetails, updateStateDetails } from '../services/api';
import { getRobotsForDevice, DEFAULT_ROBOT_SENSOR_DATA, ROBOT_STATUS } from '../config/robotRegistry';

const DeviceContext = createContext(null);

// Available devices
const DEVICES = [
    { id: 'deviceTestUC', name: 'deviceTestUC', zone: 'Testing' },
    { id: 'devicetestuc', name: 'devicetestuc', zone: 'Testing' },
    { id: 'device9988', name: 'Device 9988', zone: 'Cleanroom A' },
    { id: 'device0011233', name: 'Device 0011233', zone: 'Cleanroom B' },
    { id: 'deviceA72Q', name: 'Device A72Q', zone: 'Loading Bay' },
    { id: 'deviceZX91', name: 'Device ZX91', zone: 'Storage' }
];

const DEFAULT_DEVICE_STATE = {
    environment: {
        ambient_temp: null,
        ambient_hum: null,
        atmospheric_pressure: null
    },
    state: {
        ac_power: null,
        air_purifier: null,
        status: null,
        gateway_health: null,
        active_alert: null,
        wifi_rssi: null
    },
    taskSummary: null,
    lastUpdate: null
};

// Default thresholds (fallback if no settings saved)
const DEFAULT_THRESHOLDS = {
    temperature: { min: 18, max: 28, critical: 32 },
    humidity: { min: 30, max: 60, critical: 75 },
    battery: { low: 20, critical: 10 },
    pressure: { min: 980, max: 1040 }
};

// Get thresholds from localStorage
const getThresholds = () => {
    try {
        const saved = localStorage.getItem('fabrix_settings');
        if (saved) {
            const parsed = JSON.parse(saved);
            return parsed.thresholds || DEFAULT_THRESHOLDS;
        }
    } catch (error) {
        console.error('[Device] ❌ Failed to load thresholds:', error);
    }
    return DEFAULT_THRESHOLDS;
};

export function DeviceProvider({ children }) {
    const { token, isAuthenticated } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState(null);
    // WebSocket connection state managed near bottom of file


    // Load persisted state from localStorage
    const [selectedDeviceId, setSelectedDeviceId] = useState(() => {
        try {
            const saved = localStorage.getItem('fabrix_selectedDeviceId');
            if (saved && DEVICES.some(d => d.id === saved)) {
                return saved;
            }
        } catch (e) {
            console.error('[Device] Failed to load selectedDeviceId:', e);
        }
        return DEVICES[0].id;
    });

    const [deviceData, setDeviceData] = useState(() => {
        // Initial state without localStorage
        const initial = {};
        DEVICES.forEach(device => {
            initial[device.id] = { ...DEFAULT_DEVICE_STATE };
        });
        return initial;
    });

    // Initialize robots state with registry data per device (fresh start)
    const [robots, setRobots] = useState(() => {
        const buildInitialRobots = () => {
            const robotState = {};
            DEVICES.forEach(device => {
                const deviceRobots = getRobotsForDevice(device.id);
                robotState[device.id] = {};
                deviceRobots.forEach(robot => {
                    robotState[device.id][robot.id] = {
                        ...robot,
                        ...DEFAULT_ROBOT_SENSOR_DATA,
                        task: null,
                        lastUpdate: Date.now()
                    };
                });
            });
            return robotState;
        };
        return buildInitialRobots();
    });

    const [alerts, setAlerts] = useState(() => {
        try {
            const saved = localStorage.getItem('fabrix_alerts');
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.error('[Device] Failed to load alerts:', e);
        }
        return [];
    });

    // Time-series histories for Analysis graphs/tables (kept small)
    const [envHistory, setEnvHistory] = useState(() => {
        const h = {};
        DEVICES.forEach(d => { h[d.id] = []; });
        return h;
    });

    const [robotHistory, setRobotHistory] = useState(() => {
        const rh = {};
        DEVICES.forEach(d => { rh[d.id] = {}; });
        return rh;
    });

        // Throttle timestamps for automatic control actions per device
        const autoActionTimestamps = useRef({});



    // Persist selectedDeviceId to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('fabrix_selectedDeviceId', selectedDeviceId);
        } catch (e) {
            console.error('[Device] Failed to save selectedDeviceId:', e);
        }
    }, [selectedDeviceId]);

    // Note: deviceData and robots are NO LONGER persisted to localStorage
    // to ensure dashboard starts fresh on reload as requested.

    // Persist alerts to localStorage (debounced)
    useEffect(() => {
        const timeout = setTimeout(() => {
            try {
                localStorage.setItem('fabrix_alerts', JSON.stringify(alerts));
            } catch (e) {
                console.error('[Device] Failed to save alerts:', e);
            }
        }, 500);
        return () => clearTimeout(timeout);
    }, [alerts]);

    // Fetch initial device state from API on device selection change
    useEffect(() => {
        const fetchInitialState = async () => {
            if (!selectedDeviceId) return;

            console.log(`[Device] 📡 Fetching initial state for device: ${selectedDeviceId}`);

            try {
                const response = await getStateDetails(selectedDeviceId);

                if (response.status === 'Success' && response.data) {
                    console.log('[Device] ✅ HTTP connection verified - Initial state received');

                    // Update device state with API data
                    setDeviceData(prev => ({
                        ...prev,
                        [selectedDeviceId]: {
                            ...prev[selectedDeviceId],
                            state: {
                                ...prev[selectedDeviceId]?.state,
                                ac_power: response.data.ac?.status ?? response.data.ac?.payload?.status ?? prev[selectedDeviceId]?.state?.ac_power,
                                air_purifier: response.data.airPurifier?.status ?? response.data.airPurifier?.payload?.status ?? prev[selectedDeviceId]?.state?.air_purifier,
                                status: response.data.status?.status ?? response.data.status?.payload?.status ?? prev[selectedDeviceId]?.state?.status,
                                gateway_health: response.data.status?.gateway_health ?? prev[selectedDeviceId]?.state?.gateway_health
                            },
                            lastUpdate: Date.now()
                        }
                    }));
                }
            } catch (error) {
                console.error('[Device] ❌ Failed to fetch initial state:', error);
                // Continue with WebSocket updates - API fetch is optional
            }
        };

        fetchInitialState();
    }, [selectedDeviceId]);

    // Get current device data
    const currentDevice = DEVICES.find(d => d.id === selectedDeviceId);
    const currentDeviceData = deviceData[selectedDeviceId] || DEFAULT_DEVICE_STATE;

    // Ensure currentRobots always contains registry robots (at least 5)
    const currentRobots = useMemo(() => {
        const stateRobots = robots[selectedDeviceId] || {};
        const registryRobots = getRobotsForDevice(selectedDeviceId);

        const merged = { ...stateRobots };

        // Ensure all registry robots are present
        registryRobots.forEach(regRobot => {
            if (!merged[regRobot.id]) {
                merged[regRobot.id] = {
                    ...regRobot,
                    ...DEFAULT_ROBOT_SENSOR_DATA,
                    task: null,
                    lastUpdate: Date.now()
                };
            }
        });

        return merged;
    }, [robots, selectedDeviceId]);

    // Add alert with deduplication
    const addAlert = useCallback((alert) => {
        setAlerts(prev => {
            // Deduplicate by message within last 30 seconds
            const isDuplicate = prev.some(
                a => a.message === alert.message &&
                    Date.now() - a.timestamp < 30000
            );

            if (isDuplicate) return prev;

            const newAlert = {
                ...alert,
                id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                read: false
            };

            console.log('[Device] 🚨 New alert:', newAlert);

            // Keep only last 50 alerts
            return [newAlert, ...prev].slice(0, 50);
        });
    }, []);

    // Severity computation for environment values (used by UI to color values)
    const computeEnvSeverity = useCallback((payload) => {
        const thresholds = getThresholds();
        const temp = payload.temperature ?? payload.temp ?? payload.ambient_temp;
        const hum = payload.humidity ?? payload.ambient_hum;
        const pressure = payload.pressure ?? payload.atmospheric_pressure;

        const result = { temperature: 'good', humidity: 'good', pressure: 'good' };

        if (temp != null) {
            if (temp > thresholds.temperature.critical) result.temperature = 'critical';
            else if (temp > thresholds.temperature.max || temp < thresholds.temperature.min) result.temperature = 'warning';
        }
        if (hum != null) {
            if (hum > thresholds.humidity.critical) result.humidity = 'critical';
            else if (hum > thresholds.humidity.max || hum < thresholds.humidity.min) result.humidity = 'warning';
        }
        if (pressure != null) {
            if (pressure > thresholds.pressure.max || pressure < thresholds.pressure.min) result.pressure = 'warning';
        }
        return result;
    }, []);

    // Add environment datapoint to envHistory (bounded length)
    const addEnvHistory = useCallback((deviceId, payload) => {
        setEnvHistory(prev => {
            const deviceSeries = prev[deviceId] ? [...prev[deviceId]] : [];
            deviceSeries.unshift({ ts: Date.now(), temperature: payload.temperature ?? payload.temp ?? payload.ambient_temp ?? null, humidity: payload.humidity ?? payload.ambient_hum ?? null, pressure: payload.pressure ?? payload.atmospheric_pressure ?? null });
            if (deviceSeries.length > 500) deviceSeries.length = 500;
            return { ...prev, [deviceId]: deviceSeries };
        });
    }, []);

    // Add robot metric datapoint to robotHistory (bounded length)
    const addRobotHistory = useCallback((deviceId, robotId, metric, value) => {
        setRobotHistory(prev => {
            const deviceObj = { ...(prev[deviceId] || {}) };
            const series = deviceObj[robotId] ? [...deviceObj[robotId]] : [];
            series.unshift({ ts: Date.now(), metric, value });
            if (series.length > 500) series.length = 500;
            deviceObj[robotId] = series;
            return { ...prev, [deviceId]: deviceObj };
        });
    }, []);

    // Compute robot severity (battery/temp) to help UI colorization
    const computeRobotSeverity = useCallback((robot) => {
        const thresholds = getThresholds();
        const sev = { battery: 'good', temp: 'good' };
        const batt = robot?.status?.battery;
        const temp = robot?.environment?.temp;
        if (batt != null) {
            if (batt <= thresholds.battery.critical) sev.battery = 'critical';
            else if (batt <= thresholds.battery.low) sev.battery = 'warning';
        }
        if (temp != null) {
            if (temp > 40) sev.temp = 'warning';
        }
        return sev;
    }, []);

    // Handle device temperature updates
    const handleTemperatureUpdate = useCallback((deviceId, payload) => {
        console.log('[Device] 🌡️ Temperature update for', deviceId, ':', payload);

        setDeviceData(prev => ({
            ...prev,
            [deviceId]: {
                ...prev[deviceId],
                environment: {
                    ...prev[deviceId]?.environment,
                    ambient_temp: payload.temperature ?? payload.temp ?? payload.ambient_temp ?? prev[deviceId]?.environment?.ambient_temp,
                    ambient_hum: payload.humidity ?? payload.ambient_hum ?? prev[deviceId]?.environment?.ambient_hum,
                    atmospheric_pressure: payload.pressure ?? payload.atmospheric_pressure ?? prev[deviceId]?.environment?.atmospheric_pressure
                },
                lastUpdate: Date.now()
            }
        }));

        // Append to environment history for analysis
        try { addEnvHistory(deviceId, payload); } catch (e) { /* ignore */ }

        // Store computed severity flags in device state for UI coloring
        try {
            const severity = computeEnvSeverity(payload);
            setDeviceData(prev => ({
                ...prev,
                [deviceId]: {
                    ...prev[deviceId],
                    environment: {
                        ...prev[deviceId]?.environment,
                        severity
                    }
                }
            }));
        } catch (e) { /* ignore */ }

        // Get thresholds from localStorage
        const thresholds = getThresholds();
        const temp = payload.temperature ?? payload.temp ?? payload.ambient_temp;

        // Check for temperature threshold violations
        if (temp != null) {
            if (temp > thresholds.temperature.critical) {
                addAlert({
                    type: 'critical',
                    deviceId,
                    message: `CRITICAL: Temperature at ${temp}°C exceeds ${thresholds.temperature.critical}°C`,
                    timestamp: Date.now()
                });
            } else if (temp > thresholds.temperature.max) {
                addAlert({
                    type: 'warning',
                    deviceId,
                    message: `High temperature detected: ${temp}°C (max: ${thresholds.temperature.max}°C)`,
                    timestamp: Date.now()
                });
            } else if (temp < thresholds.temperature.min) {
                addAlert({
                    type: 'warning',
                    deviceId,
                    message: `Low temperature detected: ${temp}°C (min: ${thresholds.temperature.min}°C)`,
                    timestamp: Date.now()
                });
            }
        }

        // Check for humidity threshold violations
        const humidity = payload.humidity ?? payload.ambient_hum;
        if (humidity != null) {
            if (humidity > thresholds.humidity.critical) {
                addAlert({
                    type: 'critical',
                    deviceId,
                    message: `CRITICAL: Humidity at ${humidity}% exceeds ${thresholds.humidity.critical}%`,
                    timestamp: Date.now()
                });
            } else if (humidity > thresholds.humidity.max) {
                addAlert({
                    type: 'warning',
                    deviceId,
                    message: `High humidity detected: ${humidity}% (max: ${thresholds.humidity.max}%)`,
                    timestamp: Date.now()
                });
            } else if (humidity < thresholds.humidity.min) {
                addAlert({
                    type: 'warning',
                    deviceId,
                    message: `Low humidity detected: ${humidity}% (min: ${thresholds.humidity.min}%)`,
                    timestamp: Date.now()
                });
            }
        }

        // Check for pressure threshold violations
        const pressure = payload.pressure ?? payload.atmospheric_pressure;
        if (pressure != null) {
            if (pressure > thresholds.pressure.max || pressure < thresholds.pressure.min) {
                addAlert({
                    type: 'warning',
                    deviceId,
                    message: `Abnormal pressure detected: ${pressure} hPa (range: ${thresholds.pressure.min}-${thresholds.pressure.max} hPa)`,
                    timestamp: Date.now()
                });
            }
        }

        // Auto-control logic: if system mode is AUTOMATIC, trigger AC / Air Purifier updates
        try {
            const saved = localStorage.getItem('fabrix_settings');
            const parsed = saved ? JSON.parse(saved) : {};
            const mode = parsed.systemMode || 'MANUAL';

            if (mode === 'AUTOMATIC') {
                // Throttle auto actions per device
                const now = Date.now();
                const last = autoActionTimestamps.current[deviceId] || 0;
                if (now - last > 30000) { // 30s throttle
                    autoActionTimestamps.current[deviceId] = now;

                    // Decide AC state
                    const temp = payload.temperature ?? payload.temp ?? payload.ambient_temp;
                    if (temp != null) {
                        // NOTE: Auto behavior: when temperature is BELOW min, enable AC (turn ON)
                        // and when temperature is ABOVE max, disable AC (turn OFF).
                        // This treats AC as the actuator used to heat when low; adjust if your device
                        // interprets ON/OFF the other way around.
                        if (temp < thresholds.temperature.min) {
                            // Turn AC ON (temperature is low)
                            (async () => {
                                try {
                                    await updateStateDetails(deviceId, 'fleetMS/ac', { status: 'ON' });
                                    if (refreshDeviceState) await refreshDeviceState();
                                } catch (err) {
                                    console.warn('[AutoControl] Failed to set AC ON', err);
                                }
                            })();
                        } else if (temp > thresholds.temperature.max) {
                            // Turn AC OFF (temperature is high)
                            (async () => {
                                try {
                                    await updateStateDetails(deviceId, 'fleetMS/ac', { status: 'OFF' });
                                    if (refreshDeviceState) await refreshDeviceState();
                                } catch (err) {
                                    console.warn('[AutoControl] Failed to set AC OFF', err);
                                }
                            })();
                        }
                    }

                    // Decide Air Purifier state based on humidity or active alerts
                    const hum = payload.humidity ?? payload.ambient_hum;
                    const hasAlert = payload.alert || payload.active_alert;
                    if (hum != null) {
                        if (hum > thresholds.humidity.max || hasAlert) {
                            (async () => {
                                try {
                                    await updateStateDetails(deviceId, 'fleetMS/airPurifier', { status: 'ACTIVE' });
                                    if (refreshDeviceState) await refreshDeviceState();
                                } catch (err) {
                                    console.warn('[AutoControl] Failed to set Air Purifier ACTIVE', err);
                                }
                            })();
                        } else if (hum < thresholds.humidity.min) {
                            (async () => {
                                try {
                                    await updateStateDetails(deviceId, 'fleetMS/airPurifier', { status: 'INACTIVE' });
                                    if (refreshDeviceState) await refreshDeviceState();
                                } catch (err) {
                                    console.warn('[AutoControl] Failed to set Air Purifier INACTIVE', err);
                                }
                            })();
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('[AutoControl] Error evaluating automatic controls', err);
        }
    }, [addAlert, addEnvHistory, computeEnvSeverity]);

    // Handle AC state updates
    const handleACUpdate = useCallback((deviceId, payload) => {
        console.log('[Device] ❄️ AC update for', deviceId, ':', payload);

        setDeviceData(prev => ({
            ...prev,
            [deviceId]: {
                ...prev[deviceId],
                state: {
                    ...prev[deviceId]?.state,
                    ac_power: payload.status ?? payload.state ?? payload.ac_power ?? prev[deviceId]?.state?.ac_power
                },
                lastUpdate: Date.now()
            }
        }));
    }, []);

    // Handle device status updates
    const handleDeviceStatusUpdate = useCallback((deviceId, payload) => {
        console.log('[Device] 📊 Device status update for', deviceId, ':', payload);

        setDeviceData(prev => ({
            ...prev,
            [deviceId]: {
                ...prev[deviceId],
                state: {
                    ...prev[deviceId]?.state,
                    status: payload.status ?? payload.state ?? prev[deviceId]?.state?.status,
                    gateway_health: payload.gateway_health ?? payload.health ?? prev[deviceId]?.state?.gateway_health,
                    wifi_rssi: payload.wifi_rssi ?? payload.rssi ?? prev[deviceId]?.state?.wifi_rssi,
                    active_alert: payload.alert ?? payload.active_alert ?? prev[deviceId]?.state?.active_alert
                },
                lastUpdate: Date.now()
            }
        }));

        // Check for active alerts from status
        if (payload.alert || payload.active_alert) {
            addAlert({
                type: 'critical',
                deviceId,
                message: payload.alert || payload.active_alert,
                timestamp: Date.now()
            });
        }
    }, [addAlert, computeRobotSeverity, addRobotHistory]);

    // Handle air purifier state updates
    const handleAirPurifierUpdate = useCallback((deviceId, payload) => {
        console.log('[Device] 🌬️ Air purifier update for', deviceId, ':', payload);

        setDeviceData(prev => ({
            ...prev,
            [deviceId]: {
                ...prev[deviceId],
                state: {
                    ...prev[deviceId]?.state,
                    air_purifier: payload.status ?? payload.state ?? payload.air_purifier ?? prev[deviceId]?.state?.air_purifier
                },
                lastUpdate: Date.now()
            }
        }));
    }, []);

    // Handle robot discovery from device stream
    const handleRobotsDiscovery = useCallback((deviceId, payload) => {
        console.log('[Device] 🤖 Robots discovery for', deviceId, ':', payload);

        // Payload could be array of robot IDs or object with robots array
        const robotIds = Array.isArray(payload) ? payload :
            (payload.robots ? payload.robots :
                (payload.robotIds ? payload.robotIds : []));

        robotIds.forEach(robotId => {
            const id = typeof robotId === 'string' ? robotId : robotId.id || robotId.robotId;
            if (id) {
                registerRobot(deviceId, id);
            }
        });

        // Also update task summary if present
        if (payload.tasks || payload.task_summary) {
            setDeviceData(prev => ({
                ...prev,
                [deviceId]: {
                    ...prev[deviceId],
                    taskSummary: payload.tasks || payload.task_summary,
                    lastUpdate: Date.now()
                }
            }));
        }
    }, []);

    // Register a robot and subscribe to its streams
    const registerRobot = useCallback((deviceId, robotId) => {
        console.log('[Device] 🤖 Registering robot:', robotId, 'for device:', deviceId);

        setRobots(prev => {
            if (prev[deviceId]?.[robotId]) {
                console.log('[Device] ⚠️ Robot already registered:', robotId);
                return prev;
            }

            return {
                ...prev,
                [deviceId]: {
                    ...prev[deviceId],
                    [robotId]: {
                        id: robotId,
                        location: { lat: null, lng: null, z: 0 },
                        heading: 0,
                        environment: { temp: null, humidity: null },
                        status: { battery: null, load: null, state: 'READY' },
                        task: null,
                        lastUpdate: null
                    }
                }
            };
        });
    }, []);

    // Handle robot location updates
    const handleRobotLocationUpdate = useCallback((deviceId, robotId, payload) => {
        setRobots(prev => {
            const deviceRobots = prev[deviceId] || {};
            const existingRobot = deviceRobots[robotId] || {
                id: robotId,
                location: { lat: null, lng: null, z: 0 },
                heading: 0,
                status: { state: 'READY', battery: 100 },
                environment: { temp: null, humidity: null },
                task: null
            };

            return {
                ...prev,
                [deviceId]: {
                    ...deviceRobots,
                    [robotId]: {
                        ...existingRobot,
                        location: {
                            lat: payload.lat ?? payload.latitude ?? (payload.location?.lat) ?? existingRobot.location?.lat,
                            lng: payload.lng ?? payload.longitude ?? (payload.location?.lng) ?? existingRobot.location?.lng,
                            z: payload.z ?? payload.altitude ?? existingRobot.location?.z
                        },
                        status: payload.status ? { ...existingRobot.status, ...payload.status } : existingRobot.status,
                        heading: payload.heading ?? payload.orientation ?? existingRobot.heading,
                        lastUpdate: Date.now()
                    }
                }
            };
        });

        // Append location to robot history (keep simple lat,lng object)
        try { addRobotHistory(deviceId, robotId, 'location', { lat: payload.lat ?? payload.latitude ?? payload.location?.lat, lng: payload.lng ?? payload.longitude ?? payload.location?.lng }); } catch (e) { /* ignore */ }
    }, []);

    // Handle robot temperature updates
    // Handle robot temperature updates
    const handleRobotTempUpdate = useCallback((deviceId, robotId, payload) => {
        console.log('[Device] 🤖🌡️ Robot temp update:', robotId, payload);

        // Unwrap payload if nested (though routeStreamData does this, sometimes structure varies)
        const data = payload.payload || payload;
        const temp = data.temperature ?? data.temp;
        setRobots(prev => {
            const deviceRobots = prev[deviceId] || {};
            const existingRobot = deviceRobots[robotId] || {
                id: robotId,
                location: { lat: null, lng: null, z: 0 },
                heading: 0,
                status: { state: 'READY', battery: 100 },
                environment: { temp: null, humidity: null },
                task: null
            };

            const updatedRobot = {
                ...existingRobot,
                environment: {
                    ...existingRobot.environment,
                    temp: temp ?? existingRobot.environment?.temp,
                    humidity: data.humidity ?? existingRobot.environment?.humidity
                },
                lastUpdate: Date.now()
            };

            // attach computed severity for UI coloring
            const sev = computeRobotSeverity(updatedRobot);
            updatedRobot.severity = sev;

            // return new state
            return {
                ...prev,
                [deviceId]: {
                    ...deviceRobots,
                    [robotId]: updatedRobot
                }
            };
        });

        // Append to robot history for analysis
        try { addRobotHistory(deviceId, robotId, 'temp', temp); } catch (e) { /* ignore */ }

        // Check for robot temperature threshold
        if (temp != null && temp > 40) {
            addAlert({
                type: 'warning',
                deviceId,
                robotId,
                message: `Robot ${robotId} overheating: ${temp}°C`,
                timestamp: Date.now()
            });
        }
    }, [addAlert, computeRobotSeverity, addRobotHistory]);



    // Handle robot status updates
    const handleRobotStatusUpdate = useCallback((deviceId, robotId, payload) => {
        // Ensure robot is registered
        setRobots(prev => {
            if (!prev[deviceId]?.[robotId]) {
                return {
                    ...prev,
                    [deviceId]: {
                        ...prev[deviceId],
                        [robotId]: {
                            id: robotId,
                            location: { lat: 0, lng: 0, z: 0 },
                            heading: 0,
                            environment: { temp: null, humidity: null },
                            status: { battery: null, load: null, state: 'UNKNOWN' },
                            task: null,
                            lastUpdate: Date.now()
                        }
                    }
                };
            }
            return prev;
        });

        setRobots(prev => ({
            ...prev,
            [deviceId]: {
                ...prev[deviceId],
                [robotId]: {
                    ...prev[deviceId]?.[robotId],
                    status: {
                        ...prev[deviceId]?.[robotId]?.status,
                        load: payload.load ?? prev[deviceId]?.[robotId]?.status?.load,
                        state: payload.state ?? payload.status ?? prev[deviceId]?.[robotId]?.status?.state
                    },
                    lastUpdate: Date.now()
                }
            }
        }));

        // Check for obstacle detection
        if (payload.obstacle_detected || payload.obstacle) {
            addAlert({
                type: 'critical',
                deviceId,
                robotId,
                message: `Robot ${robotId} obstacle detected!`,
                timestamp: Date.now()
            });
        }

        // compute severity and append status to robot history
        try {
            setRobots(prev => {
                const deviceRobots = prev[deviceId] || {};
                const r = deviceRobots[robotId] || {};
                const updated = {
                    ...r,
                    status: {
                        ...r.status,
                        load: payload.load ?? r.status?.load,
                        state: payload.state ?? payload.status ?? r.status?.state
                    },
                    lastUpdate: Date.now()
                };
                updated.severity = computeRobotSeverity(updated);

                // also push a small status history entry
                try { addRobotHistory(deviceId, robotId, 'status', updated.status.state); } catch (e) { /* ignore */ }

                return { ...prev, [deviceId]: { ...deviceRobots, [robotId]: updated } };
            });
        } catch (e) { /* ignore */ }
    }, [addAlert, computeRobotSeverity, addRobotHistory]);

    // Handle robot battery updates
    const handleRobotBatteryUpdate = useCallback((deviceId, robotId, payload) => {
        // Ensure robot is registered
        setRobots(prev => {
            if (!prev[deviceId]?.[robotId]) {
                return {
                    ...prev,
                    [deviceId]: {
                        ...prev[deviceId],
                        [robotId]: {
                            id: robotId,
                            location: { lat: 0, lng: 0, z: 0 },
                            heading: 0,
                            environment: { temp: null, humidity: null },
                            status: { battery: null, load: null, state: 'UNKNOWN' },
                            task: null,
                            lastUpdate: Date.now()
                        }
                    }
                };
            }
            return prev;
        });

        const battery = payload.battery ?? payload.level ?? payload.percentage;

        setRobots(prev => {
            const deviceRobots = prev[deviceId] || {};
            const existingRobot = deviceRobots[robotId] || {
                id: robotId,
                location: { lat: 0, lng: 0, z: 0 },
                heading: 0,
                environment: { temp: null, humidity: null },
                status: { battery: null, load: null, state: 'UNKNOWN' },
                task: null
            };

            const updatedRobot = {
                ...existingRobot,
                status: {
                    ...existingRobot.status,
                    battery: battery ?? existingRobot.status?.battery
                },
                lastUpdate: Date.now()
            };

            // attach computed severity
            updatedRobot.severity = computeRobotSeverity(updatedRobot);

            return {
                ...prev,
                [deviceId]: {
                    ...deviceRobots,
                    [robotId]: updatedRobot
                }
            };
        });

        // Append to robot history for analysis
        try { addRobotHistory(deviceId, robotId, 'battery', battery); } catch (e) { /* ignore */ }

        // Get thresholds from localStorage
        const thresholds = getThresholds();

        // Check for low battery
        if (battery != null) {
            if (battery <= thresholds.battery.critical) {
                addAlert({
                    type: 'critical',
                    deviceId,
                    robotId,
                    message: `CRITICAL: Robot ${robotId} battery at ${battery}%`,
                    timestamp: Date.now()
                });
            } else if (battery <= thresholds.battery.low) {
                addAlert({
                    type: 'warning',
                    deviceId,
                    robotId,
                    message: `Robot ${robotId} low battery: ${battery}%`,
                    timestamp: Date.now()
                });
            }
        }
    }, [addAlert]);

    // Handle robot task updates (both stream and state)
    const handleRobotTaskUpdate = useCallback((deviceId, robotId, payload) => {
        console.log(`[Device] 📋 Task update for ${robotId}:`, payload);

        // Ensure robot is registered
        setRobots(prev => {
            if (!prev[deviceId]?.[robotId]) {
                // ... (auto-register logic if needed, but usually strict)
                return prev;
            }
            return prev;
        });

        setRobots(prev => {
            const currentRobot = prev[deviceId]?.[robotId];
            if (!currentRobot) return prev; // Should be handled above, but safety check

            // normalize task data
            let taskData = payload;
            if (typeof payload === 'string') {
                taskData = { type: payload, task: payload };
            } else if (typeof payload === 'object') {
                // Ensure 'type' exists for UI compatibility (Dashboard looks for task.type)
                taskData = {
                    ...payload,
                    type: payload.task || payload.type || 'Unknown'
                };
            }

            return {
                ...prev,
                [deviceId]: {
                    ...prev[deviceId],
                    [robotId]: {
                        ...currentRobot,
                        task: taskData,
                        lastUpdate: Date.now()
                    }
                }
            };
        });
    }, []);

    // Handle robot online/offline status updates
    // Payload format: {"robot-status": "online" | "offline", "robotId": "R-001"}
    const handleRobotOnlineStatus = useCallback((deviceId, robotId, status) => {
        console.log(`[Device] 🤖 Robot ${robotId} status: ${status === 'online' ? '🟢' : '🔴'} ${status}`);

        setRobots(prev => {
            // Find the robot - might be stored with different ID format
            const deviceRobots = prev[deviceId] || {};
            const matchingRobotId = Object.keys(deviceRobots).find(id =>
                id === robotId ||
                id.includes(robotId) ||
                robotId.includes(id)
            ) || robotId;

            return {
                ...prev,
                [deviceId]: {
                    ...prev[deviceId],
                    [matchingRobotId]: {
                        ...prev[deviceId]?.[matchingRobotId],
                        id: matchingRobotId,
                        'robot-status': status,
                        robotStatus: status,
                        lastUpdate: Date.now()
                    }
                }
            };
        });
    }, []);

    // Clear alert by ID
    const clearAlert = useCallback((alertId) => {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
    }, []);

    // Clear all alerts
    const clearAllAlerts = useCallback(() => {
        setAlerts([]);
    }, []);

    // Mark a specific alert as read
    const markAlertRead = useCallback((alertId) => {
        setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a));
    }, []);

    // Mark all alerts as read
    const markAllAlertsRead = useCallback(() => {
        setAlerts(prev => prev.map(a => ({ ...a, read: true })));
    }, []);

    // Manage WebSocket Connection & Routing
    useEffect(() => {
        if (!isAuthenticated) return;

        const deviceId = selectedDeviceId;
        console.log(`[Device] 🔗 Connecting WebSocket for device: ${deviceId}`);

        // Data Routing Logic
        // Data Routing Logic
        const routeStreamData = (payload) => {
            let effectivePayload = payload;
            let topicPath = payload.topicSuffix || payload.topic || '';

            if (payload.payload && typeof payload.payload === 'object') {
                effectivePayload = payload.payload;
            }

            console.log(`[Device] 📨 Received stream data. Topic: ${topicPath}`);

            // 1. Device Environment Updates (Strict Topic Check)
            if (topicPath === 'fleetMS/temperature' ||
                topicPath === 'fleetMS/humidity' ||
                topicPath === 'fleetMS/pressure' ||
                topicPath === 'fleetMS/environment' ||
                topicPath === 'fleetMS/env') {
                // Accept full environment payloads (temperature, humidity, pressure)
                handleTemperatureUpdate(deviceId, effectivePayload);
                return;
            }

            // 2. Robot Updates (Flexible Pattern Matching)
            // Pattern: fleetMS/robots/<robotId>[/<metric>]
            // Matches "robots/R-001" AND "robots/R-001/temperature"
            const robotMatch = topicPath.match(/robots\/([^/]+)(?:\/(.+))?$/);

            if (robotMatch) {
                const robotId = robotMatch[1];
                const metricFromTopic = robotMatch[2]; // undefined if no suffix

                console.log(`[Device] 🤖 Robot update. ID: ${robotId}, Topic Metric: ${metricFromTopic || 'None (Inferring)'}`);

                // Helper to dispatch based on metric or payload keys
                const dispatchRobotUpdate = (metric, data) => {
                    switch (metric) {
                        case 'temperature':
                        case 'temp':
                            handleRobotTempUpdate(deviceId, robotId, data);
                            break;
                        case 'battery':
                            handleRobotBatteryUpdate(deviceId, robotId, data);
                            break;
                        case 'location':
                            handleRobotLocationUpdate(deviceId, robotId, data);
                            break;
                        case 'status':
                        case 'state':
                            handleRobotStatusUpdate(deviceId, robotId, data);
                            break;
                        case 'task':
                            handleRobotTaskUpdate(deviceId, robotId, data);
                            break;
                        default:
                            console.warn(`[Device] Unhandled robot metric: ${metric}`);
                    }
                };

                // Case A: Metric is in validity topic (e.g. .../temperature)
                if (metricFromTopic) {
                    dispatchRobotUpdate(metricFromTopic, effectivePayload);
                    return;
                }

                // Case B: No metric in topic, infer from payload keys
                // Process status first so UI shows connectivity/state immediately,
                // then store sensor values into history and UI.
                if (effectivePayload.status !== undefined || effectivePayload.state !== undefined) {
                    dispatchRobotUpdate('status', effectivePayload);
                }
                if (effectivePayload.temperature !== undefined || effectivePayload.temp !== undefined) {
                    dispatchRobotUpdate('temperature', effectivePayload);
                }
                if (effectivePayload.battery !== undefined || effectivePayload.level !== undefined) {
                    dispatchRobotUpdate('battery', effectivePayload);
                }
                if (effectivePayload.lat !== undefined || effectivePayload.lng !== undefined || effectivePayload.location !== undefined) {
                    dispatchRobotUpdate('location', effectivePayload);
                }
                if (effectivePayload.task !== undefined) {
                    dispatchRobotUpdate('task', effectivePayload);
                }
                return;
            }

            // 3. Fallback / legacy routing (if no specific topic matches, try to infer from payload)
            // This ensures robust handling if topic is missing or different
            if (effectivePayload.robots !== undefined || effectivePayload.robotId !== undefined) {
                // Discovery or direct payload update
                if (effectivePayload.robots) {
                    handleRobotsDiscovery(deviceId, effectivePayload);
                } else if (effectivePayload.robotId) {
                    // Routing based on payload content + robotId presence
                    const rId = effectivePayload.robotId;
                    if (effectivePayload.lat !== undefined || effectivePayload.location !== undefined) {
                        handleRobotLocationUpdate(deviceId, rId, effectivePayload.location || effectivePayload);
                    }
                    if (effectivePayload.temperature !== undefined && !effectivePayload.ambient_temp) {
                        handleRobotTempUpdate(deviceId, rId, effectivePayload);
                    }
                    if (effectivePayload.status !== undefined || effectivePayload.state !== undefined) {
                        handleRobotStatusUpdate(deviceId, rId, effectivePayload);
                    }
                    if (effectivePayload.battery !== undefined || effectivePayload.level !== undefined) {
                        handleRobotBatteryUpdate(deviceId, rId, effectivePayload);
                    }
                    if (effectivePayload.task !== undefined || effectivePayload.tasks !== undefined) {
                        handleRobotTaskUpdate(deviceId, rId, effectivePayload);
                    }
                }
            } else if (!topicPath) {
                // Only attempt to guess device env data if NO topic path was present to avoid double handling
                if (effectivePayload.ambient_temp !== undefined || effectivePayload.temperature !== undefined) {
                    handleTemperatureUpdate(deviceId, effectivePayload);
                }
            }

            // Always check for device status / alerts in any payload
            handleDeviceStatusUpdate(deviceId, effectivePayload);
        };

        const routeStateData = (payload) => {
            if (payload.ac_power !== undefined || payload.ac !== undefined) {
                handleACUpdate(deviceId, payload);
            }
            if (payload.air_purifier !== undefined || payload.airPurifier !== undefined) {
                handleAirPurifierUpdate(deviceId, payload);
            }
            if (payload.robotId && payload.task !== undefined) {
                handleRobotTaskUpdate(deviceId, payload.robotId, payload);
            }
            handleDeviceStatusUpdate(deviceId, payload);
        };

        const client = connectWebSocket(
            deviceId,
            routeStreamData,
            routeStateData,
            () => {
                setIsConnected(true);
                setConnectionError(null);
            },
            () => {
                setIsConnected(false);
            }
        );

        return () => {
            console.log('[DeviceContext] 🔌 Disconnecting WebSocket');
            client.deactivate();
            setIsConnected(false);
        };
    }, [isAuthenticated, selectedDeviceId, handleTemperatureUpdate, handleACUpdate, handleDeviceStatusUpdate, handleAirPurifierUpdate, handleRobotsDiscovery, handleRobotLocationUpdate, handleRobotTempUpdate, handleRobotStatusUpdate, handleRobotBatteryUpdate, handleRobotTaskUpdate, handleRobotOnlineStatus]);

    // Note: Robot subscriptions removed - all data comes through main STREAM/STATE topics

    // Robots are discovered via WebSocket - no mock data

    // Refresh device state from API
    const refreshDeviceState = useCallback(async () => {
        if (!selectedDeviceId) return;

        console.log(`[Device] 🔄 Refreshing state for device: ${selectedDeviceId}`);

        try {
            const response = await getStateDetails(selectedDeviceId);

            if (response.status === 'Success' && response.data) {
                setDeviceData(prev => ({
                    ...prev,
                    [selectedDeviceId]: {
                        ...prev[selectedDeviceId],
                        state: {
                            ...prev[selectedDeviceId]?.state,
                            ac_power: response.data.ac?.status ?? response.data.ac?.payload?.status ?? prev[selectedDeviceId]?.state?.ac_power,
                            air_purifier: response.data.airPurifier?.status ?? response.data.airPurifier?.payload?.status ?? prev[selectedDeviceId]?.state?.air_purifier,
                            status: response.data.status?.status ?? response.data.status?.payload?.status ?? prev[selectedDeviceId]?.state?.status,
                            gateway_health: response.data.status?.gateway_health ?? prev[selectedDeviceId]?.state?.gateway_health
                        },
                        lastUpdate: Date.now()
                    }
                }));
                console.log('[Device] ✅ State refreshed');
            }
        } catch (error) {
            console.error('[Device] ❌ Failed to refresh state:', error);
        }
    }, [selectedDeviceId]);

    // Optimistic update helper
    const updateRobotTaskLocal = useCallback((robotId, taskPayload) => {
        handleRobotTaskUpdate(selectedDeviceId, robotId, taskPayload);
    }, [selectedDeviceId, handleRobotTaskUpdate]);

    // History getters for Analysis page
    const getEnvHistory = useCallback((deviceId) => envHistory[deviceId] || [], [envHistory]);
    const getRobotHistory = useCallback((deviceId, robotId) => (robotHistory[deviceId] && robotHistory[deviceId][robotId]) || [], [robotHistory]);

    const value = {
        // WebSocket connection state
        isConnected,
        connectionError,

        // Device management
        devices: DEVICES,
        selectedDeviceId,
        setSelectedDeviceId,
        currentDevice,
        currentDeviceData,
        currentRobots,
        deviceData,
        robots,

        // Time-series histories (for Analysis graphs/tables)
        envHistory,
        robotHistory,
        getEnvHistory,
        getRobotHistory,

        // Alerts
        alerts,
        addAlert,
        clearAlert,
        clearAllAlerts,
        markAlertRead,
        markAllAlertsRead,

        // Robot management
        registerRobot,
        refreshDeviceState,
        updateRobotTaskLocal // Exposed helper
    };

    return (
        <DeviceContext.Provider value={value}>
            {children}
        </DeviceContext.Provider>
    );
}

export function useDevice() {
    const context = useContext(DeviceContext);
    if (!context) {
        throw new Error('useDevice must be used within a DeviceProvider');
    }
    return context;
}

export default DeviceContext;
