/**
 * Fleet Management System - API Client
 *
 * Authentication: Authorization header (Bearer JWT) + HTTP-only cookies.
 * - A request interceptor attaches `Authorization: Bearer <token>` to every request.
 * - withCredentials: true ensures HTTP-only cookies (refresh token) travel too.
 * - On 401 → /get-new-token (cookie refresh) → fallback to full /get-token re-login.
 */

import axios from "axios";
import { getToken, refreshSession, login as reLogin } from "./authService";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true, // send cookies alongside Authorization header
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// ── Request Interceptor: attach Authorization header ──────────────
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token && token !== "__cookie_session__") {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: handle 401 with cookie refresh, plus logging
let isRefreshing = false;
let refreshQueue = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // On 401, attempt session refresh (once per request).
    // Skip if user hasn't authenticated yet (initial login flow).
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      getToken()
    ) {
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          let refreshed = await refreshSession();
          if (!refreshed) {
            // Cookie refresh failed — do a full re-login
            await reLogin();
          }
          isRefreshing = false;
          // Replay queued requests – the request interceptor will
          // attach the fresh JWT automatically from localStorage.
          refreshQueue.forEach((cb) => cb());
          refreshQueue = [];
          return api(originalRequest);
        } catch (refreshErr) {
          isRefreshing = false;
          refreshQueue = [];
          console.error("❌ Session refresh failed", refreshErr);
          return Promise.reject(refreshErr);
        }
      } else {
        // Queue while another refresh is in progress
        return new Promise((resolve) => {
          refreshQueue.push(() => {
            resolve(api(originalRequest));
          });
        });
      }
    }

    // Logging (debounced)
    try {
      if (!error.config?._silent) {
        const status = error.response?.status || "Network";
        const url = error.config?.url || "unknown";
        const key = `${status}:${url}`;
        const now = Date.now();
        if (
          !api._lastError ||
          api._lastError.key !== key ||
          now - api._lastError.time > 5000
        ) {
          api._lastError = { key, time: now };
          console.error(`❌ API Error [${status}] ${url}`);
        }
      }
    } catch (_) {
      console.error("❌ API Error", error);
    }
    return Promise.reject(error);
  },
);

/**
 * Utility: Generate ISO-8601 time range
 */
export function getTimeRange(rangeHours = 24) {
  const now = new Date();
  const start = new Date(
    now.getTime() - parseFloat(rangeHours) * 60 * 60 * 1000,
  );

  // Format: YYYY-MM-DDTHH:mm:ssZ (removing milliseconds)
  const format = (date) => date.toISOString().split(".")[0] + "Z";

  return {
    startTime: format(start),
    endTime: format(now),
  };
}

// ============================================================================
// CORE ENDPOINTS (As specified in User Request)
// ============================================================================

/**
 * 1. Fetch historical stream data for ALL topics on a device
 * POST /get-stream-data/device
 */
export async function getDeviceStreamData(
  deviceId,
  startTime,
  endTime,
  pagination = "0",
  pageSize = "100",
) {
  const response = await api.post("/get-stream-data/device", {
    deviceId,
    startTime,
    endTime,
    pagination: String(pagination),
    pageSize: String(pageSize),
  });
  return response.data;
}

/**
 * 2. Fetch historical stream data for a SPECIFIC topic
 * POST /get-stream-data/device/topic
 */
export async function getTopicStreamData(
  deviceId,
  topic,
  startTime,
  endTime,
  pagination = "0",
  pageSize = "100",
  { silent = false } = {},
) {
  const response = await api.post(
    "/get-stream-data/device/topic",
    {
      deviceId,
      topic,
      startTime,
      endTime,
      pagination: String(pagination),
      pageSize: String(pageSize),
    },
    { _silent: silent },
  );
  return response.data;
}

/**
 * 3. Fetch current state details for a SPECIFIC topic
 * POST /get-state-details/device/topic
 */
export async function getTopicStateDetails(deviceId, topic) {
  const response = await api.post("/get-state-details/device/topic", {
    deviceId,
    topic,
  });
  return response.data;
}

/**
 * 4. Fetch ALL current state details for a device
 * POST /get-state-details/device
 */
export async function getDeviceStateDetails(deviceId) {
  const response = await api.post("/get-state-details/device", {
    deviceId,
  });
  return response.data;
}

/**
 * Sequence helper: fetch state details for a specific topic, then fetch
 * the overall device state. Returns an object { topicState, deviceState }.
 */
export async function fetchTopicThenDeviceState(deviceId, topic) {
  try {
    const topicState = await getTopicStateDetails(deviceId, topic);
    const deviceState = await getDeviceStateDetails(deviceId);
    return { topicState, deviceState };
  } catch (err) {
    // Re-throw with context for callers to handle
    const e = new Error(`Failed to fetch topic/device state: ${err.message}`);
    e.original = err;
    throw e;
  }
}

/**
 * 5. Update device state (Control API)
 * POST /update-state-details
 */
export async function updateStateDetails(deviceId, topic, payload) {
  const response = await api.post("/update-state-details", {
    deviceId,
    topic,
    payload,
  });
  return response.data;
}

// ============================================================================
// CONVENIENCE HELPERS
// ============================================================================

/**
 * Helper to update AC state
 */
export async function toggleAC(deviceId, turnOn) {
  return updateStateDetails(deviceId, "fleetMS/ac", {
    status: turnOn ? "ON" : "OFF",
  });
}

/**
 * Helper to update Air Purifier state
 */
export async function setAirPurifier(deviceId, mode) {
  return updateStateDetails(deviceId, "fleetMS/airPurifier", {
    status: mode,
  });
}

/**
 * Legacy support for components using old names
 */
export const getAllStreamData = getDeviceStreamData;
export const getStreamData = getTopicStreamData;
export const getStateDetails = getDeviceStateDetails;
export const updateState = updateStateDetails;

export default api;
