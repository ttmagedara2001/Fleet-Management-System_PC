/**
 * Simple WebSocket Client
 * 
 * STOMP-over-WebSocket client that:
 * - Connects with JWT token
 * - Subscribes to device topics
 * - Logs all activity to console
 */

import { Client } from '@stomp/stompjs';
import { getToken } from './authService';

const WS_URL = import.meta.env.VITE_WS_URL;

// Topics to subscribe
const TOPICS = {
    STREAM: (deviceId) => `/topic/stream/${deviceId}`,
    STATE: (deviceId) => `/topic/state/${deviceId}`
};

class WebSocketClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.subscriptions = new Map();
        this.dataCallback = null;
    }

    /**
     * Connect to WebSocket server with JWT token
     */
    async connect(token = null) {
        const jwtToken = token || getToken();

        if (!jwtToken) {
            console.error('❌ WEBSOCKET: No token available for connection');
            throw new Error('No token available');
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔌 WEBSOCKET: Initiating connection...');
        console.log('🌐 URL:', WS_URL);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const wsUrl = `${WS_URL}?token=${encodeURIComponent(jwtToken)}`;

        this.client = new Client({
            brokerURL: wsUrl,
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,

            onConnect: (frame) => {
                this.isConnected = true;
                console.log('✅ WEBSOCKET: Connected to broker!');
                console.log('📋 Session:', frame.headers?.session || 'N/A');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            },

            onDisconnect: () => {
                this.isConnected = false;
                console.log('🔌 WEBSOCKET: Disconnected');
            },

            onStompError: (frame) => {
                console.error('❌ STOMP Error:', frame.headers?.message);
            },

            onWebSocketError: () => {
                console.error('❌ WebSocket Error');
            },

            onWebSocketClose: (event) => {
                this.isConnected = false;
                console.log('🔌 WebSocket Closed (code:', event.code, ')');
            }
        });

        this.client.activate();
    }

    /**
     * Subscribe to a device's MQTT topics
     */
    subscribeToDevice(deviceId, callback) {
        if (!this.client || !this.isConnected) {
            console.warn('⚠️ Cannot subscribe - not connected');
            return;
        }

        this.dataCallback = callback;

        // Subscribe to STREAM topic
        const streamTopic = TOPICS.STREAM(deviceId);
        console.log('📡 SUBSCRIBING to:', streamTopic);
        
        const streamSub = this.client.subscribe(streamTopic, (message) => {
            console.log('📥 STREAM MESSAGE from', deviceId + ':', message.body.substring(0, 100) + '...');
            if (callback) {
                try {
                    const data = JSON.parse(message.body);
                    callback({ type: 'stream', deviceId, data });
                } catch (e) {
                    callback({ type: 'stream', deviceId, data: message.body });
                }
            }
        });
        this.subscriptions.set(`stream-${deviceId}`, streamSub);
        console.log('✅ Subscribed to:', streamTopic);

        // Subscribe to STATE topic
        const stateTopic = TOPICS.STATE(deviceId);
        console.log('📡 SUBSCRIBING to:', stateTopic);
        
        const stateSub = this.client.subscribe(stateTopic, (message) => {
            console.log('📥 STATE MESSAGE from', deviceId + ':', message.body.substring(0, 100) + '...');
            if (callback) {
                try {
                    const data = JSON.parse(message.body);
                    callback({ type: 'state', deviceId, data });
                } catch (e) {
                    callback({ type: 'state', deviceId, data: message.body });
                }
            }
        });
        this.subscriptions.set(`state-${deviceId}`, stateSub);
        console.log('✅ Subscribed to:', stateTopic);

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📡 ACTIVE SUBSCRIPTIONS:', this.subscriptions.size);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    /**
     * Unsubscribe from a device
     */
    unsubscribeFromDevice(deviceId) {
        const streamKey = `stream-${deviceId}`;
        const stateKey = `state-${deviceId}`;

        if (this.subscriptions.has(streamKey)) {
            this.subscriptions.get(streamKey).unsubscribe();
            this.subscriptions.delete(streamKey);
            console.log('🔕 Unsubscribed from stream:', deviceId);
        }

        if (this.subscriptions.has(stateKey)) {
            this.subscriptions.get(stateKey).unsubscribe();
            this.subscriptions.delete(stateKey);
            console.log('🔕 Unsubscribed from state:', deviceId);
        }
    }

    /**
     * Send command to device
     */
    sendCommand(deviceId, commandType, payload) {
        if (!this.isConnected) {
            console.error('❌ Cannot send command - not connected');
            return false;
        }

        const destination = `protonest/${deviceId}/state/${commandType}`;
        console.log('📤 SENDING COMMAND to:', destination);
        console.log('📦 Payload:', JSON.stringify(payload));

        this.client.publish({
            destination,
            body: JSON.stringify(payload)
        });

        console.log('✅ Command sent');
        return true;
    }

    /**
     * Disconnect from WebSocket
     */
    disconnect() {
        if (this.client) {
            this.subscriptions.forEach((sub, key) => {
                try { sub.unsubscribe(); } catch (e) { }
            });
            this.subscriptions.clear();
            this.client.deactivate();
            this.isConnected = false;
            console.log('🔌 WEBSOCKET: Disconnected and cleaned up');
        }
    }

    /**
     * Check if connected
     */
    get connected() {
        return this.isConnected && this.client?.active;
    }
}

// Export singleton instance
export const webSocketClient = new WebSocketClient();
export default webSocketClient;
