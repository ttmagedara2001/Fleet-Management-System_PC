/**
 * TypeScript interfaces for Fabrix Dashboard
 * These provide documentation and can be used for future TypeScript migration
 */

// ==================== Device Types ====================

/**
 * Device environment data from /topic/stream/${deviceId}/env
 */
export interface DeviceEnvironment {
  ambient_temp: number | null;
  ambient_hum: number | null;
  atmospheric_pressure: number | null;
  air_scrubber_status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | null;
}

/**
 * Device state from /topic/state/${deviceId}
 */
export interface DeviceState {
  gateway_health: 'NOMINAL' | 'DEGRADED' | 'CRITICAL' | null;
  active_alert: string | null;
  ac_power: 'ON' | 'OFF' | null;
  wifi_rssi: number | null;
  robots?: string[]; // Robot discovery
}

/**
 * Complete device data
 */
export interface DeviceData {
  environment: DeviceEnvironment;
  state: DeviceState;
  taskSummary: any | null;
  lastUpdate: number | null;
}

// ==================== Robot Types ====================

/**
 * Robot location from /topic/stream/${deviceId}/robots/${robotId}/location
 */
export interface RobotLocation {
  lat: number;
  lng: number;
  z: number;
}

/**
 * Robot environment from /topic/stream/${deviceId}/robots/${robotId}/env
 */
export interface RobotEnvironment {
  temp: number | null;
  humidity: number | null;
}

/**
 * Robot status from /topic/stream/${deviceId}/robots/${robotId}/status
 */
export interface RobotStatus {
  battery: number | null;
  load: string | null;
  state: 'MOVING' | 'ACTIVE' | 'IDLE' | 'CHARGING' | 'ERROR' | 'STOPPED' | 'UNKNOWN';
  obstacle_detected?: boolean;
}

/**
 * Robot task from /topic/stream/${deviceId}/robots/${robotId}/tasks
 */
export interface RobotTask {
  type: 'MOVE_FOUP' | 'PICKUP' | 'DELIVERY' | 'RETURN_HOME' | 'CHARGE';
  source: string;
  destination: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  progress?: number;
  eta?: string;
}

/**
 * Complete robot data
 */
export interface Robot {
  id: string;
  location: RobotLocation;
  heading: number;
  environment: RobotEnvironment;
  status: RobotStatus;
  task: RobotTask | null;
  lastUpdate: number | null;
}

// ==================== Alert Types ====================

export interface Alert {
  id: string;
  type: 'warning' | 'critical';
  deviceId: string;
  robotId?: string;
  message: string;
  timestamp: number;
  read?: boolean;
}

// ==================== API Types ====================

/**
 * Stream data request payload
 */
export interface StreamDataRequest {
  deviceId: string;
  startTime: string; // ISO-8601
  endTime: string;   // ISO-8601
  pagination: string;
  pageSize: string;
}

/**
 * State update request payload
 */
export interface StateUpdateRequest {
  deviceId: string;
  topic: string;
  payload: Record<string, any>;
}

// ==================== Context Types ====================

export interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  logout: () => void;
  performLogin: () => Promise<void>;
  getAuthHeader: () => Record<string, string>;
  getWebSocketUrl: (baseUrl: string) => string | null;
}

export interface StompContextValue {
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  lastMessageTime: number | null;
  connect: () => void;
  disconnect: () => void;
  subscribe: (topic: string, callback: (payload: any) => void, subscriptionId?: string) => any;
  unsubscribe: (topic: string) => void;
  publish: (destination: string, body: any) => boolean;
  activeSubscriptions: number;
}

export interface DeviceContextValue {
  devices: Array<{ id: string; name: string; zone: string }>;
  selectedDeviceId: string;
  setSelectedDeviceId: (id: string) => void;
  currentDevice: { id: string; name: string; zone: string } | undefined;
  currentDeviceData: DeviceData;
  currentRobots: Record<string, Robot>;
  deviceData: Record<string, DeviceData>;
  robots: Record<string, Record<string, Robot>>;
  alerts: Alert[];
  addAlert: (alert: Omit<Alert, 'id'>) => void;
  clearAlert: (alertId: string) => void;
  clearAllAlerts: () => void;
  registerRobot: (deviceId: string, robotId: string) => void;
}

// ==================== Component Props ====================

export interface HeaderProps {
  onMenuToggle: () => void;
}

export interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export interface RobotCardProps {
  robot: Robot;
}

export interface MetricCardProps {
  icon: React.ComponentType<any>;
  label: string;
  value: string | number | null;
  unit?: string;
  status?: 'normal' | 'warning' | 'critical';
  trend?: number;
}

export interface ChartCardProps {
  title: string;
  icon: React.ComponentType<any>;
  data: Array<{ time: string; value: number }>;
  dataKey?: string;
  color?: string;
  unit?: string;
}

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

export default {
  TOPIC_PATTERNS
};
