/**
 * WebSocket Client Service
 * 
 * Manages STOMP WebSocket connection for real-time data updates.
 */

import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'wss://api.protonestconnect.co/ws';

// Topic constants
export const TOPICS = {
    STREAM: (deviceId) => `/topic/stream/${deviceId}`,
    STATE: (deviceId) => `/topic/state/${deviceId}`
};

// Convert frontend topic to MQTT format
export function toMqttFormat(topic) {
    return topic.replace(/\//g, '/');
}

class WebSocketClient {
    constructor() {
        this.client = null;
        this.subscriptions = new Map();
        this.connected = false;
        this.token = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
    }

    /**
     * Connect to WebSocket server
     * @param {string} token - JWT token for authentication
     */
    async connect(token) {
        if (this.connected && this.client?.active) {
            console.log('[WebSocket] Already connected');
            return;
        }

        this.token = token;

        return new Promise((resolve, reject) => {
            try {
                this.client = new Client({
                    webSocketFactory: () => new SockJS(WS_URL),
                    connectHeaders: {
                        'X-Token': token
                    },
                    debug: (str) => {
                        if (str.includes('CONNECTED') || str.includes('ERROR')) {
                            console.log('[WebSocket]', str);
                        }
                    },
                    reconnectDelay: this.reconnectDelay,
                    heartbeatIncoming: 10000,
                    heartbeatOutgoing: 10000,
                    onConnect: (frame) => {
                        console.log('[WebSocket] ✅ Connected successfully');
                        this.connected = true;
                        this.reconnectAttempts = 0;
                        resolve(frame);
                    },
                    onStompError: (frame) => {
                        console.error('[WebSocket] ❌ STOMP Error:', frame.headers?.message || 'Unknown error');
                        this.connected = false;
                        reject(new Error(frame.headers?.message || 'STOMP connection error'));
                    },
                    onDisconnect: () => {
                        console.log('[WebSocket] 🔌 Disconnected');
                        this.connected = false;
                    },
                    onWebSocketClose: (event) => {
                        console.log('[WebSocket] WebSocket closed:', event.reason || 'No reason');
                        this.connected = false;
                    },
                    onWebSocketError: (error) => {
                        console.error('[WebSocket] ❌ WebSocket Error:', error);
                        this.connected = false;
                    }
                });

                this.client.activate();
                console.log('[WebSocket] 🔗 Connecting to:', WS_URL);

            } catch (error) {
                console.error('[WebSocket] ❌ Connection failed:', error);
                reject(error);
            }
        });
    }

    /**
     * Disconnect from WebSocket server
     */
    disconnect() {
        if (this.client) {
            // Unsubscribe from all topics
            this.subscriptions.forEach((sub, topic) => {
                try {
                    sub.unsubscribe();
                    console.log('[WebSocket] Unsubscribed from:', topic);
                } catch (e) {
                    // Ignore unsubscribe errors during disconnect
                }
            });
            this.subscriptions.clear();

            // Deactivate client
            this.client.deactivate();
            this.connected = false;
            console.log('[WebSocket] 🔌 Disconnected');
        }
    }

    /**
     * Subscribe to a topic
     * @param {string} topic - Topic to subscribe to
     * @param {function} callback - Callback function for messages
     * @returns {object} Subscription object
     */
    subscribe(topic, callback) {
        if (!this.connected || !this.client?.active) {
            console.warn('[WebSocket] ⚠️ Cannot subscribe - not connected');
            return null;
        }

        // Check if already subscribed
        if (this.subscriptions.has(topic)) {
            console.log('[WebSocket] Already subscribed to:', topic);
            return this.subscriptions.get(topic);
        }

        try {
            const subscription = this.client.subscribe(topic, (message) => {
                try {
                    const data = JSON.parse(message.body);
                    console.log('[WebSocket] 📥 Message received on', topic);
                    callback(data);
                } catch (e) {
                    console.error('[WebSocket] ❌ Failed to parse message:', e);
                }
            });

            this.subscriptions.set(topic, subscription);
            console.log('[WebSocket] ✅ Subscribed to:', topic);
            return subscription;

        } catch (error) {
            console.error('[WebSocket] ❌ Subscribe failed:', error);
            return null;
        }
    }

    /**
     * Unsubscribe from a topic
     * @param {string} topic - Topic to unsubscribe from
     */
    unsubscribe(topic) {
        const subscription = this.subscriptions.get(topic);
        if (subscription) {
            try {
                subscription.unsubscribe();
                this.subscriptions.delete(topic);
                console.log('[WebSocket] Unsubscribed from:', topic);
            } catch (e) {
                console.error('[WebSocket] ❌ Unsubscribe failed:', e);
            }
        }
    }

    /**
     * Send a message to a destination
     * @param {string} destination - Destination path
     * @param {object} body - Message body
     */
    send(destination, body) {
        if (!this.connected || !this.client?.active) {
            console.warn('[WebSocket] ⚠️ Cannot send - not connected');
            return false;
        }

        try {
            this.client.publish({
                destination,
                body: JSON.stringify(body),
                headers: {
                    'X-Token': this.token
                }
            });
            console.log('[WebSocket] 📤 Message sent to:', destination);
            return true;
        } catch (error) {
            console.error('[WebSocket] ❌ Send failed:', error);
            return false;
        }
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.connected && this.client?.active;
    }
}

// Export singleton instance
export const webSocketClient = new WebSocketClient();

export default webSocketClient;
