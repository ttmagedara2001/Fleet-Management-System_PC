/**
 * WebSocket Client for IoT Dashboard
 * 
 * Singleton STOMP-over-WebSocket client with:
 * - JWT token authentication via URL query parameter
 * - Auto-reconnection with configurable delay
 * - Heartbeat monitoring for connection health
 * - Device-based topic subscriptions
 * - Bi-directional communication (receive sensor data, send commands)
 * 
 * @module webSocketClient
 */

import { Client } from '@stomp/stompjs';
import { autoAuthenticate, getCurrentToken } from './authService';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const WS_CONFIG = {
    // WebSocket server URL (without token)
    BASE_URL: import.meta.env?.VITE_WS_URL || 'wss://api.protonestconnect.co/ws',
    
    // Reconnection delay in milliseconds
    RECONNECT_DELAY: 5000,
    
    // Heartbeat intervals
    HEARTBEAT_INCOMING: 4000,
    HEARTBEAT_OUTGOING: 4000,
    
    // Connection timeout
    CONNECTION_TIMEOUT: 10000
};

// Topic patterns
const TOPICS = {
    STREAM: (deviceId) => `/topic/stream/${deviceId}`,
    STATE: (deviceId) => `/topic/state/${deviceId}`
};

// ═══════════════════════════════════════════════════════════════════════════
// LOGGING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const Logger = {
    info: (msg, ...args) => console.log(`[WebSocket] ${msg}`, ...args),
    warn: (msg, ...args) => console.warn(`[WebSocket] ⚠️ ${msg}`, ...args),
    error: (msg, ...args) => console.error(`[WebSocket] ❌ ${msg}`, ...args),
    success: (msg, ...args) => console.log(`[WebSocket] ✅ ${msg}`, ...args),
    debug: (msg, ...args) => {
        if (import.meta.env?.DEV) {
            console.log(`[WebSocket] 🐛 ${msg}`, ...args);
        }
    }
};

/**
 * Masks token for safe logging
 */
const maskToken = (token) => {
    if (!token) return 'null';
    if (token.length <= 10) return '***';
    return `${token.substring(0, 5)}...${token.substring(token.length - 5)}`;
};

// ═══════════════════════════════════════════════════════════════════════════
// WEBSOCKET CLIENT CLASS
// ═══════════════════════════════════════════════════════════════════════════

