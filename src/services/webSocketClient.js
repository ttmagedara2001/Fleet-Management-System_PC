/**
 * WebSocket Client for Fleet Management System
 *
 * STOMP-over-WebSocket client that:
 * - Connects with JWT token (encodedToken from /get-token API)
 * - Subscribes to device topics:
 *   - /topic/state/<deviceId>  - Device state updates
 *   - /topic/stream/<deviceId> - Device stream data
 *
 * Connection Flow:
 * ─────────────────────────────────────────────────────────────────
 * 1. Get JWT token from /get-token API (encodedToken)
 * 2. Connect to WebSocket: wss://api.protonestconnect.co/ws?token=<encodedToken>
 * 3. Subscribe to topics:
 *    - /topic/state/<deviceId>   - for state updates
 *    - /topic/stream/<deviceId>  - for stream data
 * ─────────────────────────────────────────────────────────────────
 */

import { Client } from "@stomp/stompjs";
import { getToken } from "./authService";

const WS_URL = import.meta.env.VITE_WS_URL;

// Normalize incoming message payloads and ensure timestamp/deviceId
function normalizeMessageData(raw, deviceIdHint = null) {
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : { ...raw };
    if (!data.timestamp) {
      data.timestamp = new Date().toISOString();
    }
    if (!data.deviceId && deviceIdHint) {
      data.deviceId = deviceIdHint;
    }
    return data;
  } catch (_) {
    return {
      deviceId: deviceIdHint || null,
      timestamp: new Date().toISOString(),
      payload: raw,
    };
  }
}

/**
 * Topic patterns for Fleet Management System
 * 
 * After WebSocket connection with JWT token (encodedToken from /get-token API):
 * - Subscribe to "state/<deviceId>" for state updates
 * - Subscribe to "stream/<deviceId>" for stream data
 * 
 * Note: Topics do NOT include /topic/ prefix - the STOMP broker handles routing
 */
export const TOPICS = {
  // Primary device topics (as per API specification)
  STATE: (deviceId) => `state/${deviceId}`,
  STREAM: (deviceId) => `stream/${deviceId}`,

  // Legacy aliases for backward compatibility
  DEVICE_TEMP: (deviceId) => `stream/${deviceId}`,
  DEVICE_AC: (deviceId) => `state/${deviceId}`,
  DEVICE_STATUS: (deviceId) => `state/${deviceId}`,
  DEVICE_AIR: (deviceId) => `state/${deviceId}`,
  DEVICE_ROBOTS: (deviceId) => `stream/${deviceId}`,

  // Robot-level topics (under device stream)
  ROBOT_LOCATION: (deviceId, robotId) =>
    `stream/${deviceId}/robots/${robotId}/location`,
  ROBOT_TEMP: (deviceId, robotId) =>
    `stream/${deviceId}/robots/${robotId}/temperature`,
  ROBOT_STATUS: (deviceId, robotId) =>
    `stream/${deviceId}/robots/${robotId}/status`,
  ROBOT_TASKS: (deviceId, robotId) =>
    `stream/${deviceId}/robots/${robotId}/tasks`,
  ROBOT_TASK_UPDATE: (deviceId, robotId) =>
    `state/${deviceId}/robots/${robotId}/tasks`,
  ROBOT_BATTERY: (deviceId, robotId) =>
    `stream/${deviceId}/robots/${robotId}/battery`,

  // Command destinations (for publishing)
  COMMAND: (deviceId, commandType) =>
    `state/${deviceId}/${commandType}`,
};

// Helper to convert STOMP topic to raw MQTT format (for display)
export const toMqttFormat = (stompTopic) => {
  return stompTopic.replace("/topic/", "");
};

class WebSocketClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.subscriptions = new Map();
    this.messageCallbacks = new Map();
    this.currentDeviceId = null;
    this.dataCallback = null;
  }

  /**
   * Connect to WebSocket server with JWT token
   * Returns a Promise that resolves when connected
   */
  connect(token = null) {
    return new Promise((resolve, reject) => {
      const jwtToken = token || getToken();

      if (!jwtToken) {
        console.error("❌ WEBSOCKET: No token available for connection");
        reject(new Error("No token available"));
        return;
      }

      // If already connected, resolve immediately
      if (this.isConnected && this.client?.active) {
        console.log("✅ WEBSOCKET: Already connected");
        resolve();
        return;
      }

      console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      );
      console.log("🔌 WEBSOCKET: Initiating connection...");
      console.log("🌐 URL:", WS_URL);
      console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      );

      const wsUrl = `${WS_URL}?token=${encodeURIComponent(jwtToken)}`;

      // Connection timeout
      const connectionTimeout = setTimeout(() => {
        console.error("❌ WEBSOCKET: Connection timeout");
        reject(new Error("Connection timeout"));
      }, 15000);

      this.client = new Client({
        brokerURL: wsUrl,
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,

        onConnect: (frame) => {
          clearTimeout(connectionTimeout);
          this.isConnected = true;
          console.log(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
          );
          console.log("✅ WEBSOCKET: Connected to broker!");
          console.log("📋 Session:", frame.headers?.session || "N/A");
          console.log("🔗 Server:", frame.headers?.server || "N/A");
          console.log(
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
          );
          resolve();
        },

        onDisconnect: () => {
          this.isConnected = false;
          console.log("🔌 WEBSOCKET: Disconnected");
        },

        onStompError: (frame) => {
          clearTimeout(connectionTimeout);
          const errorMsg = frame.headers?.message || "Unknown STOMP error";
          console.error("❌ STOMP Error:", errorMsg);
          console.error("📄 Details:", frame.body);
          this.isConnected = false;
          reject(new Error(errorMsg));
        },

        onWebSocketError: (error) => {
          clearTimeout(connectionTimeout);
          console.error("❌ WebSocket Error:", error);
          this.isConnected = false;
          reject(new Error("WebSocket connection error"));
        },

        onWebSocketClose: (event) => {
          this.isConnected = false;
          console.log(
            "🔌 WebSocket Closed (code:",
            event.code,
            ", reason:",
            event.reason || "none",
            ")"
          );
        },
      });

      this.client.activate();
    });
  }

  /**
   * Subscribe to a specific topic with a callback
   * @param {string} topic - The topic to subscribe to
   * @param {function} callback - Callback function receiving parsed JSON payload
   * @returns {string|null} - Subscription key or null if failed
   */
  subscribe(topic, callback) {
    if (!this.client || !this.isConnected) {
      console.warn("⚠️ Cannot subscribe - not connected");
      return null;
    }

    // Check if already subscribed
    if (this.subscriptions.has(topic)) {
      console.log("📡 Already subscribed to:", topic);
      // Update callback if provided
      if (callback) {
        this.messageCallbacks.set(topic, callback);
      }
      return topic;
    }

    console.log("📡 SUBSCRIBING to:", topic);

    // Generate a unique subscription ID
    const subscriptionId = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const subscription = this.client.subscribe(
      topic,
      (message) => {
        const bodyPreview = message.body?.substring(0, 100) || "";
        console.log(
          "📥 MESSAGE from",
          topic + ":",
          bodyPreview + (message.body?.length > 100 ? "..." : "")
        );

        const cb = this.messageCallbacks.get(topic);
        if (cb) {
          try {
            const data = JSON.parse(message.body);
            cb(data);
          } catch (e) {
            // If not JSON, pass raw body
            cb(message.body);
          }
        }
      },
      { id: subscriptionId } // Add subscription ID header
    );

    this.subscriptions.set(topic, subscription);
    if (callback) {
      this.messageCallbacks.set(topic, callback);
    }

    console.log("✅ Subscribed to:", topic);
    console.log("📊 Total active subscriptions:", this.subscriptions.size);

    return topic;
  }

  /**
   * Unsubscribe from a specific topic
   * @param {string} topic - The MQTT topic to unsubscribe from
   */
  unsubscribe(topic) {
    if (this.subscriptions.has(topic)) {
      try {
        this.subscriptions.get(topic).unsubscribe();
      } catch (e) {
        console.warn("⚠️ Error unsubscribing from", topic, ":", e.message);
      }
      this.subscriptions.delete(topic);
      this.messageCallbacks.delete(topic);
      console.log("🔕 Unsubscribed from:", topic);
    }
  }

  /**
   * Subscribe to a device's MQTT topics (legacy method for compatibility)
   */
  subscribeToDevice(deviceId, callback) {
    // If switching devices, clean up previous subscriptions
    if (this.currentDeviceId && this.currentDeviceId !== deviceId) {
      console.log(
        `[WebSocketClient] 🔄 Switching from ${this.currentDeviceId} to ${deviceId}`
      );
      this._unsubscribeFromDeviceTopics(this.currentDeviceId);
    }

    this.currentDeviceId = deviceId;
    this.dataCallback = callback;

    if (!this.client || !this.isConnected) {
      console.warn("⚠️ Cannot subscribe - not connected");
      return;
    }

    this._subscribeToDeviceTopics(deviceId);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📡 DEVICE SUBSCRIPTIONS ACTIVE for:", deviceId);
    console.log("📊 Total subscriptions:", this.subscriptions.size);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }

  /**
   * Unsubscribe from a device (legacy method)
   */
  unsubscribeFromDevice(deviceId) {
    this._unsubscribeFromDeviceTopics(deviceId);
    console.log("🔕 Unsubscribed from device:", deviceId);
  }

  _subscribeToDeviceTopics(deviceId) {
    const self = this;

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📡 Subscribing to device topics for: ${deviceId}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // 1) Subscribe to /topic/stream/<deviceId> - for sensor/stream data
    const streamTopic = TOPICS.STREAM(deviceId);
    if (!this.subscriptions.has(streamTopic)) {
      const sub = this.client.subscribe(streamTopic, (message) => {
        try {
          const rawData = JSON.parse(message.body);
          const data = normalizeMessageData(rawData, deviceId);
          console.log(`📡 [STREAM] ${streamTopic}:`, data);

          if (self.dataCallback && typeof data === "object") {
            // Handle stream data - extract all fields
            Object.keys(data).forEach((key) => {
              if (key !== "timestamp" && key !== "deviceId") {
                let value = data[key];
                // Convert string numbers to actual numbers
                if (typeof value === "string" && !isNaN(Number(value))) {
                  value = Number(value);
                }
                self.dataCallback({
                  sensorType: key,
                  value,
                  timestamp: data.timestamp,
                  source: "stream",
                });
              }
            });
          }
        } catch (err) {
          console.error(`❌ Error parsing stream message:`, err, message.body);
        }
      });
      this.subscriptions.set(streamTopic, sub);
      console.log(`✅ Subscribed to: ${streamTopic}`);
    }

    // 2) Subscribe to /topic/state/<deviceId> - for state/control data
    const stateTopic = TOPICS.STATE(deviceId);
    if (!this.subscriptions.has(stateTopic)) {
      const sub = this.client.subscribe(stateTopic, (message) => {
        try {
          const rawData = JSON.parse(message.body);
          const data = normalizeMessageData(rawData, deviceId);
          console.log(`📡 [STATE] ${stateTopic}:`, data);

          if (self.dataCallback && typeof data === "object") {
            // Handle state data - extract all fields
            Object.keys(data).forEach((key) => {
              if (key !== "timestamp" && key !== "deviceId") {
                self.dataCallback({
                  sensorType: key,
                  value: data[key],
                  timestamp: data.timestamp,
                  source: "state",
                });
              }
            });
          }
        } catch (err) {
          console.error(`❌ Error parsing state message:`, err, message.body);
        }
      });
      this.subscriptions.set(stateTopic, sub);
      console.log(`✅ Subscribed to: ${stateTopic}`);
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`✅ Device ${deviceId} subscriptions active`);
    console.log(`   - ${streamTopic}`);
    console.log(`   - ${stateTopic}`);
    console.log(`📊 Total subscriptions: ${this.subscriptions.size}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }

  _unsubscribeFromDeviceTopics(deviceId) {
    const keysToRemove = [];
    this.subscriptions.forEach((sub, topic) => {
      if (topic.includes(`/${deviceId}`) || topic.endsWith(`${deviceId}`)) {
        try {
          sub.unsubscribe();
          console.log(`🔕 Unsubscribed from ${topic}`);
        } catch (err) {
          console.warn(`⚠️ Error unsubscribing from ${topic}:`, err);
        }
        keysToRemove.push(topic);
      }
    });
    keysToRemove.forEach((t) => this.subscriptions.delete(t));
  }

  /**
   * Send command to device
   */
  sendCommand(deviceId, commandType, payload) {
    if (!this.isConnected) {
      console.error("❌ Cannot send command - not connected");
      return false;
    }

    const destination = TOPICS.COMMAND(deviceId, commandType);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📤 SENDING COMMAND");
    console.log("📍 Destination:", destination);
    console.log("📦 Payload:", JSON.stringify(payload));
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    this.client.publish({
      destination,
      body: JSON.stringify(payload),
    });

    console.log("✅ Command sent successfully");
    return true;
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    if (this.client) {
      console.log("🔌 WEBSOCKET: Disconnecting...");
      console.log("📊 Cleaning up", this.subscriptions.size, "subscriptions");

      this.subscriptions.forEach((sub, key) => {
        try {
          sub.unsubscribe();
        } catch (e) {
          console.warn("⚠️ Error unsubscribing from", key);
        }
      });
      this.subscriptions.clear();
      this.messageCallbacks.clear();
      this.client.deactivate();
      this.isConnected = false;
      console.log("✅ WEBSOCKET: Disconnected and cleaned up");
    }
  }

  /**
   * Check if connected
   */
  get connected() {
    return this.isConnected && this.client?.active;
  }

  /**
   * Get list of active subscriptions
   */
  getActiveSubscriptions() {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Print topics reference
   */
  static printTopicsReference() {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📚 WEBSOCKET TOPICS REFERENCE");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");
    console.log("CONNECTION:");
    console.log("  URL: wss://api.protonestconnect.co/ws?token=<encodedToken>");
    console.log("  Token: JWT from /get-token API");
    console.log("");
    console.log("DEVICE TOPICS (Subscribe after connection):");
    console.log("  /topic/state/<deviceId>   - Device state updates");
    console.log("  /topic/stream/<deviceId>  - Device stream data");
    console.log("");
    console.log("ROBOT TOPICS:");
    console.log("  /topic/stream/<deviceId>/robots/<robotId>/location");
    console.log("  /topic/stream/<deviceId>/robots/<robotId>/temperature");
    console.log("  /topic/stream/<deviceId>/robots/<robotId>/status");
    console.log("  /topic/stream/<deviceId>/robots/<robotId>/tasks");
    console.log("  /topic/stream/<deviceId>/robots/<robotId>/battery");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }
}

// Export singleton instance
export const webSocketClient = new WebSocketClient();
export default webSocketClient;
