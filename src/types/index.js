/**
 * Type definitions for Fabrix Dashboard
 * Using JSDoc for documentation in JavaScript
 * 
 * This file provides documentation for data structures used throughout the app.
 * For future TypeScript migration, these can be converted to .ts interfaces.
 */

// ==================== Device Types ====================

/**
 * Device environment data from /topic/stream/${deviceId}/env
 * @typedef {Object} DeviceEnvironment
 * @property {number|null} ambient_temp - Ambient temperature in Celsius
 * @property {number|null} ambient_hum - Ambient humidity percentage
 * @property {number|null} atmospheric_pressure - Pressure in hPa
 * @property {'ACTIVE'|'INACTIVE'|'MAINTENANCE'|null} air_scrubber_status - Air scrubber state
 */

/**
 * Device state from /topic/state/${deviceId}
 * @typedef {Object} DeviceState
 * @property {'NOMINAL'|'DEGRADED'|'CRITICAL'|null} gateway_health - Gateway health status
 * @property {string|null} active_alert - Current active alert message
 * @property {'ON'|'OFF'|null} ac_power - AC power state
 * @property {number|null} wifi_rssi - WiFi signal strength in dBm
 * @property {string[]} [robots] - Array of discovered robot IDs
 */

/**
 * Complete device data structure
 * @typedef {Object} DeviceData
 * @property {DeviceEnvironment} environment - Environmental sensor data
 * @property {DeviceState} state - Device operational state
 * @property {Object|null} taskSummary - Task summary data
 * @property {number|null} lastUpdate - Timestamp of last update
 */

// ==================== Robot Types ====================

/**
 * Robot location from /topic/stream/${deviceId}/robots/${robotId}/location
 * @typedef {Object} RobotLocation
 * @property {number} lat - Latitude coordinate
 * @property {number} lng - Longitude coordinate
 * @property {number} z - Altitude/floor level
 */

/**
 * Robot environment from /topic/stream/${deviceId}/robots/${robotId}/env
 * @typedef {Object} RobotEnvironment
 * @property {number|null} temp - Robot internal temperature
 * @property {number|null} humidity - Local humidity reading
 */

/**
 * Robot status from /topic/stream/${deviceId}/robots/${robotId}/status
 * @typedef {Object} RobotStatus
 * @property {number|null} battery - Battery percentage
 * @property {string|null} load - Current load description
 * @property {'MOVING'|'ACTIVE'|'IDLE'|'CHARGING'|'ERROR'|'STOPPED'|'UNKNOWN'} state - Robot state
 * @property {boolean} [obstacle_detected] - Whether obstacle is detected
 */

/**
 * Robot task from /topic/stream/${deviceId}/robots/${robotId}/tasks
 * @typedef {Object} RobotTask
 * @property {'MOVE_FOUP'|'PICKUP'|'DELIVERY'|'RETURN_HOME'|'CHARGE'} type - Task type
 * @property {string} source - Source location
 * @property {string} destination - Destination location
 * @property {'LOW'|'NORMAL'|'HIGH'|'URGENT'} priority - Task priority
 * @property {number} [progress] - Task progress percentage
 * @property {string} [eta] - Estimated time of arrival
 */

/**
 * Complete robot data structure
 * @typedef {Object} Robot
 * @property {string} id - Robot identifier
 * @property {RobotLocation} location - Current location
 * @property {number} heading - Heading angle in degrees
 * @property {RobotEnvironment} environment - Environmental readings
 * @property {RobotStatus} status - Operational status
 * @property {RobotTask|null} task - Current task
 * @property {number|null} lastUpdate - Timestamp of last update
 */

// ==================== Alert Types ====================

/**
 * Alert structure
 * @typedef {Object} Alert
 * @property {string} id - Unique alert identifier
 * @property {'warning'|'critical'} type - Alert severity
 * @property {string} deviceId - Associated device ID
 * @property {string} [robotId] - Associated robot ID (if applicable)
 * @property {string} message - Alert message
 * @property {number} timestamp - Alert timestamp
 * @property {boolean} [read] - Whether alert has been read
 */

// ==================== API Types ====================

/**
 * Stream data request payload
 * @typedef {Object} StreamDataRequest
 * @property {string} deviceId - Device to query
 * @property {string} startTime - Start time (ISO-8601)
 * @property {string} endTime - End time (ISO-8601)
 * @property {string} pagination - Page number
 * @property {string} pageSize - Items per page
 */

/**
 * State update request payload
 * @typedef {Object} StateUpdateRequest
 * @property {string} deviceId - Target device
 * @property {string} topic - State topic
 * @property {Object} payload - Update payload
 */

// ==================== STOMP Topic Structure ====================

/**
 * Topic naming convention for Spring Boot STOMP
 * /topic/<category>/<deviceId>/<sub-category>/<optional-robotId>
 * 
 * Device-level streams:
 * - /topic/stream/${deviceId}/env (1Hz)
 * - /topic/stream/${deviceId}/tasks/summary
 * - /topic/state/${deviceId}
 * 
 * Robot-level streams:
 * - /topic/stream/${deviceId}/robots/${robotId}/location (10Hz)
 * - /topic/stream/${deviceId}/robots/${robotId}/env (1Hz)
 * - /topic/stream/${deviceId}/robots/${robotId}/status
 * - /topic/stream/${deviceId}/robots/${robotId}/tasks
 */
export const TOPIC_PATTERNS = {
  DEVICE_ENV: (deviceId) => `/topic/stream/${deviceId}/env`,
  DEVICE_STATE: (deviceId) => `/topic/state/${deviceId}`,
  DEVICE_TASKS: (deviceId) => `/topic/stream/${deviceId}/tasks/summary`,
  ROBOT_LOCATION: (deviceId, robotId) => `/topic/stream/${deviceId}/robots/${robotId}/location`,
  ROBOT_ENV: (deviceId, robotId) => `/topic/stream/${deviceId}/robots/${robotId}/env`,
  ROBOT_STATUS: (deviceId, robotId) => `/topic/stream/${deviceId}/robots/${robotId}/status`,
  ROBOT_TASKS: (deviceId, robotId) => `/topic/stream/${deviceId}/robots/${robotId}/tasks`,
};

// ==================== Status Constants ====================

export const DEVICE_STATUS = {
  NOMINAL: 'NOMINAL',
  DEGRADED: 'DEGRADED',
  CRITICAL: 'CRITICAL',
};

export const ROBOT_STATE = {
  MOVING: 'MOVING',
  ACTIVE: 'ACTIVE',
  IDLE: 'IDLE',
  CHARGING: 'CHARGING',
  ERROR: 'ERROR',
  STOPPED: 'STOPPED',
  UNKNOWN: 'UNKNOWN',
};

export const TASK_TYPE = {
  MOVE_FOUP: 'MOVE_FOUP',
  PICKUP: 'PICKUP',
  DELIVERY: 'DELIVERY',
  RETURN_HOME: 'RETURN_HOME',
  CHARGE: 'CHARGE',
};

export const PRIORITY = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
};

export const ALERT_TYPE = {
  WARNING: 'warning',
  CRITICAL: 'critical',
};

export default {
  TOPIC_PATTERNS,
  DEVICE_STATUS,
  ROBOT_STATE,
  TASK_TYPE,
  PRIORITY,
  ALERT_TYPE,
};
