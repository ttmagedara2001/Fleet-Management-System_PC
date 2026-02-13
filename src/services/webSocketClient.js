/**
 * WebSocket Client — STOMP over WebSocket (JWT + Cookie Auth)
 *
 * Connection strategies (in priority order):
 *   1. wss://<host>/ws              – cookies sent automatically
 *   2. wss://<host>/ws?token=<jwt>  – fallback when cookies are blocked
 *
 * Must be initialised AFTER /get-token has been called at least once.
 *
 * @module webSocketClient
 */
import { Client } from "@stomp/stompjs";
import { getToken } from "./authService";

/** WebSocket broker endpoint from environment config. */
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
    console.error("[WS] connectWebSocket called without deviceId");
    return null;
  }

  const brokerURL = buildBrokerURL();

  const client = new Client({
    brokerURL,
    reconnectDelay: 5000,
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,

    // On reconnect the token may have been refreshed, so rebuild the URL
    beforeConnect: () => {
      client.brokerURL = buildBrokerURL();
    },

    onConnect: () => {
      // Subscribe to real-time stream topic
      client.subscribe(`/topic/stream/${deviceId}`, (message) => {
        if (!message.body) return;
        try {
          if (onStream) onStream(JSON.parse(message.body));
        } catch (e) {
          console.error("[WS] Failed to parse stream message", e);
        }
      });

      // Subscribe to device state topic
      client.subscribe(`/topic/state/${deviceId}`, (message) => {
        if (!message.body) return;
        try {
          if (onState) onState(JSON.parse(message.body));
        } catch (e) {
          console.error("[WS] Failed to parse state message", e);
        }
      });

      if (onConnected) onConnected();
    },

    onStompError: (frame) => {
      console.error("[WS] Broker error:", frame.headers["message"]);
      if (onDisconnected) onDisconnected();
    },

    onWebSocketError: () => {
      if (onDisconnected) onDisconnected();
    },

    onWebSocketClose: () => {
      if (onDisconnected) onDisconnected();
    },

    debug: (str) => {
      // console.log('[WS_DEBUG]', str);
    },
  });

  try {
    client.activate();
  } catch (err) {
    console.error("[WS] Failed to activate client:", err);
  }

  return client;
}
