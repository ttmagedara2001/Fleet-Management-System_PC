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
            return;
        }

        this.token = token;

        return new Promise((resolve, reject) => {
            try {
                const stompConfig = {
                    connectHeaders: {
                        'X-Token': token
                    },
                    debug: (str) => {
                        // Only log errors or specific important events if needed
                        if (str.includes('ERROR')) {
                            console.error('[WebSocket] STOMP Debug:', str);
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
                        this.connected = false;
                    },
                    onWebSocketError: (error) => {
                        console.error('[WebSocket] ❌ WebSocket Error');
                        this.connected = false;
                    }
                };

                // Use brokerURL for native WebSockets (ws://, wss://)
                // Use webSocketFactory for SockJS (http://, https://)
                if (WS_URL.startsWith('ws')) {
                    // Append token as query parameter as requested: wss://.../ws?token=xxx
                    stompConfig.brokerURL = `${WS_URL}${WS_URL.includes('?') ? '&' : '?'}token=${token}`;
                } else {
                    stompConfig.webSocketFactory = () => new SockJS(WS_URL);
                }

                this.client = new Client(stompConfig);

                this.client.activate();

            } catch (error) {
                console.error('[WebSocket] ❌ Connection attempt failed');
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
                } catch (e) {
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
            return null;
        }

        // Check if already subscribed
        if (this.subscriptions.has(topic)) {
            return this.subscriptions.get(topic);
        }

        try {
            const subscription = this.client.subscribe(topic, (message) => {
                try {
                    const data = JSON.parse(message.body);
                    callback(data);
                } catch (e) {
                    console.error('[WebSocket] ❌ Failed to parse message');
                }
            });

            this.subscriptions.set(topic, subscription);
            console.log('[WebSocket] ✅ Subscribed to:', topic);
            return subscription;

        } catch (error) {
            console.error('[WebSocket] ❌ Subscribe failed:', topic);
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
                console.log('[WebSocket] ✅ Unsubscribed from:', topic);
            } catch (e) {
                console.error('[WebSocket] ❌ Unsubscribe failed:', topic);
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
            return true;
        } catch (error) {
            console.error('[WebSocket] ❌ Send failed to:', destination);
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
