import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useStomp } from './StompContext';

const DeviceContext = createContext(null);

// Available devices
const DEVICES = [
    { id: 'device9988', name: 'Device 9988', zone: 'Cleanroom A' },
    { id: 'device0011233', name: 'Device 0011233', zone: 'Cleanroom B' },
    { id: 'deviceA72Q', name: 'Device A72Q', zone: 'Loading Bay' },
    { id: 'deviceZX91', name: 'Device ZX91', zone: 'Storage' }
];

const DEFAULT_DEVICE_STATE = {
    environment: {
        ambient_temp: null,
        ambient_hum: null,
        atmospheric_pressure: null,
        air_scrubber_status: null
    },
    state: {
        gateway_health: null,
        active_alert: null,
        ac_power: null,
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
    const { isConnected, subscribe, unsubscribe } = useStomp();

    const [selectedDeviceId, setSelectedDeviceId] = useState(DEVICES[0].id);
    const [deviceData, setDeviceData] = useState(() => {
        const initial = {};
        DEVICES.forEach(device => {
            initial[device.id] = { ...DEFAULT_DEVICE_STATE };
        });
        return initial;
    });
    const [robots, setRobots] = useState({});
    const [alerts, setAlerts] = useState([]);

    const subscriptionsRef = useRef([]);

    // Get current device data
    const currentDevice = DEVICES.find(d => d.id === selectedDeviceId);
    const currentDeviceData = deviceData[selectedDeviceId] || DEFAULT_DEVICE_STATE;
    const currentRobots = robots[selectedDeviceId] || {};

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
                id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            };

            console.log('[Device] 🚨 New alert:', newAlert);

            // Keep only last 50 alerts
            return [newAlert, ...prev].slice(0, 50);
        });
    }, []);

    // Handle device environment updates with localStorage thresholds
    const handleEnvironmentUpdate = useCallback((deviceId, payload) => {
        console.log('[Device] 🌡️ Environment update for', deviceId, ':', payload);

        setDeviceData(prev => ({
            ...prev,
            [deviceId]: {
                ...prev[deviceId],
                environment: {
                    ambient_temp: payload.ambient_temp ?? prev[deviceId]?.environment?.ambient_temp,
                    ambient_hum: payload.ambient_hum ?? prev[deviceId]?.environment?.ambient_hum,
                    atmospheric_pressure: payload.atmospheric_pressure ?? prev[deviceId]?.environment?.atmospheric_pressure,
                    air_scrubber_status: payload.air_scrubber_status ?? prev[deviceId]?.environment?.air_scrubber_status
                },
                lastUpdate: Date.now()
            }
        }));

        // Get thresholds from localStorage
        const thresholds = getThresholds();

        // Check for temperature threshold violations
        if (payload.ambient_temp) {
            if (payload.ambient_temp > thresholds.temperature.critical) {
                addAlert({
                    type: 'critical',
                    deviceId,
                    message: `CRITICAL: Temperature at ${payload.ambient_temp}°C exceeds ${thresholds.temperature.critical}°C`,
                    timestamp: Date.now()
                });
            } else if (payload.ambient_temp > thresholds.temperature.max) {
                addAlert({
                    type: 'warning',
                    deviceId,
                    message: `High temperature detected: ${payload.ambient_temp}°C (max: ${thresholds.temperature.max}°C)`,
                    timestamp: Date.now()
                });
            } else if (payload.ambient_temp < thresholds.temperature.min) {
                addAlert({
                    type: 'warning',
                    deviceId,
                    message: `Low temperature detected: ${payload.ambient_temp}°C (min: ${thresholds.temperature.min}°C)`,
                    timestamp: Date.now()
                });
            }
        }

        // Check for humidity threshold violations
        if (payload.ambient_hum) {
            if (payload.ambient_hum > thresholds.humidity.critical) {
                addAlert({
                    type: 'critical',
                    deviceId,
                    message: `CRITICAL: Humidity at ${payload.ambient_hum}% exceeds ${thresholds.humidity.critical}%`,
                    timestamp: Date.now()
                });
            } else if (payload.ambient_hum > thresholds.humidity.max) {
                addAlert({
                    type: 'warning',
                    deviceId,
                    message: `High humidity detected: ${payload.ambient_hum}% (max: ${thresholds.humidity.max}%)`,
                    timestamp: Date.now()
                });
            } else if (payload.ambient_hum < thresholds.humidity.min) {
                addAlert({
                    type: 'warning',
                    deviceId,
                    message: `Low humidity detected: ${payload.ambient_hum}% (min: ${thresholds.humidity.min}%)`,
                    timestamp: Date.now()
                });
            }
        }

        // Check for pressure threshold violations
        if (payload.atmospheric_pressure) {
            const pressure = payload.atmospheric_pressure;
            if (pressure > thresholds.pressure.max || pressure < thresholds.pressure.min) {
                addAlert({
                    type: 'warning',
                    deviceId,
                    message: `Abnormal pressure detected: ${pressure} hPa (range: ${thresholds.pressure.min}-${thresholds.pressure.max} hPa)`,
                    timestamp: Date.now()
                });
            }
        }
    }, [addAlert]);

    // Handle device state updates
    const handleStateUpdate = useCallback((deviceId, payload) => {
        console.log('[Device] 📊 State update for', deviceId, ':', payload);

        setDeviceData(prev => ({
            ...prev,
            [deviceId]: {
                ...prev[deviceId],
                state: {
                    gateway_health: payload.gateway_health ?? prev[deviceId]?.state?.gateway_health,
                    active_alert: payload.active_alert ?? prev[deviceId]?.state?.active_alert,
                    ac_power: payload.ac_power ?? prev[deviceId]?.state?.ac_power,
                    wifi_rssi: payload.wifi_rssi ?? prev[deviceId]?.state?.wifi_rssi
                },
                lastUpdate: Date.now()
            }
        }));

        // Check for active alerts
        if (payload.active_alert) {
            addAlert({
                type: 'critical',
                deviceId,
                message: payload.active_alert,
                timestamp: Date.now()
            });
        }

        // Check for robot discovery in state payload
        if (payload.robots && Array.isArray(payload.robots)) {
            console.log('[Device] 🤖 Discovered robots:', payload.robots);
            payload.robots.forEach(robotId => {
                registerRobot(deviceId, robotId);
            });
        }
    }, [addAlert]);

    // Handle task summary updates
    const handleTaskSummaryUpdate = useCallback((deviceId, payload) => {
        console.log('[Device] 📋 Task summary update for', deviceId, ':', payload);

        setDeviceData(prev => ({
            ...prev,
            [deviceId]: {
                ...prev[deviceId],
                taskSummary: payload,
                lastUpdate: Date.now()
            }
        }));
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
                        location: { lat: 0, lng: 0, z: 0 },
                        heading: 0,
                        environment: { temp: null, humidity: null },
                        status: { battery: null, load: null, state: 'UNKNOWN' },
                        task: null,
                        lastUpdate: null
                    }
                }
            };
        });
    }, []);

    // Handle robot location updates (10Hz)
    const handleRobotLocationUpdate = useCallback((deviceId, robotId, payload) => {
        setRobots(prev => ({
            ...prev,
            [deviceId]: {
                ...prev[deviceId],
                [robotId]: {
                    ...prev[deviceId]?.[robotId],
                    location: {
                        lat: payload.lat ?? payload.latitude ?? prev[deviceId]?.[robotId]?.location?.lat,
                        lng: payload.lng ?? payload.longitude ?? prev[deviceId]?.[robotId]?.location?.lng,
                        z: payload.z ?? payload.altitude ?? prev[deviceId]?.[robotId]?.location?.z
                    },
                    heading: payload.heading ?? prev[deviceId]?.[robotId]?.heading,
                    lastUpdate: Date.now()
                }
            }
        }));
    }, []);

    // Handle robot environment updates (1Hz)
    const handleRobotEnvUpdate = useCallback((deviceId, robotId, payload) => {
        console.log('[Device] 🤖🌡️ Robot env update:', robotId, payload);

        setRobots(prev => ({
            ...prev,
            [deviceId]: {
                ...prev[deviceId],
                [robotId]: {
                    ...prev[deviceId]?.[robotId],
                    environment: {
                        temp: payload.temp ?? payload.temperature ?? prev[deviceId]?.[robotId]?.environment?.temp,
                        humidity: payload.humidity ?? prev[deviceId]?.[robotId]?.environment?.humidity
                    },
                    lastUpdate: Date.now()
                }
            }
        }));

        // Check for robot temperature threshold
        const temp = payload.temp ?? payload.temperature;
        if (temp && temp > 40) {
            addAlert({
                type: 'warning',
                deviceId,
                robotId,
                message: `Robot ${robotId} overheating: ${temp}°C`,
                timestamp: Date.now()
            });
        }
    }, [addAlert]);

    // Handle robot status updates
    const handleRobotStatusUpdate = useCallback((deviceId, robotId, payload) => {
        console.log('[Device] 🤖📊 Robot status update:', robotId, payload);

        setRobots(prev => ({
            ...prev,
            [deviceId]: {
                ...prev[deviceId],
                [robotId]: {
                    ...prev[deviceId]?.[robotId],
                    status: {
                        battery: payload.battery ?? prev[deviceId]?.[robotId]?.status?.battery,
                        load: payload.load ?? prev[deviceId]?.[robotId]?.status?.load,
                        state: payload.state ?? payload.status ?? prev[deviceId]?.[robotId]?.status?.state
                    },
                    lastUpdate: Date.now()
                }
            }
        }));

        // Get thresholds from localStorage
        const thresholds = getThresholds();

        // Check for low battery
        if (payload.battery) {
            if (payload.battery <= thresholds.battery.critical) {
                addAlert({
                    type: 'critical',
                    deviceId,
                    robotId,
                    message: `CRITICAL: Robot ${robotId} battery at ${payload.battery}%`,
                    timestamp: Date.now()
                });
            } else if (payload.battery <= thresholds.battery.low) {
                addAlert({
                    type: 'warning',
                    deviceId,
                    robotId,
                    message: `Robot ${robotId} low battery: ${payload.battery}%`,
                    timestamp: Date.now()
                });
            }
        }

        // Check for obstacle detection
        if (payload.obstacle_detected) {
            addAlert({
                type: 'critical',
                deviceId,
                robotId,
                message: `Robot ${robotId} obstacle detected!`,
                timestamp: Date.now()
            });
        }
    }, [addAlert]);

    // Handle robot task updates
    const handleRobotTaskUpdate = useCallback((deviceId, robotId, payload) => {
        console.log('[Device] 🤖📋 Robot task update:', robotId, payload);

        setRobots(prev => ({
            ...prev,
            [deviceId]: {
                ...prev[deviceId],
                [robotId]: {
                    ...prev[deviceId]?.[robotId],
                    task: payload,
                    lastUpdate: Date.now()
                }
            }
        }));
    }, []);

    // Clear alert by ID
    const clearAlert = useCallback((alertId) => {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
    }, []);

    // Clear all alerts
    const clearAllAlerts = useCallback(() => {
        setAlerts([]);
    }, []);

    // Subscribe to device streams when connected
    useEffect(() => {
        if (!isConnected) {
            console.log('[Fabrix Device] ⏳ Waiting for STOMP connection...');
            return;
        }

        console.log('[Fabrix Device] 🔌 Setting up device subscriptions...');
        console.log('[Fabrix Device] 📊 Device count:', DEVICES.length);

        DEVICES.forEach(device => {
            const deviceId = device.id;

            // 1. Live Telemetry Stream - Primary device data stream
            // Topic: /topic/stream/${deviceId}
            const streamTopic = `/topic/stream/${deviceId}`;
            console.log('[Fabrix Device] 📬 Subscribing to live telemetry:', streamTopic);
            subscribe(streamTopic, (payload) => {
                console.log('[Fabrix Device] Telemetry received for', deviceId);
                // Route to appropriate handler based on payload structure
                if (payload.ambient_temp !== undefined || payload.ambient_hum !== undefined) {
                    handleEnvironmentUpdate(deviceId, payload);
                }
                if (payload.tasks || payload.task_summary) {
                    handleTaskSummaryUpdate(deviceId, payload);
                }
                // Handle robot discovery from stream
                if (payload.robots && Array.isArray(payload.robots)) {
                    console.log('[Fabrix Device] 🤖 Discovered robots in stream:', payload.robots);
                    payload.robots.forEach(robotId => registerRobot(deviceId, robotId));
                }
            });
            subscriptionsRef.current.push(streamTopic);

            // 2. Device State - Connection state, alerts, system status
            // Topic: /topic/state/${deviceId}
            const stateTopic = `/topic/state/${deviceId}`;
            console.log('[Fabrix Device] 📬 Subscribing to device state:', stateTopic);
            subscribe(stateTopic, (payload) => {
                console.log('[Fabrix Device] State update received for', deviceId);
                handleStateUpdate(deviceId, payload);
            });
            subscriptionsRef.current.push(stateTopic);
        });

        console.log('[Fabrix Device] ✅ Device subscriptions complete');

        return () => {
            console.log('[Fabrix Device] 🧹 Cleaning up device subscriptions...');
            subscriptionsRef.current.forEach(topic => {
                unsubscribe(topic);
            });
            subscriptionsRef.current = [];
            console.log('[Fabrix Device] ✅ Cleanup complete');
        };
    }, [isConnected, subscribe, unsubscribe, handleEnvironmentUpdate, handleStateUpdate, handleTaskSummaryUpdate, registerRobot]);

    // Subscribe to robot streams when robots are discovered
    // Note: Robot-level subscriptions are handled after discovery
    useEffect(() => {
        if (!isConnected) return;

        Object.entries(robots).forEach(([deviceId, deviceRobots]) => {
            Object.keys(deviceRobots).forEach(robotId => {
                // Check if already subscribed
                const locationTopic = `/topic/stream/${deviceId}/robots/${robotId}/location`;
                if (subscriptionsRef.current.includes(locationTopic)) return;

                console.log('[Fabrix Device] 🤖 Setting up robot subscriptions for:', robotId);

                // Location (10Hz)
                subscribe(locationTopic, (payload) => {
                    handleRobotLocationUpdate(deviceId, robotId, payload);
                });
                subscriptionsRef.current.push(locationTopic);

                // Environment (1Hz)
                const envTopic = `/topic/stream/${deviceId}/robots/${robotId}/env`;
                subscribe(envTopic, (payload) => {
                    handleRobotEnvUpdate(deviceId, robotId, payload);
                });
                subscriptionsRef.current.push(envTopic);

                // Status
                const statusTopic = `/topic/stream/${deviceId}/robots/${robotId}/status`;
                subscribe(statusTopic, (payload) => {
                    handleRobotStatusUpdate(deviceId, robotId, payload);
                });
                subscriptionsRef.current.push(statusTopic);

                // Tasks
                const taskTopic = `/topic/stream/${deviceId}/robots/${robotId}/tasks`;
                subscribe(taskTopic, (payload) => {
                    handleRobotTaskUpdate(deviceId, robotId, payload);
                });
                subscriptionsRef.current.push(taskTopic);

                console.log('[Fabrix Device] ✅ Robot subscriptions complete for:', robotId);
            });
        });
    }, [isConnected, robots, subscribe, handleRobotLocationUpdate, handleRobotEnvUpdate, handleRobotStatusUpdate, handleRobotTaskUpdate]);

    // For demo purposes, register some mock robots
    // TODO: Remove this in production - robots should be discovered via WebSocket
    useEffect(() => {
        // Register demo robots after a delay
        const timeout = setTimeout(() => {
            console.log('[Fabrix Device] 🎮 Registering demo robots for development...');
            registerRobot('device9988', 'robot-001');
            registerRobot('device9988', 'robot-002');
            console.log('[Fabrix Device] ✅ Demo robots registered');
        }, 2000);

        return () => clearTimeout(timeout);
    }, [registerRobot]);

    const value = {
        devices: DEVICES,
        selectedDeviceId,
        setSelectedDeviceId,
        currentDevice,
        currentDeviceData,
        currentRobots,
        deviceData,
        robots,
        alerts,
        addAlert,
        clearAlert,
        clearAllAlerts,
        registerRobot
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
