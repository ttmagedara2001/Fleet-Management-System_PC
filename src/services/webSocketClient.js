/* ======================================================
   WEBSOCKET CONNECTION (Cookie-Based Auth)
   The browser sends HTTP-only cookies automatically during
   the WebSocket handshake — no token query param needed.
====================================================== */
import { Client } from "@stomp/stompjs";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws"; // Fallback for safety

/**
 * Connects to the WebSocket server using STOMP.
 *
 * @param {string} deviceId - The ID of the device to subscribe to.
 * @param {function} onStream - Callback for messages on /topic/stream/{deviceId}
 * @param {function} onState - Callback for messages on /topic/state/{deviceId}
 * @param {function} onConnected - Callback when connection is established
 * @param {function} onDisconnected - Callback when connection is lost or error occurs
 * @returns {Client} The STOMP client instance
 */
export function connectWebSocket(
  deviceId,
  onStream,
  onState,
  onConnected,
  onDisconnected,
) {
  if (!deviceId) {
    console.error("❌ connectWebSocket: No deviceId provided");
    return null;
  }

  console.log(
    `[WS] 🔌 Initializing WebSocket connection to ${WS_URL} for device: ${deviceId}`,
  );

  const client = new Client({
    brokerURL: WS_URL,
    reconnectDelay: 5000,
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,

    onConnect: (frame) => {
      console.log("[WS] ✅ Connected to Broker");

      // 🔔 Subscribe to Stream Topic
      console.log(`[WS] 🔔 Subscribing to /topic/stream/${deviceId}`);
      client.subscribe(`/topic/stream/${deviceId}`, (message) => {
        if (message.body) {
          try {
            const body = JSON.parse(message.body);
            console.log("[WS] 📨 Stream:", body);
            if (onStream) onStream(body);
          } catch (e) {
            console.error("[WS] ❌ Error parsing stream JSON:", e);
          }
        }
      });

      // 🔔 Subscribe to State Topic
      console.log(`[WS] 🔔 Subscribing to /topic/state/${deviceId}`);
      client.subscribe(`/topic/state/${deviceId}`, (message) => {
        if (message.body) {
          try {
            const body = JSON.parse(message.body);
            console.log("[WS] 📊 State update:", body);
            if (onState) onState(body);
          } catch (e) {
            console.error("[WS] ❌ Error parsing state JSON:", e);
          }
        }
      });

      if (onConnected) onConnected();
    },

    onStompError: (frame) => {
      console.error(
        "[WS] ❌ Broker reported error: " + frame.headers["message"],
      );
      console.error("[WS] Additional details: " + frame.body);
      if (onDisconnected) onDisconnected();
    },

    onWebSocketError: (event) => {
      console.error("[WS] 🚫 WebSocket connection error", event);
      if (onDisconnected) onDisconnected();
    },

    onWebSocketClose: (event) => {
      console.warn("[WS] 🔻 Connection closed", event);
      if (onDisconnected) onDisconnected();
    },

    // Optional: Log debug messages from the library
    debug: (str) => {
      // console.log('[WS_DEBUG]', str);
    },
  });

  try {
    client.activate();
  } catch (err) {
    console.error("[WS] 💥 Critical error activating client:", err);
  }

  return client;
}
