import { useAuth } from '../contexts/AuthContext';
import { useCallback } from 'react';

const API_BASE_URL = 'https://api.protonestconnect.co/api/v1';

export function useApi() {
  const { token, getAuthHeader } = useAuth();

  const fetchWithAuth = useCallback(async (endpoint, options = {}) => {
    if (!token) {
      console.error('[API] ❌ No auth token available');
      throw new Error('Not authenticated');
    }

    const url = `${API_BASE_URL}${endpoint}`;
    console.log('[API] 📡 Request:', options.method || 'GET', url);

    const headers = {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...options.headers
    };

    console.log('[API] 📋 Headers:', { ...headers, 'X-Token': '***' });

    if (options.body) {
      console.log('[API] 📦 Body:', JSON.stringify(options.body).substring(0, 500));
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      console.log('[API] 📨 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[API] ❌ Error response:', errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('[API] ✅ Response data received');
      return data;
    } catch (error) {
      console.error('[API] ❌ Request failed:', error.message);
      throw error;
    }
  }, [token, getAuthHeader]);

  // Get device stream data
  const getDeviceStreamData = useCallback(async (deviceId, startTime, endTime, pagination = 0, pageSize = 10) => {
    console.log('[API] 📊 Fetching device stream data...');
    console.log('[API] 📋 Params:', { deviceId, startTime, endTime, pagination, pageSize });

    return fetchWithAuth('/get-stream-data/device', {
      method: 'POST',
      body: {
        deviceId,
        startTime, // ISO-8601 format
        endTime,   // ISO-8601 format
        pagination: String(pagination),
        pageSize: String(pageSize)
      }
    });
  }, [fetchWithAuth]);

  // Get topic-specific stream data
  const getTopicStreamData = useCallback(async (deviceId, topic, startTime, endTime, pagination = 0, pageSize = 10) => {
    console.log('[API] 📊 Fetching topic stream data...');
    
    return fetchWithAuth('/get-stream-data/device/topic', {
      method: 'POST',
      body: {
        deviceId,
        topic,
        startTime,
        endTime,
        pagination: String(pagination),
        pageSize: String(pageSize)
      }
    });
  }, [fetchWithAuth]);

  // Get state details
  const getStateDetails = useCallback(async (deviceId) => {
    console.log('[API] 📊 Fetching state details for:', deviceId);
    
    return fetchWithAuth('/get-state-details/device', {
      method: 'POST',
      body: { deviceId }
    });
  }, [fetchWithAuth]);

  // Get topic-specific state details
  const getTopicStateDetails = useCallback(async (deviceId, topic) => {
    console.log('[API] 📊 Fetching topic state details...');
    
    return fetchWithAuth('/get-state-details/device/topic', {
      method: 'POST',
      body: { deviceId, topic }
    });
  }, [fetchWithAuth]);

  // Update state (for actuators, emergency stop, etc.)
  const updateState = useCallback(async (deviceId, topic, payload) => {
    console.log('[API] 📤 Updating state...');
    console.log('[API] 📋 Device:', deviceId, 'Topic:', topic);
    console.log('[API] 📦 Payload:', payload);
    
    return fetchWithAuth('/update-state-details', {
      method: 'POST',
      body: {
        deviceId,
        topic,
        payload
      }
    });
  }, [fetchWithAuth]);

  // Emergency stop
  const emergencyStop = useCallback(async (deviceId) => {
    console.log('[API] 🚨 EMERGENCY STOP for device:', deviceId);
    
    return updateState(deviceId, 'emergency/stop', {
      emergency_stop: true,
      timestamp: new Date().toISOString()
    });
  }, [updateState]);

  // Control AC
  const controlAC = useCallback(async (deviceId, state) => {
    console.log('[API] ❄️ AC control:', state);
    
    return updateState(deviceId, 'control/ac', {
      ac_power: state ? 'ON' : 'OFF'
    });
  }, [updateState]);

  // Control Air Purifier
  const controlAirPurifier = useCallback(async (deviceId, state) => {
    console.log('[API] 🌬️ Air purifier control:', state);
    
    return updateState(deviceId, 'control/air_purifier', {
      air_purifier: state ? 'ON' : 'OFF'
    });
  }, [updateState]);

  // Assign task to robot
  const assignRobotTask = useCallback(async (deviceId, robotId, task) => {
    console.log('[API] 🤖 Assigning task to robot:', robotId);
    console.log('[API] 📋 Task:', task);
    
    return updateState(deviceId, `robots/${robotId}/task`, {
      task_type: task.type,
      source: task.source,
      destination: task.destination,
      priority: task.priority || 'NORMAL',
      timestamp: new Date().toISOString()
    });
  }, [updateState]);

  // Set threshold
  const setThreshold = useCallback(async (deviceId, thresholdType, value) => {
    console.log('[API] ⚙️ Setting threshold:', thresholdType, '=', value);
    
    return updateState(deviceId, 'config/thresholds', {
      [thresholdType]: value
    });
  }, [updateState]);

  // Set system mode
  const setSystemMode = useCallback(async (deviceId, mode) => {
    console.log('[API] ⚙️ Setting system mode:', mode);
    
    return updateState(deviceId, 'config/mode', {
      mode: mode // 'MANUAL' or 'AUTOMATED'
    });
  }, [updateState]);

  return {
    fetchWithAuth,
    getDeviceStreamData,
    getTopicStreamData,
    getStateDetails,
    getTopicStateDetails,
    updateState,
    emergencyStop,
    controlAC,
    controlAirPurifier,
    assignRobotTask,
    setThreshold,
    setSystemMode
  };
}

export default useApi;