class WebSocketClient {
    constructor() {
        // STOMP client instance
        this.client = null;
        
        // Current state
        this.currentDeviceId = null;
        this.subscriptions = new Map();
        this.dataCallback = null;
        this.jwtToken = null;
        this.isReady = false;
        
        // Event listeners
        this.connectCallbacks = [];
        this.disconnectCallbacks = [];
        
        Logger.info('WebSocketClient instantiated');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // URL BUILDING
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Builds WebSocket URL with JWT token as query parameter
     * @param {string} token - JWT token
     * @returns {string} Full WebSocket URL
     */
    buildWebSocketUrl(token) {
        const encodedToken = encodeURIComponent(token);
        const url = `${WS_CONFIG.BASE_URL}?token=${encodedToken}`;
        
        Logger.debug('Built WebSocket URL:', `${WS_CONFIG.BASE_URL}?token=${maskToken(token)}`);
        
        return url;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONNECTION MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Connects to WebSocket server
     * @param {string} [token] - Optional JWT token (falls back to localStorage/auto-auth)
     * @returns {Promise<void>}
     */
    async connect(token = null) {
        Logger.info('Initiating connection...');

        // ─── Token Resolution ───
        // Priority: param → localStorage → environment auto-login
        let jwtToken = token;

        if (!jwtToken) {
            jwtToken = getCurrentToken();
            if (jwtToken) {
                Logger.info('Using token from localStorage');
            }
        }

        if (!jwtToken) {
            Logger.info('No token found, attempting auto-authentication...');
            try {
                const authResult = await autoAuthenticate();
                jwtToken = authResult.jwtToken;
                Logger.success('Auto-authentication successful');
            } catch (error) {
                Logger.error('Auto-authentication failed:', error.message);
                throw new Error('No valid token available for WebSocket connection');
            }
        }

        if (!jwtToken) {
            throw new Error('No valid token available for WebSocket connection');
        }

        this.jwtToken = jwtToken;
        Logger.info('Token acquired:', maskToken(jwtToken));

        // ─── Build URL ───
        const wsUrl = this.buildWebSocketUrl(jwtToken);

        // ─── Create or Reconnect Client ───
        if (this.client && this.client.active) {
            Logger.info('Client already connected');
            return;
        }

        if (this.client) {
            // Reconnect existing client
            Logger.info('Reconnecting existing client...');
            this.client.brokerURL = wsUrl;
            this.client.activate();
            return;
        }

        // ─── Create New Client ───
        Logger.info('Creating new STOMP client...');
        Logger.info('Broker URL:', WS_CONFIG.BASE_URL);

        this.client = new Client({
            brokerURL: wsUrl,
            reconnectDelay: WS_CONFIG.RECONNECT_DELAY,
            heartbeatIncoming: WS_CONFIG.HEARTBEAT_INCOMING,
            heartbeatOutgoing: WS_CONFIG.HEARTBEAT_OUTGOING,

            // ─── Connection Handlers ───
            onConnect: (frame) => {
                Logger.success('Connected to broker');
                Logger.info('Session:', frame.headers?.session || 'Unknown');
                
                this.isReady = true;

                // Subscribe to pending device if exists
                if (this.currentDeviceId && this.dataCallback) {
                    this._subscribeToDeviceTopics(this.currentDeviceId);
                }

                // Notify listeners
                this.connectCallbacks.forEach(cb => {
                    try { cb(frame); } catch (e) { Logger.error('Connect callback error:', e); }
                });
            },

            onDisconnect: (frame) => {
                Logger.info('Disconnected from broker');
                this.isReady = false;

                // Notify listeners
                this.disconnectCallbacks.forEach(cb => {
                    try { cb(frame); } catch (e) { Logger.error('Disconnect callback error:', e); }
                });
            },

            onStompError: (frame) => {
                Logger.error('STOMP Error:', frame.headers?.message || 'Unknown');
                if (frame.body) {
                    Logger.error('Details:', frame.body);
                }
            },

            onWebSocketError: (event) => {
                Logger.error('WebSocket Error');
            },

            onWebSocketClose: (event) => {
                Logger.info(`WebSocket Closed (code: ${event.code})`);
                this.isReady = false;
                
                if (event.code !== 1000) {
                    Logger.warn('Abnormal closure, will attempt reconnect...');
                }
            },

            debug: (msg) => {
                // Filter noisy messages
                if (!msg.includes('PING') && !msg.includes('PONG') && !msg.includes('>>>')) {
                    Logger.debug('STOMP:', msg);
                }
            }
        });

        // ─── Activate Client ───
        try {
            this.client.activate();
            Logger.info('Client activation initiated');
        } catch (error) {
            Logger.error('Client activation failed:', error.message);
            throw error;
        }
    }

    /**
     * Disconnects from WebSocket server
     */
    disconnect() {
        Logger.info('Disconnecting...');

        // Unsubscribe from all topics
        this.subscriptions.forEach((sub, key) => {
            Logger.debug('Unsubscribing:', key);
            try { sub.unsubscribe(); } catch (e) { /* ignore */ }
        });
        this.subscriptions.clear();

        // Deactivate client
        if (this.client) {
            try {
                this.client.deactivate();
                Logger.success('Client deactivated');
            } catch (e) {
                Logger.warn('Deactivation error:', e.message);
            }
        }

        this.isReady = false;
        this.currentDeviceId = null;
        
        Logger.success('Disconnected');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SUBSCRIPTION MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Subscribes to a device's topics
     * @param {string} deviceId - Device identifier
     * @param {Function} callback - Data callback function
     */
    subscribeToDevice(deviceId, callback) {
        Logger.info('Subscribing to device:', deviceId);

        // Unsubscribe from previous device if different
        if (this.currentDeviceId && this.currentDeviceId !== deviceId) {
            Logger.info('Switching from device:', this.currentDeviceId);
            this._unsubscribeFromDevice(this.currentDeviceId);
        }

        // Store for later use
        this.currentDeviceId = deviceId;
        this.dataCallback = callback;

        // Subscribe if connection is ready
        if (this.isReady) {
            this._subscribeToDeviceTopics(deviceId);
        } else {
            Logger.info('Connection not ready, subscription queued');
        }
    }

    /**
     * Internal: Subscribe to device topics
     */
    _subscribeToDeviceTopics(deviceId) {
        // Stream topic - sensor data
        const streamTopic = TOPICS.STREAM(deviceId);
        const streamKey = `stream-${deviceId}`;
        
        if (!this.subscriptions.has(streamKey)) {
            Logger.info('Subscribing to stream:', streamTopic);
            const streamSub = this.client.subscribe(streamTopic, (message) => {
                this._handleStreamMessage(message, deviceId);
            });
            this.subscriptions.set(streamKey, streamSub);
            Logger.success('Subscribed to:', streamTopic);
        }

        // State topic - device state updates
        const stateTopic = TOPICS.STATE(deviceId);
        const stateKey = `state-${deviceId}`;
        
        if (!this.subscriptions.has(stateKey)) {
            Logger.info('Subscribing to state:', stateTopic);
            const stateSub = this.client.subscribe(stateTopic, (message) => {
                this._handleStateMessage(message, deviceId);
            });
            this.subscriptions.set(stateKey, stateSub);
            Logger.success('Subscribed to:', stateTopic);
        }
    }

    /**
     * Internal: Unsubscribe from device topics
     */
    _unsubscribeFromDevice(deviceId) {
        const streamKey = `stream-${deviceId}`;
        const stateKey = `state-${deviceId}`;

        if (this.subscriptions.has(streamKey)) {
            Logger.debug('Unsubscribing from stream:', deviceId);
            this.subscriptions.get(streamKey).unsubscribe();
            this.subscriptions.delete(streamKey);
        }

        if (this.subscriptions.has(stateKey)) {
            Logger.debug('Unsubscribing from state:', deviceId);
            this.subscriptions.get(stateKey).unsubscribe();
            this.subscriptions.delete(stateKey);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MESSAGE HANDLING
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Handles incoming stream messages
     */
    _handleStreamMessage(message, deviceId) {
        try {
            const data = JSON.parse(message.body);
            Logger.debug('Stream message for', deviceId, ':', JSON.stringify(data).substring(0, 100));

            // Extract payload
            const payload = data.payload || data;
            const timestamp = data.timestamp || new Date().toISOString();

            // Check if batch update (multiple values)
            const keys = Object.keys(payload);
            if (keys.length > 2) {
                // Batch update - process all sensor values
                this._processBatchUpdate(payload, timestamp, deviceId);
            } else {
                // Single update - use topic field or scan for known sensors
                const sensorType = data.topic || this._detectSensorType(payload);
                if (sensorType && this.dataCallback) {
                    this.dataCallback({
                        type: 'stream',
                        deviceId,
                        sensorType,
                        value: payload[sensorType] || payload.value || payload,
                        timestamp
                    });
                }
            }

        } catch (error) {
            Logger.error('Failed to parse stream message:', error.message);
        }
    }

    /**
     * Handles incoming state messages
     */
    _handleStateMessage(message, deviceId) {
        try {
            const data = JSON.parse(message.body);
            Logger.debug('State message for', deviceId, ':', JSON.stringify(data).substring(0, 100));

            if (this.dataCallback) {
                this.dataCallback({
                    type: 'state',
                    deviceId,
                    payload: data.payload || data,
                    timestamp: data.timestamp || new Date().toISOString()
                });
            }

        } catch (error) {
            Logger.error('Failed to parse state message:', error.message);
        }
    }

    /**
     * Processes batch sensor updates
     */
    _processBatchUpdate(payload, timestamp, deviceId) {
        const sensorMappings = {
            'temp': 'temperature',
            'temperature': 'temperature',
            'ambient_temp': 'temperature',
            'hum': 'humidity',
            'humidity': 'humidity',
            'ambient_hum': 'humidity',
            'pressure': 'pressure',
            'ambient_pressure': 'pressure',
            'battery': 'battery',
            'battery_level': 'battery'
        };

        Object.entries(payload).forEach(([key, value]) => {
            const normalizedType = sensorMappings[key.toLowerCase()] || key;
            
            if (this.dataCallback) {
                this.dataCallback({
                    type: 'stream',
                    deviceId,
                    sensorType: normalizedType,
                    value,
                    timestamp
                });
            }
        });
    }

    /**
     * Detects sensor type from payload keys
     */
    _detectSensorType(payload) {
        const knownSensors = ['temp', 'temperature', 'humidity', 'hum', 'pressure', 'battery'];
        
        for (const key of Object.keys(payload)) {
            if (knownSensors.includes(key.toLowerCase())) {
                return key;
            }
        }
        
        return null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // COMMAND PUBLISHING
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Sends a command to a device
     * @param {string} deviceId - Device identifier
     * @param {string} commandType - Command type/topic suffix
     * @param {Object} payload - Command payload
     * @returns {boolean} Success status
     */
    sendCommand(deviceId, commandType, payload) {
        if (!this.isReady || !this.client?.active) {
            Logger.error('Cannot send command - not connected');
            return false;
        }

        const destination = `protonest/${deviceId}/state/${commandType}`;
        
        Logger.info('Sending command to:', destination);
        Logger.debug('Payload:', JSON.stringify(payload));

        try {
            this.client.publish({
                destination,
                body: JSON.stringify(payload)
            });
            Logger.success('Command sent');
            return true;
        } catch (error) {
            Logger.error('Failed to send command:', error.message);
            return false;
        }
    }

    /**
     * Sends emergency stop command
     */
    emergencyStop(deviceId) {
        return this.sendCommand(deviceId, 'emergency/stop', {
            emergency_stop: true,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Controls AC state
     */
    controlAC(deviceId, state) {
        return this.sendCommand(deviceId, 'control/ac', {
            ac_power: state ? 'ON' : 'OFF'
        });
    }

    /**
     * Controls air purifier state
     */
    controlAirPurifier(deviceId, state) {
        return this.sendCommand(deviceId, 'control/air_purifier', {
            air_purifier: state ? 'ON' : 'OFF'
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT LISTENERS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Registers a connection callback
     * @param {Function} callback - Callback function
     */
    onConnect(callback) {
        this.connectCallbacks.push(callback);
        
        // If already connected, call immediately
        if (this.isReady) {
            try { callback(); } catch (e) { Logger.error('Connect callback error:', e); }
        }
    }

    /**
     * Removes a connection callback
     */
    offConnect(callback) {
        this.connectCallbacks = this.connectCallbacks.filter(cb => cb !== callback);
    }

    /**
     * Registers a disconnection callback
     */
    onDisconnect(callback) {
        this.disconnectCallbacks.push(callback);
    }

    /**
     * Removes a disconnection callback
     */
    offDisconnect(callback) {
        this.disconnectCallbacks = this.disconnectCallbacks.filter(cb => cb !== callback);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UTILITY METHODS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Returns connection status
     */
    get connected() {
        return this.isReady && this.client?.active;
    }

    /**
     * Returns current device ID
     */
    get deviceId() {
        return this.currentDeviceId;
    }

    /**
     * Returns active subscription count
     */
    get subscriptionCount() {
        return this.subscriptions.size;
    }

    /**
     * Returns connection info for debugging
     */
    getConnectionInfo() {
        return {
            connected: this.connected,
            ready: this.isReady,
            deviceId: this.currentDeviceId,
            subscriptions: Array.from(this.subscriptions.keys()),
            hasToken: !!this.jwtToken,
            brokerUrl: WS_CONFIG.BASE_URL
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export const webSocketClient = new WebSocketClient();

// Development utilities
if (import.meta.env?.DEV) {
    window.webSocketClient = webSocketClient;
    
    // Add debug commands
    window.wsDebug = {
        info: () => console.table(webSocketClient.getConnectionInfo()),
        connect: (token) => webSocketClient.connect(token),
        disconnect: () => webSocketClient.disconnect(),
        subscribe: (deviceId) => webSocketClient.subscribeToDevice(deviceId, console.log),
        sendCommand: (deviceId, cmd, payload) => webSocketClient.sendCommand(deviceId, cmd, payload)
    };
    
    console.log('[WebSocket] 🛠️ Dev utilities available: window.wsDebug');
}

export default webSocketClient;
