/**
 * Fleet Management System - API Client
 *
 * Axios client with automatic token attachment from localStorage.
 * Full implementation of ProtoNest IoT Backend API endpoints.
 */

import axios from "axios";
import { getToken } from "./authService";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Add token to every request via X-Token header
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers["X-Token"] = token;
  }
  return config;
});

// Log responses and handle errors
api.interceptors.response.use(
  (response) => {
    console.log("📥 API Response:", response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error("❌ API Error:", error.response?.status, error.config?.url);

    // Handle specific error cases
    if (error.response?.status === 401) {
      console.warn("🔐 Unauthorized - token may be expired");
      // Could trigger token refresh here
    }

    return Promise.reject(error);
  }
);

// ==================== TIME UTILITY ====================

/**
 * Get time range for API calls
 * @param {string} range - Time range: '1m', '5m', '15m', '1h', '6h', '24h', '7d', '30d'
 * @returns {{ startTime: string, endTime: string }}
 */
export function getTimeRange(range) {
  const now = new Date();
  const rangeMs = {
    "1m": 1 * 60 * 1000,
    "5m": 5 * 60 * 1000,
    "15m": 15 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "6h": 6 * 60 * 60 * 1000,
    "12h": 12 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };

  const startDate = new Date(
    now.getTime() - (rangeMs[range] || rangeMs["24h"])
  );

  return {
    startTime: startDate.toISOString().split(".")[0] + "Z",
    endTime: now.toISOString().split(".")[0] + "Z",
  };
}

// ==================== STREAM DATA APIs ====================

/**
 * Get stream data for a specific device topic
 * POST /get-stream-data/device/topic
 *
 * @param {string} deviceId - Device ID (e.g., 'device9988')
 * @param {string} topic - Topic suffix (e.g., 'fleetMS/temperature')
 * @param {string} startTime - ISO-8601 start time
 * @param {string} endTime - ISO-8601 end time
 * @param {number} pagination - Page number (will be converted to string)
 * @param {number} pageSize - Results per page (will be converted to string)
 */
export async function getStreamData(
  deviceId,
  topic,
  startTime,
  endTime,
  pagination = 0,
  pageSize = 100
) {
  console.log('[API] 📡 POST /get-stream-data/device/topic');
  console.log('[API] Request payload:', {
    deviceId,
    topic,
    startTime,
    endTime,
    pagination: String(pagination),
    pageSize: String(pageSize)
  });
  
  const response = await api.post("/get-stream-data/device/topic", {
    deviceId,
    topic,
    startTime,
    endTime,
    pagination: String(pagination), // API requires string
    pageSize: String(pageSize), // API requires string
  });
  
  console.log('[API] ✅ /get-stream-data/device/topic response:', response.data.status);
  return response.data;
}

/**
 * Get ALL stream data for a device (all sensor topics)
 * POST /get-stream-data/device
 *
 * @param {string} deviceId - Device ID
 * @param {string} startTime - ISO-8601 start time
 * @param {string} endTime - ISO-8601 end time
 * @param {number} pagination - Page number
 * @param {number} pageSize - Results per page
 */
export async function getAllStreamData(
  deviceId,
  startTime,
  endTime,
  pagination = 0,
  pageSize = 100
) {
  console.log('[API] 📡 POST /get-stream-data/device');
  console.log('[API] Request payload:', {
    deviceId,
    startTime,
    endTime,
    pagination: String(pagination),
    pageSize: String(pageSize)
  });
  
  const response = await api.post("/get-stream-data/device", {
    deviceId,
    startTime,
    endTime,
    pagination: String(pagination),
    pageSize: String(pageSize),
  });
  
  console.log('[API] ✅ /get-stream-data/device response:', response.data.status);
  return response.data;
}

/**
 * Get stream data for ALL user's devices
 * POST /get-stream-data/user
 *
 * @param {string} startTime - ISO-8601 start time
 * @param {string} endTime - ISO-8601 end time
 * @param {number} pagination - Page number
 * @param {number} pageSize - Results per page
 */
export async function getUserStreamData(
  startTime,
  endTime,
  pagination = 0,
  pageSize = 100
) {
  const response = await api.post("/get-stream-data/user", {
    startTime,
    endTime,
    pagination: String(pagination),
    pageSize: String(pageSize),
  });
  return response.data;
}

// ==================== STATE DATA APIs ====================

/**
 * Get ALL current states for a device
 * POST /get-state-details/device
 *
 * @param {string} deviceId - Device ID
 */
export async function getStateDetails(deviceId) {
  console.log('[API] 📡 POST /get-state-details/device');
  console.log('[API] Request payload:', { deviceId });
  
  const response = await api.post("/get-state-details/device", { deviceId });
  
  console.log('[API] ✅ /get-state-details/device response:', response.data.status);
  return response.data;
}

/**
 * Get specific state for a device topic
 * POST /get-state-details/device/topic
 *
 * @param {string} deviceId - Device ID
 * @param {string} topic - State topic (e.g., 'fleetMS/ac')
 */
export async function getStateDetailsByTopic(deviceId, topic) {
  console.log('[API] 📡 POST /get-state-details/device/topic');
  console.log('[API] Request payload:', { deviceId, topic });
  
  const response = await api.post("/get-state-details/device/topic", {
    deviceId,
    topic,
  });
  
  console.log('[API] ✅ /get-state-details/device/topic response:', response.data.status);
  return response.data;
}

/**
 * Update device state (primary control API)
 * POST /update-state-details
 *
 * @param {string} deviceId - Device ID
 * @param {string} topic - State topic (e.g., 'fleetMS/ac', 'fleetMS/airPurifier')
 * @param {object} payload - State payload (e.g., { status: 'ON' })
 */
export async function updateState(deviceId, topic, payload) {
  const response = await api.post("/update-state-details", {
    deviceId,
    topic,
    payload,
  });
  return response.data;
}

// ==================== DATA DELETION APIs ====================

/**
 * Delete specific stream data records by ID
 * DELETE /delete-stream-data-by-id
 *
 * @param {string} deviceId - Device ID
 * @param {string} topic - Topic suffix
 * @param {string[]} dataIds - Array of record IDs to delete
 */
export async function deleteStreamData(deviceId, topic, dataIds) {
  const response = await api.delete("/delete-stream-data-by-id", {
    data: {
      deviceId,
      topic,
      dataIds,
    },
  });
  return response.data;
}

/**
 * Delete an entire state topic for a device
 * DELETE /delete-state-topic
 *
 * @param {string} deviceId - Device ID
 * @param {string} topic - Topic to delete
 */
export async function deleteStateTopic(deviceId, topic) {
  const response = await api.delete("/delete-state-topic", {
    data: {
      deviceId,
      topic,
    },
  });
  return response.data;
}

// ==================== CONVENIENCE FUNCTIONS ====================

/**
 * Fetch historical chart data for a specific metric
 *
 * @param {string} deviceId - Device ID
 * @param {string} metric - Metric name (temperature, humidity, pressure)
 * @param {string} timeRange - Time range (1h, 6h, 12h, 24h, 7d)
 * @returns {Promise<Array>} - Transformed data for charts
 */
export async function fetchChartData(deviceId, metric, timeRange = "6h") {
  const { startTime, endTime } = getTimeRange(timeRange);

  try {
    const response = await getStreamData(
      deviceId,
      `fleetMS/${metric}`,
      startTime,
      endTime,
      0,
      500
    );

    if (response.status === "Success" && response.data) {
      return response.data.map((record) => ({
        timestamp: new Date(record.timestamp).getTime(),
        time: new Date(record.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        fullTime: record.timestamp,
        value: parseFloat(record.payload) || 0,
      }));
    }

    return [];
  } catch (error) {
    console.error(`[API] Failed to fetch ${metric} chart data:`, error);
    return [];
  }
}

/**
 * Fetch all sensor data for charts (temperature, humidity, pressure combined)
 *
 * @param {string} deviceId - Device ID
 * @param {string} timeRange - Time range
 * @returns {Promise<Array>} - Combined chart data
 */
export async function fetchAllChartData(deviceId, timeRange = "6h") {
  const { startTime, endTime } = getTimeRange(timeRange);

  try {
    const response = await getAllStreamData(
      deviceId,
      startTime,
      endTime,
      0,
      500
    );

    if (response.status === "Success" && response.data) {
      return response.data.map((record) => ({
        timestamp: new Date(record.timestamp).getTime(),
        time: new Date(record.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        fullTime: record.timestamp,
        temp: record.temperature ?? null,
        humidity: record.humidity ?? null,
        pressure: record.pressure ?? null,
      }));
    }

    return [];
  } catch (error) {
    console.error("[API] Failed to fetch all chart data:", error);
    return [];
  }
}

// ==================== DEVICE CONTROL HELPERS ====================

/**
 * Toggle AC power state
 * @param {string} deviceId - Device ID
 * @param {boolean} turnOn - true to turn ON, false to turn OFF
 */
export async function toggleAC(deviceId, turnOn) {
  return updateState(deviceId, "fleetMS/ac", {
    status: turnOn ? "ON" : "OFF",
  });
}

/**
 * Set air purifier mode
 * @param {string} deviceId - Device ID
 * @param {'ACTIVE'|'INACTIVE'|'MAINTENANCE'} mode - Air purifier mode
 */
export async function setAirPurifier(deviceId, mode) {
  return updateState(deviceId, "fleetMS/airPurifier", {
    status: mode,
  });
}

/**
 * Assign task to a robot
 * @param {string} deviceId - Device ID
 * @param {string} robotId - Robot ID
 * @param {object} taskPayload - Task details
 */
export async function assignRobotTask(deviceId, robotId, taskPayload) {
  return updateState(deviceId, `fleetMS/robots/${robotId}/tasks`, taskPayload);
}

export default api;
