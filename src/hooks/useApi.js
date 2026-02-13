/**
 * API Hook
 *
 * Provides authenticated API methods using the centralized API service.
 * Uses axios interceptors for automatic token handling.
 *
 * @module useApi
 */

import { useCallback } from "react";
import api, {
  getTopicStreamData as getStreamData,
  getDeviceStateDetails as getStateDetails,
  updateStateDetails,
} from "../services/api";
import { generateTaskId } from "../utils/telemetryMath";

export function useApi() {
  // ═══════════════════════════════════════════════════════════════════════
  // STREAM DATA METHODS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Fetch device stream data (all topics).
   */
  const getDeviceStreamData = useCallback(
    async (deviceId, startTime, endTime, pagination = 0, pageSize = 10) => {
      try {
        const response = await api.post("/get-stream-data/device", {
          deviceId,
          startTime,
          endTime,
          pagination: String(pagination),
          pageSize: String(pageSize),
        });
        return response.data;
      } catch (error) {
        console.error("[API] getDeviceStreamData failed:", error.message);
        throw error;
      }
    },
    [],
  );

  /**
   * Fetch topic-specific stream data.
   */
  const getTopicStreamData = useCallback(
    async (
      deviceId,
      topic,
      startTime,
      endTime,
      pagination = 0,
      pageSize = 10,
    ) => {
      try {
        return await getStreamData(
          deviceId,
          topic,
          startTime,
          endTime,
          pagination,
          pageSize,
        );
      } catch (error) {
        console.error("[API] getTopicStreamData failed:", error.message);
        throw error;
      }
    },
    [],
  );

  // ═══════════════════════════════════════════════════════════════════════
  // STATE METHODS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Fetch state details for a device.
   */
  const getDeviceStateDetails = useCallback(async (deviceId) => {
    try {
      return await getStateDetails(deviceId);
    } catch (error) {
      console.error("[API] getDeviceStateDetails failed:", error.message);
      throw error;
    }
  }, []);

  /**
   * Fetch topic-specific state details.
   */
  const getTopicStateDetails = useCallback(async (deviceId, topic) => {
    try {
      const response = await api.post("/get-state-details/device/topic", {
        deviceId,
        topic,
      });
      return response.data;
    } catch (error) {
      console.error("[API] getTopicStateDetails failed:", error.message);
      throw error;
    }
  }, []);

  /**
   * Send a state update (control command) to a device topic.
   */
  const updateDeviceState = useCallback(async (deviceId, topic, payload) => {
    try {
      return await updateStateDetails(deviceId, topic, payload);
    } catch (error) {
      console.error("[API] updateDeviceState failed:", error.message);
      throw error;
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  // CONTROL METHODS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Emergency stop for all robots
   */
  const emergencyStop = useCallback(
    async (deviceId) => {
      console.log("[API Hook] 🚨 EMERGENCY STOP for device:", deviceId);

      return updateDeviceState(deviceId, "fleetMS/emergencyStop", {
        emergency_stop: true,
        timestamp: new Date().toISOString(),
      });
    },
    [updateDeviceState],
  );

  /**
   * Clear emergency stop (restart) for all robots
   */
  const emergencyClear = useCallback(
    async (deviceId) => {
      console.log("[API Hook] 🔁 CLEAR EMERGENCY for device:", deviceId);

      return updateDeviceState(deviceId, "fleetMS/emergencyStop", {
        emergency_stop: false,
        timestamp: new Date().toISOString(),
      });
    },
    [updateDeviceState],
  );

  /**
   * Control AC
   */
  const controlAC = useCallback(
    async (deviceId, state) => {
      console.log("[API Hook] ❄️ AC control:", state);

      return updateDeviceState(deviceId, "control/ac", {
        ac_power: state ? "ON" : "OFF",
      });
    },
    [updateDeviceState],
  );

  /**
   * Control Air Purifier
   */
  const controlAirPurifier = useCallback(
    async (deviceId, state) => {
      return updateDeviceState(deviceId, "control/air_purifier", {
        air_purifier: state ? "ON" : "OFF",
      });
    },
    [updateDeviceState],
  );

  /**
   * Assign a delivery task to a robot via the state update API.
   */
  const assignRobotTask = useCallback(
    async (deviceId, robotId, task) => {
      const taskId = task.taskId || task.task_id || generateTaskId();

      const payload = {
        task_type: "Deliver",
        task_id: taskId,
        source: task.source,
        destination: task.destination,
        priority: task.priority || "NORMAL",
        timestamp: new Date().toISOString(),
      };

      if (task.source_lat !== undefined) payload.source_lat = task.source_lat;
      if (task.source_lng !== undefined) payload.source_lng = task.source_lng;
      if (task.destination_lat !== undefined)
        payload.destination_lat = task.destination_lat;
      if (task.destination_lng !== undefined)
        payload.destination_lng = task.destination_lng;

      // Send task update as an explicit Update State Details HTTP request
      return updateStateDetails(deviceId, `robots/${robotId}/task`, payload);
    },
    [updateDeviceState],
  );

  /**
   * Update threshold configuration for a device.
   */
  const setThreshold = useCallback(
    async (deviceId, thresholdType, value) => {
      return updateDeviceState(deviceId, "config/thresholds", {
        [thresholdType]: value,
      });
    },
    [updateDeviceState],
  );

  /**
   * Set system mode (MANUAL or AUTOMATIC).
   */
  const setSystemMode = useCallback(
    async (deviceId, mode) => {
      return updateDeviceState(deviceId, "config/mode", {
        mode: mode,
      });
    },
    [updateDeviceState],
  );

  // ═══════════════════════════════════════════════════════════════════════
  // RETURN API METHODS
  // ═══════════════════════════════════════════════════════════════════════

  return {
    // Stream data
    getDeviceStreamData,
    getTopicStreamData,

    // State
    getStateDetails: getDeviceStateDetails,
    getTopicStateDetails,
    updateState: updateDeviceState,

    // Controls
    emergencyStop,
    emergencyClear,
    controlAC,
    controlAirPurifier,
    assignRobotTask,
    setThreshold,
    setSystemMode,

    // Raw API access
    api,
  };
}

export default useApi;
