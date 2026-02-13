/* ======================================================
   WEBSOCKET CONNECTION (JWT + Cookie Auth)

   Two connection strategies (in priority order):
     1. wss://<host>/ws              – cookies are sent automatically
     2. wss://<host>/ws?token=<jwt>  – fallback if cookies are blocked

   IMPORTANT: The WebSocket must only be initialised AFTER
   /get-token has been called at least once (so the server
   has issued cookies / the JWT is available).
====================================================== */
import { Client } from "@stomp/stompjs";
import { getToken } from "./authService";

const WS_URL = import.meta.env.VITE_WS_URL;

/**
 * Build the broker URL.
 * If a JWT is available we append it as a query-param so the server can
 * authenticate even when the browser doesn't send cookies on the WS upgrade.
 */
function buildBrokerURL() {
  const token = getToken();
  if (token && token !== "__cookie_session__") {
    const separator = WS_URL.includes("?") ? "&" : "?";
    return `${WS_URL}${separator}token=${encodeURIComponent(token)}`;
  }
  // Rely on cookies alone
  return WS_URL;
}

/**
 * Connects to the WebSocket server using STOMP.
 *
 * @param {string} deviceId       - Device to subscribe to.
 * @param {function} onStream     - Callback for /topic/stream/{deviceId}
 * @param {function} onState      - Callback for /topic/state/{deviceId}
 * @param {function} onConnected  - Callback when connected
 * @param {function} onDisconnected - Callback on disconnect / error
 * @returns {Client} STOMP client instance
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

  const brokerURL = buildBrokerURL();
  console.log(
    `[WS] 🔌 Initializing WebSocket connection to ${brokerURL} for device: ${deviceId}`,
  );

  const client = new Client({
    brokerURL,
    reconnectDelay: 5000,
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,

    // On reconnect the token may have been refreshed, so rebuild the URL
    beforeConnect: () => {
      client.brokerURL = buildBrokerURL();
    },

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
