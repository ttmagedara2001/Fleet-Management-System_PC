/**
 * Fleet Management System - API Client
 *
 * Aligned with ProtoNest IoT Backend specifications:
 * - Header: "X-Token" (JWT)
 * - ISO-8601 Timestamps
 * - Stringified pagination parameters
 */

import axios from "axios";
import { getToken } from "./authService";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Automatically inject JWT token with the "X-Token" header
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers["X-Token"] = token;
  }
  // Ensure cookies are sent for cookie-based auth flows
  config.withCredentials = true;
  return config;
});

// Simplified Logging
api.interceptors.response.use(
  (response) => {
    // Only log success if needed, but avoid logging full URLs
    return response;
  },
  (error) => {
    console.error(`❌ API Error [${error.response?.status || "Network"}]`);
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
  const response = await api.post("/user/get-stream-data/device", {
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
) {
  const response = await api.post("/user/get-stream-data/device/topic", {
    deviceId,
    topic,
    startTime,
    endTime,
    pagination: String(pagination),
    pageSize: String(pageSize),
  });
  return response.data;
}

/**
 * 3. Fetch current state details for a SPECIFIC topic
 * POST /get-state-details/device/topic
 */
export async function getTopicStateDetails(deviceId, topic) {
  const response = await api.post("/user/get-state-details/device/topic", {
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
  const response = await api.post("/user/get-state-details/device", {
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
  const response = await api.post("/user/update-state-details", {
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
