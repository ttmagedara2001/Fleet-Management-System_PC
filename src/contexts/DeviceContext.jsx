import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useStomp } from './StompContext';
import { TOPICS, toMqttFormat } from '../services/webSocketClient';
import { getStateDetails } from '../services/api';

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
    const { isConnected, subscribe, unsubscribe } = useStomp();

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
        try {
            const saved = localStorage.getItem('fabrix_deviceData');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge with defaults to ensure all devices exist
                const merged = {};
                DEVICES.forEach(device => {
                    merged[device.id] = { ...DEFAULT_DEVICE_STATE, ...parsed[device.id] };
                });
                return merged;
            }
        } catch (e) {
            console.error('[Device] Failed to load deviceData:', e);
        }
        const initial = {};
        DEVICES.forEach(device => {
            initial[device.id] = { ...DEFAULT_DEVICE_STATE };
        });
        return initial;
    });

    const [robots, setRobots] = useState(() => {
        try {
            const saved = localStorage.getItem('fabrix_robots');
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.error('[Device] Failed to load robots:', e);
        }
        return {};
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

    const subscriptionsRef = useRef([]);

    // Persist selectedDeviceId to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('fabrix_selectedDeviceId', selectedDeviceId);
        } catch (e) {
            console.error('[Device] Failed to save selectedDeviceId:', e);
        }
    }, [selectedDeviceId]);

    // Persist deviceData to localStorage (debounced)
    useEffect(() => {
        const timeout = setTimeout(() => {
            try {
                localStorage.setItem('fabrix_deviceData', JSON.stringify(deviceData));
            } catch (e) {
                console.error('[Device] Failed to save deviceData:', e);
            }
        }, 1000);
        return () => clearTimeout(timeout);
    }, [deviceData]);

    // Persist robots to localStorage (debounced)
    useEffect(() => {
        const timeout = setTimeout(() => {
            try {
                localStorage.setItem('fabrix_robots', JSON.stringify(robots));
            } catch (e) {
                console.error('[Device] Failed to save robots:', e);
            }
        }, 1000);
        return () => clearTimeout(timeout);
    }, [robots]);

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
                    console.log('[Device] ✅ Initial state received:', response.data);
                    
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
    }, [addAlert]);

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
    }, [addAlert]);

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

    // Handle robot location updates
    const handleRobotLocationUpdate = useCallback((deviceId, robotId, payload) => {
        console.log('[Device] 🤖📍 Robot location update:', robotId, payload);

        setRobots(prev => ({
            ...prev,
            [deviceId]: {
                ...prev[deviceId],
                [robotId]: {
                    ...prev[deviceId]?.[robotId],
                    location: {
                        lat: payload.lat ?? payload.latitude ?? payload.y ?? prev[deviceId]?.[robotId]?.location?.lat,
                        lng: payload.lng ?? payload.longitude ?? payload.x ?? prev[deviceId]?.[robotId]?.location?.lng,
                        z: payload.z ?? payload.altitude ?? prev[deviceId]?.[robotId]?.location?.z
                    },
                    heading: payload.heading ?? payload.orientation ?? prev[deviceId]?.[robotId]?.heading,
                    lastUpdate: Date.now()
                }
            }
        }));
    }, []);

    // Handle robot temperature updates
    const handleRobotTempUpdate = useCallback((deviceId, robotId, payload) => {
        console.log('[Device] 🤖🌡️ Robot temp update:', robotId, payload);

        const temp = payload.temperature ?? payload.temp;

        setRobots(prev => ({
            ...prev,
            [deviceId]: {
                ...prev[deviceId],
                [robotId]: {
                    ...prev[deviceId]?.[robotId],
                    environment: {
                        ...prev[deviceId]?.[robotId]?.environment,
                        temp: temp ?? prev[deviceId]?.[robotId]?.environment?.temp,
                        humidity: payload.humidity ?? prev[deviceId]?.[robotId]?.environment?.humidity
                    },
                    lastUpdate: Date.now()
                }
            }
        }));

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
    }, [addAlert]);

    // Handle robot battery updates
    const handleRobotBatteryUpdate = useCallback((deviceId, robotId, payload) => {
        console.log('[Device] 🤖🔋 Robot battery update:', robotId, payload);

        const battery = payload.battery ?? payload.level ?? payload.percentage;

        setRobots(prev => ({
            ...prev,
            [deviceId]: {
                ...prev[deviceId],
                [robotId]: {
                    ...prev[deviceId]?.[robotId],
                    status: {
                        ...prev[deviceId]?.[robotId]?.status,
                        battery: battery ?? prev[deviceId]?.[robotId]?.status?.battery
                    },
                    lastUpdate: Date.now()
                }
            }
        }));

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

    // Subscribe to SELECTED device streams when connected or device changes
    useEffect(() => {
        if (!isConnected) {
            console.log('[FleetMS] ⏳ Waiting for STOMP connection...');
            return;
        }

        const deviceId = selectedDeviceId;
        const device = DEVICES.find(d => d.id === deviceId);

        console.log('');
        console.log('════════════════════════════════════════════════════════════');
        console.log('🔌 [FleetMS] SUBSCRIBING TO DEVICE:', deviceId);
        console.log('🏭 Device Name:', device?.name || 'Unknown');
        console.log('📍 Zone:', device?.zone || 'Unknown');
        console.log('════════════════════════════════════════════════════════════');
        console.log('');
        console.log('📡 [FleetMS] Device Topic Subscriptions:');
        console.log('────────────────────────────────────────────────────────────');

        // 1. Device Temperature Stream
        const tempTopic = TOPICS.DEVICE_TEMP(deviceId);
        console.log('🌡️  Temperature:', toMqttFormat(tempTopic));
        subscribe(tempTopic, (payload) => {
            console.log('[FleetMS] 🌡️ Temperature data received:', payload);
            handleTemperatureUpdate(deviceId, payload);
        });
        subscriptionsRef.current.push(tempTopic);

        // 2. Device AC State
        const acTopic = TOPICS.DEVICE_AC(deviceId);
        console.log('❄️  AC State:    ', toMqttFormat(acTopic));
        subscribe(acTopic, (payload) => {
            console.log('[FleetMS] ❄️ AC update received:', payload);
            handleACUpdate(deviceId, payload);
        });
        subscriptionsRef.current.push(acTopic);

        // 3. Device Status
        const statusTopic = TOPICS.DEVICE_STATUS(deviceId);
        console.log('📊 Status:     ', toMqttFormat(statusTopic));
        subscribe(statusTopic, (payload) => {
            console.log('[FleetMS] 📊 Status update received:', payload);
            handleDeviceStatusUpdate(deviceId, payload);
        });
        subscriptionsRef.current.push(statusTopic);

        // 4. Air Purifier State
        const airTopic = TOPICS.DEVICE_AIR(deviceId);
        console.log('🌬️  Air Purifier:', toMqttFormat(airTopic));
        subscribe(airTopic, (payload) => {
            console.log('[FleetMS] 🌬️ Air purifier update received:', payload);
            handleAirPurifierUpdate(deviceId, payload);
        });
        subscriptionsRef.current.push(airTopic);

        // 5. Robots Discovery Stream
        const robotsTopic = TOPICS.DEVICE_ROBOTS(deviceId);
        console.log('🤖 Robots:      ', toMqttFormat(robotsTopic));
        subscribe(robotsTopic, (payload) => {
            console.log('[FleetMS] 🤖 Robots data received:', payload);
            handleRobotsDiscovery(deviceId, payload);
        });
        subscriptionsRef.current.push(robotsTopic);

        console.log('────────────────────────────────────────────────────────────');
        console.log('✅ [FleetMS] Device subscriptions complete!');
        console.log('');

        return () => {
            console.log('');
            console.log('🧹 [FleetMS] Cleaning up subscriptions for device:', deviceId);
            subscriptionsRef.current.forEach(topic => {
                unsubscribe(topic);
            });
            subscriptionsRef.current = [];
            console.log('✅ [FleetMS] Cleanup complete');
            console.log('');
        };
    }, [isConnected, selectedDeviceId, subscribe, unsubscribe, handleTemperatureUpdate, handleACUpdate, handleDeviceStatusUpdate, handleAirPurifierUpdate, handleRobotsDiscovery]);

    // Subscribe to robot streams when robots are discovered for SELECTED device
    useEffect(() => {
        if (!isConnected) return;

        const deviceId = selectedDeviceId;
        const deviceRobots = robots[deviceId] || {};
        const robotIds = Object.keys(deviceRobots);

        if (robotIds.length === 0) return;

        robotIds.forEach(robotId => {
            // Check if already subscribed using TOPICS pattern
            const locationTopic = TOPICS.ROBOT_LOCATION(deviceId, robotId);
            if (subscriptionsRef.current.includes(locationTopic)) return;

            console.log('');
            console.log('════════════════════════════════════════════════════════════');
            console.log('🤖 [FleetMS] NEW ROBOT DISCOVERED:', robotId);
            console.log('🔗 Parent Device:', deviceId);
            console.log('════════════════════════════════════════════════════════════');
            console.log('');
            console.log('📡 [FleetMS] Robot Topic Subscriptions:');
            console.log('────────────────────────────────────────────────────────────');

            // Location
            console.log('📍 Location:   ', toMqttFormat(locationTopic));
            subscribe(locationTopic, (payload) => {
                handleRobotLocationUpdate(deviceId, robotId, payload);
            });
            subscriptionsRef.current.push(locationTopic);

            // Temperature
            const tempTopic = TOPICS.ROBOT_TEMP(deviceId, robotId);
            console.log('🌡️  Temperature:', toMqttFormat(tempTopic));
            subscribe(tempTopic, (payload) => {
                handleRobotTempUpdate(deviceId, robotId, payload);
            });
            subscriptionsRef.current.push(tempTopic);

            // Status
            const statusTopic = TOPICS.ROBOT_STATUS(deviceId, robotId);
            console.log('📊 Status:     ', toMqttFormat(statusTopic));
            subscribe(statusTopic, (payload) => {
                handleRobotStatusUpdate(deviceId, robotId, payload);
            });
            subscriptionsRef.current.push(statusTopic);

            // Battery
            const batteryTopic = TOPICS.ROBOT_BATTERY(deviceId, robotId);
            console.log('🔋 Battery:    ', toMqttFormat(batteryTopic));
            subscribe(batteryTopic, (payload) => {
                handleRobotBatteryUpdate(deviceId, robotId, payload);
            });
            subscriptionsRef.current.push(batteryTopic);

            // Tasks (stream)
            const taskTopic = TOPICS.ROBOT_TASKS(deviceId, robotId);
            console.log('📋 Tasks:      ', toMqttFormat(taskTopic));
            subscribe(taskTopic, (payload) => {
                handleRobotTaskUpdate(deviceId, robotId, payload);
            });
            subscriptionsRef.current.push(taskTopic);

            // Task updates (state)
            const taskUpdateTopic = TOPICS.ROBOT_TASK_UPDATE(deviceId, robotId);
            console.log('📋 Task Update:', toMqttFormat(taskUpdateTopic));
            subscribe(taskUpdateTopic, (payload) => {
                handleRobotTaskUpdate(deviceId, robotId, payload);
            });
            subscriptionsRef.current.push(taskUpdateTopic);

            console.log('────────────────────────────────────────────────────────────');
            console.log('✅ [FleetMS] Robot subscriptions complete for:', robotId);
            console.log('');
        });
    }, [isConnected, selectedDeviceId, robots, subscribe, handleRobotLocationUpdate, handleRobotTempUpdate, handleRobotStatusUpdate, handleRobotBatteryUpdate, handleRobotTaskUpdate]);

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
        registerRobot,
        refreshDeviceState
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
