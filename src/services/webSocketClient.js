/**
 * Simple WebSocket Client
 *
 * STOMP-over-WebSocket client that:
 * - Connects with JWT token
 * - Subscribes to device topics
 * - Logs all activity to console
 *
 * MQTT Topics Structure (IoT Device Format):
 * ─────────────────────────────────────────────────────────────────
 * Raw MQTT (IoT Device):
 *   protonest/{deviceId}/stream/fleetMS/temperature      - Device temperature
 *   protonest/{deviceId}/state/fleetMS/ac                - AC state
 *   protonest/{deviceId}/state/fleetMS/status            - Device status
 *   protonest/{deviceId}/state/fleetMS/airPurifier       - Air purifier
 *   protonest/{deviceId}/stream/fleetMS/robots           - Robot discovery
 *
 * STOMP WebSocket Format (add /topic/ prefix):
 *   /topic/protonest/{deviceId}/stream/fleetMS/...
 *   /topic/protonest/{deviceId}/state/fleetMS/...
 *
 * Robot Topics (STOMP):
 *   /topic/protonest/{deviceId}/stream/fleetMS/robots/{robotId}/location
 *   /topic/protonest/{deviceId}/stream/fleetMS/robots/{robotId}/temperature
 *   /topic/protonest/{deviceId}/stream/fleetMS/robots/{robotId}/status
 *   /topic/protonest/{deviceId}/stream/fleetMS/robots/{robotId}/tasks
 *   /topic/protonest/{deviceId}/state/fleetMS/robots/{robotId}/tasks
 *   /topic/protonest/{deviceId}/stream/fleetMS/robots/{robotId}/battery
 * ─────────────────────────────────────────────────────────────────
 */

import { Client } from "@stomp/stompjs";
import { getToken } from "./authService";

const WS_URL = import.meta.env.VITE_WS_URL;

// Topic patterns for Fleet Management System
// STOMP format: /topic/protonest/{deviceId}/{stream|state}/fleetMS/{suffix}
export const TOPICS = {
  // Device-level topics (STOMP format)
  DEVICE_TEMP: (deviceId) =>
    `/topic/protonest/${deviceId}/stream/fleetMS/temperature`,
  DEVICE_AC: (deviceId) => `/topic/protonest/${deviceId}/state/fleetMS/ac`,
  DEVICE_STATUS: (deviceId) =>
    `/topic/protonest/${deviceId}/state/fleetMS/status`,
  DEVICE_AIR: (deviceId) =>
    `/topic/protonest/${deviceId}/state/fleetMS/airPurifier`,
  DEVICE_ROBOTS: (deviceId) =>
    `/topic/protonest/${deviceId}/stream/fleetMS/robots`,

  // Robot-level topics (STOMP format)
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

  // Command destinations (for publishing - raw MQTT format)
  COMMAND: (deviceId, commandType) =>
    `protonest/${deviceId}/state/fleetMS/${commandType}`,
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
   * @param {string} topic - The MQTT topic to subscribe to
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

    const subscription = this.client.subscribe(topic, (message) => {
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
    });

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
    if (!this.client || !this.isConnected) {
      console.warn("⚠️ Cannot subscribe - not connected");
      return;
    }

    // Subscribe to STREAM topic
    const streamTopic = TOPICS.DEVICE_STREAM(deviceId);
    this.subscribe(streamTopic, (data) => {
      if (callback) callback({ type: "stream", deviceId, data });
    });

    // Subscribe to STATE topic
    const stateTopic = TOPICS.DEVICE_STATE(deviceId);
    this.subscribe(stateTopic, (data) => {
      if (callback) callback({ type: "state", deviceId, data });
    });

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📡 DEVICE SUBSCRIPTIONS ACTIVE for:", deviceId);
    console.log("📊 Total subscriptions:", this.subscriptions.size);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }

  /**
   * Unsubscribe from a device (legacy method)
   */
  unsubscribeFromDevice(deviceId) {
    const streamTopic = TOPICS.DEVICE_STREAM(deviceId);
    const stateTopic = TOPICS.DEVICE_STATE(deviceId);

    this.unsubscribe(streamTopic);
    this.unsubscribe(stateTopic);

    console.log("🔕 Unsubscribed from device:", deviceId);
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
   * Print MQTT topics reference
   */
  static printTopicsReference() {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📚 MQTT TOPICS REFERENCE");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");
    console.log("DEVICE LEVEL (Subscribe):");
    console.log("  /topic/stream/{deviceId}           - Live telemetry stream");
    console.log("  /topic/state/{deviceId}            - Device state & alerts");
    console.log("");
    console.log("ROBOT LEVEL (Subscribe):");
    console.log(
      "  /topic/stream/{deviceId}/robots/{robotId}/location - GPS (10Hz)"
    );
    console.log(
      "  /topic/stream/{deviceId}/robots/{robotId}/env      - Environment (1Hz)"
    );
    console.log(
      "  /topic/stream/{deviceId}/robots/{robotId}/status   - Battery/State"
    );
    console.log(
      "  /topic/stream/{deviceId}/robots/{robotId}/tasks    - Task assignments"
    );
    console.log("");
    console.log("COMMANDS (Publish):");
    console.log(
      "  protonest/{deviceId}/state/{commandType}           - Send commands"
    );
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }
}

// Export singleton instance
export const webSocketClient = new WebSocketClient();
export default webSocketClient;
