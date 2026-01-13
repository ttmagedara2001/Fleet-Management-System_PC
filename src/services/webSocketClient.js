/**
 * Fleet Management System - WebSocket Client
 * Subscribes to /topic/stream/<deviceID> and /topic/state/<deviceID> only
 */

import { Client } from '@stomp/stompjs';

const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'wss://api.protonestconnect.co/ws';

// ==================== TOPIC HELPERS ====================

/**
 * Topic helper functions - simplified to only main topics
 */
export const TOPICS = {
  // Main device topics
  STREAM: (deviceId) => `/topic/protonest/${deviceId}/stream`,
  STATE: (deviceId) => `/topic/protonest/${deviceId}/state`,
  
  // Robot topics (for reference, but subscriptions happen via STREAM/STATE)
  ROBOT_LOCATION: (deviceId, robotId) => 
    `/topic/protonest/${deviceId}/stream/fleetMS/robots/${robotId}/location`,
  ROBOT_TEMP: (deviceId, robotId) => 
    `/topic/protonest/${deviceId}/stream/fleetMS/robots/${robotId}/temperature`,
  ROBOT_STATUS: (deviceId, robotId) => 
    `/topic/protonest/${deviceId}/stream/fleetMS/robots/${robotId}/status`,
  ROBOT_TASKS: (deviceId, robotId) => 
    `/topic/protonest/${deviceId}/stream/fleetMS/robots/${robotId}/tasks`,
  ROBOT_TASK_UPDATE: (deviceId, robotId) => 
    `/topic/protonest/${deviceId}/state/fleetMS/robots/${robotId}/tasks`,
  ROBOT_BATTERY: (deviceId, robotId) => 
    `/topic/protonest/${deviceId}/stream/fleetMS/robots/${robotId}/battery`,
};

/**
 * Convert STOMP topic to MQTT format (remove /topic/ prefix)
 */
export function toMqttFormat(stompTopic) {
  return stompTopic.replace(/^\/topic\//, '');
}

// ==================== WEBSOCKET CLIENT ====================

class WebSocketClient {
  constructor() {
    this.client = null;
    this.connected = false;
    this.subscriptions = new Map();
    this.onConnectCallbacks = [];
    this.onDisconnectCallbacks = [];
  }

  async connect(token) {
    if (this.connected && this.client) {
      console.log('[WebSocket] ✅ Already connected');
      return Promise.resolve();
    }

    if (!token) {
      throw new Error('JWT token is required for WebSocket connection');
    }

    return new Promise((resolve, reject) => {
      const encodedToken = encodeURIComponent(token);
      const wsUrl = `${WS_BASE_URL}?token=${encodedToken}`;

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔌 [WebSocket] Connecting to STOMP server...');
      console.log('🌐 URL:', WS_BASE_URL);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      this.client = new Client({
        brokerURL: wsUrl,
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,

        onConnect: (frame) => {
          console.log('✅ [WebSocket] STOMP connection established!');
          this.connected = true;
          this.onConnectCallbacks.forEach(cb => cb(frame));
          resolve();
        },

        onStompError: (frame) => {
          console.error('❌ [WebSocket] STOMP error:', frame.headers['message']);
          console.error('   Body:', frame.body);
          this.connected = false;
          reject(new Error(`STOMP error: ${frame.headers['message']}`));
        },

        onWebSocketError: (event) => {
          console.error('🚫 [WebSocket] WebSocket error:', event);
          this.connected = false;
          reject(new Error('WebSocket connection failed'));
        },

        onWebSocketClose: (event) => {
          console.warn('🔻 [WebSocket] Connection closed');
          this.connected = false;
          this.onDisconnectCallbacks.forEach(cb => cb(event));
        },

        onDisconnect: (frame) => {
          console.log('🔌 [WebSocket] Disconnected from STOMP');
          this.connected = false;
          this.onDisconnectCallbacks.forEach(cb => cb(frame));
        },

        debug: (msg) => {
          if (import.meta.env.DEV) {
            console.log('🪵 [WebSocket Debug]:', msg);
          }
        },
      });

      this.client.activate();
    });
  }

  disconnect() {
    if (this.client) {
      console.log('🔌 [WebSocket] Disconnecting...');
      
      this.subscriptions.forEach((subscription, topic) => {
        try {
          subscription.unsubscribe();
          console.log(`🔕 [WebSocket] Unsubscribed from: ${topic}`);
        } catch (error) {
          console.error(`❌ [WebSocket] Failed to unsubscribe from ${topic}:`, error);
        }
      });
      this.subscriptions.clear();

      this.client.deactivate();
      this.client = null;
      this.connected = false;
      console.log('✅ [WebSocket] Disconnected');
    }
  }

  subscribe(topic, callback) {
    if (!this.connected || !this.client) {
      console.warn('⚠️ [WebSocket] Cannot subscribe - not connected');
      return null;
    }

    if (this.subscriptions.has(topic)) {
      console.warn(`⚠️ [WebSocket] Already subscribed to: ${topic}`);
      return this.subscriptions.get(topic);
    }

    console.log(`📡 [WebSocket] Subscribing to: ${toMqttFormat(topic)}`);

    const subscription = this.client.subscribe(topic, (message) => {
      try {
        const payload = JSON.parse(message.body);
        console.log(`📥 [WebSocket] Message on ${toMqttFormat(topic)}:`, payload);
        callback(payload);
      } catch (error) {
        console.error(`❌ [WebSocket] Failed to parse message on ${topic}:`, error);
        console.error('   Raw body:', message.body);
      }
    });

    this.subscriptions.set(topic, subscription);
    return subscription;
  }

  unsubscribe(topic) {
    const subscription = this.subscriptions.get(topic);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(topic);
      console.log(`🔕 [WebSocket] Unsubscribed from: ${toMqttFormat(topic)}`);
    } else {
      console.warn(`⚠️ [WebSocket] No subscription found for: ${topic}`);
    }
  }

  subscribeToDevice(deviceId, callback) {
    console.log(`🔌 [WebSocket] Subscribing to device: ${deviceId}`);
    
    const streamTopic = TOPICS.STREAM(deviceId);
    const stateTopic = TOPICS.STATE(deviceId);
    
    this.subscribe(streamTopic, callback);
    this.subscribe(stateTopic, callback);
  }

  unsubscribeFromDevice(deviceId) {
    console.log(`🔕 [WebSocket] Unsubscribing from device: ${deviceId}`);
    
    const streamTopic = TOPICS.STREAM(deviceId);
    const stateTopic = TOPICS.STATE(deviceId);
    
    this.unsubscribe(streamTopic);
    this.unsubscribe(stateTopic);
  }

  sendCommand(deviceId, commandType, payload) {
    if (!this.connected || !this.client) {
      console.error('❌ [WebSocket] Cannot send command - not connected');
      return false;
    }

    const destination = `protonest/${deviceId}/state/fleetMS/${commandType}`;
    
    try {
      this.client.publish({
        destination,
        body: JSON.stringify(payload),
      });
      
      console.log(`📤 [WebSocket] Command sent to ${destination}:`, payload);
      return true;
    } catch (error) {
      console.error(`❌ [WebSocket] Failed to send command:`, error);
      return false;
    }
  }

  onConnect(callback) {
    this.onConnectCallbacks.push(callback);
  }

  onDisconnect(callback) {
    this.onDisconnectCallbacks.push(callback);
  }
}

// Export singleton instance
export const webSocketClient = new WebSocketClient();

export default webSocketClient;
