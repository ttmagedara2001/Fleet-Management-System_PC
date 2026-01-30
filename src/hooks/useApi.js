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
  getStreamData,
  getStateDetails,
  updateState,
  updateStateDetails,
} from "../services/api";

export function useApi() {
  // ═══════════════════════════════════════════════════════════════════════
  // STREAM DATA METHODS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get device stream data (all topics)
   */
  const getDeviceStreamData = useCallback(
    async (deviceId, startTime, endTime, pagination = 0, pageSize = 10) => {
      console.log("[API Hook] 📊 Fetching device stream data...");
      console.log("[API Hook] 📋 Params:", {
        deviceId,
        startTime,
        endTime,
        pagination,
        pageSize,
      });

      try {
        const response = await api.post("/user/get-stream-data/device", {
          deviceId,
          startTime,
          endTime,
          pagination: String(pagination),
          pageSize: String(pageSize),
        });
        return response.data;
      } catch (error) {
        console.error(
          "[API Hook] ❌ getDeviceStreamData failed:",
          error.message,
        );
        throw error;
      }
    },
    [],
  );

  /**
   * Get topic-specific stream data
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
      console.log("[API Hook] 📊 Fetching topic stream data:", topic);

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
        console.error(
          "[API Hook] ❌ getTopicStreamData failed:",
          error.message,
        );
        throw error;
      }
    },
    [],
  );

  // ═══════════════════════════════════════════════════════════════════════
  // STATE METHODS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get state details for a device
   */
  const getDeviceStateDetails = useCallback(async (deviceId) => {
    console.log("[API Hook] 📋 Fetching state details for:", deviceId);

    try {
      return await getStateDetails(deviceId);
    } catch (error) {
      console.error(
        "[API Hook] ❌ getDeviceStateDetails failed:",
        error.message,
      );
      throw error;
    }
  }, []);

  /**
   * Get topic-specific state details
   */
  const getTopicStateDetails = useCallback(async (deviceId, topic) => {
    console.log("[API Hook] 📋 Fetching topic state details:", topic);

    try {
      const response = await api.post("/user/get-state-details/device/topic", {
        deviceId,
        topic,
      });
      return response.data;
    } catch (error) {
      console.error(
        "[API Hook] ❌ getTopicStateDetails failed:",
        error.message,
      );
      throw error;
    }
  }, []);

  /**
   * Update state (control command)
   */
  const updateDeviceState = useCallback(async (deviceId, topic, payload) => {
    console.log("[API Hook] 📤 Updating state...");
    console.log("[API Hook] 📋 Device:", deviceId, "Topic:", topic);
    console.log("[API Hook] 📦 Payload:", payload);

    try {
      return await updateState(deviceId, topic, payload);
    } catch (error) {
      console.error("[API Hook] ❌ updateDeviceState failed:", error.message);
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
      console.log("[API Hook] 🌬️ Air purifier control:", state);

      return updateDeviceState(deviceId, "control/air_purifier", {
        air_purifier: state ? "ON" : "OFF",
      });
    },
    [updateDeviceState],
  );

  /**
   * Assign task to robot
   */
  const assignRobotTask = useCallback(
    async (deviceId, robotId, task) => {
      console.log("[API Hook] 🤖 Assigning task to robot:", robotId);
      console.log("[API Hook] 📋 Task:", task);

      // Build payload and include lat/lng if provided in the task object
      const payload = {
        task_type: task.type,
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
      // Include task identifier if provided
      if (task.taskId !== undefined) payload.task_id = task.taskId;
      if (task.task_id !== undefined) payload.task_id = task.task_id;

      // Send task update as an explicit Update State Details HTTP request
      return updateStateDetails(deviceId, `robots/${robotId}/task`, payload);
    },
    [updateDeviceState],
  );

  /**
   * Set threshold configuration
   */
  const setThreshold = useCallback(
    async (deviceId, thresholdType, value) => {
      console.log(
        "[API Hook] ⚙️ Setting threshold:",
        thresholdType,
        "=",
        value,
      );

      return updateDeviceState(deviceId, "config/thresholds", {
        [thresholdType]: value,
      });
    },
    [updateDeviceState],
  );

  /**
   * Set system mode (MANUAL or AUTOMATED)
   */
  const setSystemMode = useCallback(
    async (deviceId, mode) => {
      console.log("[API Hook] ⚙️ Setting system mode:", mode);

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
