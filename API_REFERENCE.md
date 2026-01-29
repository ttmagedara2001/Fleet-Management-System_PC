# Fleet Management System - HTTP API Reference

> **Purpose**: Comprehensive API reference for the Fleet Management System dashboard application using the ProtoNest IoT backend.

---

## 🎯 SYSTEM CONTEXT

This Fleet Management System interfaces with the **ProtoNest IoT Backend API** to provide:

1. **Authentication Services** - JWT-based token authentication
2. **Real-time Data Services** - WebSocket/STOMP for live sensor data & robot tracking
3. **Historical Data Services** - REST APIs for time-series data retrieval
4. **State Management Services** - REST APIs for device control (AC, Air Purifier, etc.)
5. **Robot Fleet Management** - Real-time robot location, status, battery, and tasks

---

## 🔐 AUTHENTICATION API

### **POST `/get-token`** - User Authentication

Authenticates a user and returns JWT tokens for API access.

**Request Payload:**

```json
{
  "email": "user@example.com",
  "password": "your_secret_key"
}
```

> **Note**: The `password` field is actually the `secretKey` from your ProtoNest dashboard, NOT your login password.

**Success Response (200):**

```json
{
  "status": "Success",
  "data": {
    "jwtToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh_token_string"
  }
}
```

**Error Responses (400):**

| Error Message            | Cause                    | Solution                          |
| ------------------------ | ------------------------ | --------------------------------- |
| `"Invalid email format"` | Email doesn't contain @  | Validate email format             |
| `"Invalid credentials"`  | Wrong email or secretKey | Verify credentials from dashboard |
| `"User not found"`       | Email not registered     | Check registration status         |
| `"Email not verified"`   | Unverified email         | Complete email verification       |

**Implementation (authService.js):**

```javascript
export async function login() {
  const response = await fetch(`${API_BASE_URL}/get-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email: import.meta.env.VITE_USER_EMAIL,
      password: import.meta.env.VITE_USER_PASSWORD,
    }),
  });

  const data = await response.json();
  const jwtToken = data.data?.jwtToken;

  localStorage.setItem("jwtToken", jwtToken);
  return { jwtToken };
}
```

---

## 📊 STREAM DATA APIs (Historical/Time-Series Data)

These APIs fetch historical sensor data for visualization in charts and the Analysis page.

### **POST `/get-stream-data/device`** - Get All Sensor Data for Device

Fetches time-series data for ALL sensor topics of a specific device.

**Request Payload:**

```json
{
  "deviceId": "device9988",
  "startTime": "2025-01-24T00:00:00Z",
  "endTime": "2025-01-24T23:59:59Z",
  "pagination": "0",
  "pageSize": "100"
}
```

> **Important**: `pagination` and `pageSize` must be **strings**, not numbers.

**Success Response:**

```json
{
  "status": "Success",
  "data": [
    {
      "timestamp": "2025-01-24T10:30:00Z",
      "temperature": 22.3,
      "humidity": 45.2,
      "pressure": 1013
    }
  ]
}
```

**Use Cases:**

- Dashboard overview charts
- Analysis page multi-sensor views
- Historical trend analysis
- Data export functionality

---

### **POST `/get-stream-data/device/topic`** - Get Specific Sensor Data

Fetches time-series data for ONE specific sensor topic.

**Request Payload:**

```json
{
  "deviceId": "device9988",
  "topic": "fleetMS/temperature",
  "startTime": "2025-01-24T00:00:00Z",
  "endTime": "2025-01-24T23:59:59Z",
  "pagination": "0",
  "pageSize": "100"
}
```

**Success Response:**

```json
{
  "status": "Success",
  "data": [
    {
      "id": "d94a68a3-3d52-4333-a18a-6cb5a474856e",
      "deviceId": "device9988",
      "topicSuffix": "fleetMS/temperature",
      "payload": "22.5",
      "timestamp": "2025-10-25T18:53:10.980294Z"
    }
  ]
}
```

**Available Topic Suffixes for Fleet Management:**

| Topic                                  | Description                | Unit |
| -------------------------------------- | -------------------------- | ---- |
| `fleetMS/temperature`                  | Device ambient temperature | °C   |
| `fleetMS/humidity`                     | Relative humidity          | %    |
| `fleetMS/pressure`                     | Atmospheric pressure       | hPa  |
| `fleetMS/robots`                       | Robot discovery list       | JSON |
| `fleetMS/robots/{robotId}/location`    | Robot position             | JSON |
| `fleetMS/robots/{robotId}/temperature` | Robot internal temp        | °C   |
| `fleetMS/robots/{robotId}/status`      | Robot operational status   | JSON |
| `fleetMS/robots/{robotId}/battery`     | Robot battery level        | %    |
| `fleetMS/robots/{robotId}/tasks`       | Robot task info            | JSON |

---

### **POST `/get-stream-data/user`** - Get All User's Device Data

Fetches stream data for ALL devices belonging to the authenticated user.

**Request Payload:**

```json
{
  "startTime": "2025-01-24T00:00:00Z",
  "endTime": "2025-01-24T23:59:59Z",
  "pagination": "0",
  "pageSize": "100"
}
```

**Use Cases:**

- Multi-device fleet dashboard
- Cross-device comparison analytics
- Fleet-wide reporting

---

## 🎛️ STATE DATA APIs (Device Control & Status)

These APIs manage device states and control commands.

### **POST `/get-state-details/device`** - Get All Device States

Retrieves ALL current state values for a device.

**Request Payload:**

```json
{
  "deviceId": "device9988"
}
```

**Success Response:**

```json
{
  "status": "Success",
  "data": {
    "ac": { "status": "ON" },
    "airPurifier": { "status": "ACTIVE" },
    "status": { "gateway_health": "NOMINAL", "active_alert": null }
  }
}
```

**Use Cases:**

- Control panel initialization
- Device status dashboard
- State synchronization on page load

---

### **POST `/get-state-details/device/topic`** - Get Specific State

Retrieves the current state for ONE specific topic.

**Request Payload:**

```json
{
  "deviceId": "device9988",
  "topic": "fleetMS/ac"
}
```

**Success Response:**

```json
{
  "status": "Success",
  "data": {
    "payload": { "status": "ON" },
    "timestamp": "2025-10-25T22:54:02.649972915Z"
  }
}
```

**Available State Topics for Fleet Management:**

| Topic                            | Description               | Possible Values                     |
| -------------------------------- | ------------------------- | ----------------------------------- | -------- |
| `fleetMS/ac`                     | AC power control          | `ON`, `OFF`                         |
| `fleetMS/airPurifier`            | Air purifier control      | `ACTIVE`, `INACTIVE`, `MAINTENANCE` |
| `fleetMS/status`                 | Device operational status | `NOMINAL`, `DEGRADED`, `CRITICAL`   |
| `fleetMS/robots/{robotId}/tasks` | Robot task control        | Task assignment JSON                |
| `fleetMS/emergencyStop`          | Emergency stop/clear flag | `{ "emergency_stop": true           | false }` |

---

### **POST `/update-state-details`** - Update Device State ⭐

**Primary API for state updates and device control.**

This is the main endpoint for sending control commands to IoT devices.

**Request Payload:**

```json
{
  "deviceId": "device9988",
  "topic": "fleetMS/ac",
  "payload": { "status": "ON" }
}
```

**Success Response:**

```json
{
  "status": "Success",
  "message": "State updated successfully"
}
```

**Example Use Cases for Fleet Management:**

1. **Turn AC ON:**

```json
{
  "deviceId": "device9988",
  "topic": "fleetMS/ac",
  "payload": { "status": "ON" }
}
```

2. **Turn AC OFF:**

```json
{
  "deviceId": "device9988",
  "topic": "fleetMS/ac",
  "payload": { "status": "OFF" }
}
```

3. **Activate Air Purifier:**

```json
{
  "deviceId": "device9988",
  "topic": "fleetMS/airPurifier",
  "payload": { "status": "ACTIVE" }
}
```

4. **Set Air Purifier to Maintenance:**

```json
{
  "deviceId": "device9988",
  "topic": "fleetMS/airPurifier",
  "payload": { "status": "MAINTENANCE" }
}
```

5. **Assign Task to Robot:**

```json
{
  "deviceId": "device9988",
  "topic": "fleetMS/robots/robot-001/tasks",
  "payload": {
    "taskId": "task-001",
    "type": "patrol",
    "destination": { "lat": 37.7749, "lng": -122.4194 },
    "priority": "high"
  }
}
```

6. **Emergency Stop / Clear:**

```json
{
  "deviceId": "device9988",
  "topic": "fleetMS/emergencyStop",
  "payload": { "emergency_stop": true }
}
```

To clear the emergency state (restart), send the same topic with `emergency_stop: false`.

---

### Robot Location / GPS Payload (MQTT)

Robot location messages should use the `fleetMS/robots/{robotId}/location` topic and include GPS coordinates in the payload. Example payloads for testing are provided in `src/examples/gps_payload_examples.json`.

Example:

```json
{
  "robotId": "R-001",
  "lat": 37.422033,
  "lng": -122.084095,
  "heading": 90,
  "speed_m_s": 0.6,
  "battery_pct": 84,
  "status": "ACTIVE"
}
```

> Note: The backend automatically adds or normalizes a `timestamp` when messages are received. Clients/firmware may omit the `timestamp` field in outgoing payloads.

**Backend Flow:**

1. API receives state update request
2. Validates device ownership and authorization
3. Forwards update to MQTT broker
4. MQTT broker publishes to: `protonest/<deviceId>/state/fleetMS/<topic>`
5. IoT device receives and executes command

---

## 🗑️ DATA DELETION APIs

### **DELETE `/delete-stream-data-by-id`** - Delete Specific Records

Deletes specific stream data records by their IDs.

**Request Payload:**

```json
{
  "deviceId": "device9988",
  "topic": "fleetMS/temperature",
  "dataIds": ["uuid-1234-5678-abcd", "uuid-5678-1234-efgh"]
}
```

---

### **DELETE `/delete-state-topic`** - Delete State Topic

Deletes an entire state topic for a device.

**Request Payload:**

```json
{
  "deviceId": "device9988",
  "topic": "fleetMS/customTopic"
}
```

---

## 🌐 WEBSOCKET REAL-TIME DATA

### WebSocket Connection

**Connection URL Format:**

```
wss://api.protonestconnect.co/ws?token={encoded_jwt_token}
```

### MQTT Topic Structure

**Raw MQTT Topics (IoT Device Format):**

```
protonest/{deviceId}/stream/fleetMS/{sensor}
protonest/{deviceId}/state/fleetMS/{control}
```

**STOMP WebSocket Format (add `/topic/` prefix):**

```
/topic/protonest/{deviceId}/stream/fleetMS/{sensor}
/topic/protonest/{deviceId}/state/fleetMS/{control}
```

### Device-Level Topics

| Topic Type      | STOMP Topic                                              | Description               |
| --------------- | -------------------------------------------------------- | ------------------------- |
| Temperature     | `/topic/protonest/{deviceId}/stream/fleetMS/temperature` | Ambient temperature       |
| AC State        | `/topic/protonest/{deviceId}/state/fleetMS/ac`           | AC power state            |
| Device Status   | `/topic/protonest/{deviceId}/state/fleetMS/status`       | Gateway health & alerts   |
| Air Purifier    | `/topic/protonest/{deviceId}/state/fleetMS/airPurifier`  | Air purifier state        |
| Robot Discovery | `/topic/protonest/{deviceId}/stream/fleetMS/robots`      | List of discovered robots |

### Robot-Level Topics

| Topic Type     | STOMP Topic                                                               | Description              |
| -------------- | ------------------------------------------------------------------------- | ------------------------ |
| Location       | `/topic/protonest/{deviceId}/stream/fleetMS/robots/{robotId}/location`    | Robot GPS position       |
| Temperature    | `/topic/protonest/{deviceId}/stream/fleetMS/robots/{robotId}/temperature` | Robot internal temp      |
| Status         | `/topic/protonest/{deviceId}/stream/fleetMS/robots/{robotId}/status`      | Robot operational status |
| Battery        | `/topic/protonest/{deviceId}/stream/fleetMS/robots/{robotId}/battery`     | Battery level            |
| Tasks (Stream) | `/topic/protonest/{deviceId}/stream/fleetMS/robots/{robotId}/tasks`       | Task status updates      |
| Tasks (State)  | `/topic/protonest/{deviceId}/state/fleetMS/robots/{robotId}/tasks`        | Task commands            |

### Topic Constants (webSocketClient.js)

```javascript
export const TOPICS = {
  // Device-level topics (STOMP format)
  DEVICE_TEMP: (deviceId) =>
    `/topic/protonest/${deviceId}/stream/fleetMS/temperature`,
  DEVICE_AC: (deviceId) => `/topic/protonest/${deviceId}/state/fleetMS/ac`,
  DEVICE_STATUS: (deviceId) =>
    `/topic/protonest/${deviceId}/state/fleetMS/status`,
  DEVICE_AIR: (deviceId) =>
    `/topic/protonest/${deviceId}/state/fleetMS/airPurifier`,
  DEVICE_ROBOTS: (deviceId) =>
    `/topic/protonest/${deviceId}/stream/fleetMS/robots`,

  // Robot-level topics (STOMP format)
  ROBOT_LOCATION: (deviceId, robotId) =>
    `/topic/protonest/${deviceId}/stream/fleetMS/robots/${robotId}/location`,
  ROBOT_TEMP: (deviceId, robotId) =>
    `/topic/protonest/${deviceId}/stream/fleetMS/robots/${robotId}/temperature`,
  ROBOT_STATUS: (deviceId, robotId) =>
    `/topic/protonest/${deviceId}/stream/fleetMS/robots/${robotId}/status`,
  ROBOT_TASKS: (deviceId, robotId) =>
    `/topic/protonest/${deviceId}/stream/fleetMS/robots/${robotId}/tasks`,
  ROBOT_TASK_UPDATE: (deviceId, robotId) =>
    `/topic/protonest/${deviceId}/state/fleetMS/robots/${robotId}/tasks`,
  ROBOT_BATTERY: (deviceId, robotId) =>
    `/topic/protonest/${deviceId}/stream/fleetMS/robots/${robotId}/battery`,

  // Command destinations (for publishing - raw MQTT format)
  COMMAND: (deviceId, commandType) =>
    `protonest/${deviceId}/state/fleetMS/${commandType}`,
};
```

### Real-time Message Formats

**Device Temperature:**

```json
{
  "ambient_temp": 22.5,
  "ambient_hum": 45.2,
  "atmospheric_pressure": 1013
}
```

**Robot Discovery:**

```json
{
  "robots": ["robot-001", "robot-002", "robot-003"]
}
```

**Robot Location:**

```json
{
  "lat": 37.7749,
  "lng": -122.4194,
  "z": 1,
  "heading": 45
}
```

**Robot Status:**

```json
{
  "battery": 85,
  "load": "Package A-123",
  "status": "MOVING",
  "connectivity": "ONLINE"
}
```

**Robot Battery:**

```json
{
  "level": 85,
  "charging": false,
  "estimatedRuntime": 180
}
```

---

## 🏗️ IMPLEMENTATION PATTERNS

### 1. Axios Instance Configuration (api.js)

```javascript
import axios from "axios";
import { getToken } from "./authService";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
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

export default api;
```

### 2. Time Range Utility

```javascript
const getTimeRange = (range) => {
  const now = new Date();
  const rangeMs = {
    "1m": 1 * 60 * 1000,
    "5m": 5 * 60 * 1000,
    "15m": 15 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "6h": 6 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };

  const startDate = new Date(
    now.getTime() - (rangeMs[range] || rangeMs["24h"]),
  );

  return {
    startTime: startDate.toISOString().split(".")[0] + "Z",
    endTime: now.toISOString().split(".")[0] + "Z",
  };
};
```

### 3. Service Functions (api.js)

```javascript
// Get stream data for a device topic
export async function getStreamData(
  deviceId,
  topic,
  startTime,
  endTime,
  pagination = 0,
  pageSize = 100,
) {
  const response = await api.post("/get-stream-data/device/topic", {
    deviceId,
    topic,
    startTime,
    endTime,
    pagination: String(pagination), // Must be string
    pageSize: String(pageSize), // Must be string
  });
  return response.data;
}

// Get all state details for a device
export async function getStateDetails(deviceId) {
  const response = await api.post("/get-state-details/device", { deviceId });
  return response.data;
}

// Update device state (AC, Air Purifier, etc.)
export async function updateState(deviceId, topic, payload) {
  const response = await api.post("/update-state-details", {
    deviceId,
    topic,
    payload,
  });
  return response.data;
}
```

### 4. WebSocket Subscription Pattern (DeviceContext.jsx)

```javascript
// Subscribe to device topics when device is selected
useEffect(() => {
  if (!isConnected || !selectedDeviceId) return;

  const deviceTopics = [
    {
      topic: TOPICS.DEVICE_TEMP(selectedDeviceId),
      handler: handleTemperatureUpdate,
    },
    { topic: TOPICS.DEVICE_AC(selectedDeviceId), handler: handleACUpdate },
    {
      topic: TOPICS.DEVICE_STATUS(selectedDeviceId),
      handler: handleDeviceStatusUpdate,
    },
    {
      topic: TOPICS.DEVICE_AIR(selectedDeviceId),
      handler: handleAirPurifierUpdate,
    },
    {
      topic: TOPICS.DEVICE_ROBOTS(selectedDeviceId),
      handler: handleRobotsDiscovery,
    },
  ];

  console.log(`[Device] 🔌 Subscribing to device: ${selectedDeviceId}`);
  deviceTopics.forEach(({ topic }) => {
    console.log(`  📡 ${toMqttFormat(topic)}`);
  });

  const subscriptions = deviceTopics.map(({ topic, handler }) =>
    subscribe(topic, handler),
  );

  // Cleanup on device change
  return () => {
    subscriptions.forEach((unsub) => unsub?.());
  };
}, [isConnected, selectedDeviceId]);
```

### 5. State Update from Dashboard

```javascript
// Toggle AC power
const handleToggleAC = async () => {
  const newStatus = currentDeviceData?.state?.ac_power === "ON" ? "OFF" : "ON";

  try {
    await updateState(selectedDeviceId, "fleetMS/ac", { status: newStatus });
    console.log(`[Device] AC set to ${newStatus}`);
  } catch (error) {
    console.error("[Device] Failed to update AC:", error);
  }
};

// Control air purifier
const handleAirPurifierControl = async (mode) => {
  try {
    await updateState(selectedDeviceId, "fleetMS/airPurifier", {
      status: mode,
    });
    console.log(`[Device] Air purifier set to ${mode}`);
  } catch (error) {
    console.error("[Device] Failed to update air purifier:", error);
  }
};
```

---

## 📋 API ENDPOINT SUMMARY TABLE

| Method | Endpoint                          | Purpose                        | Auth Required |
| ------ | --------------------------------- | ------------------------------ | ------------- |
| POST   | `/get-token`                      | User authentication            | No            |
| POST   | `/get-stream-data/device`         | Get all sensor data for device | Yes           |
| POST   | `/get-stream-data/device/topic`   | Get specific sensor data       | Yes           |
| POST   | `/get-stream-data/user`           | Get all user's device data     | Yes           |
| POST   | `/get-state-details/device`       | Get all device states          | Yes           |
| POST   | `/get-state-details/device/topic` | Get specific state             | Yes           |
| POST   | `/update-state-details`           | Update device state/control    | Yes           |
| DELETE | `/delete-stream-data-by-id`       | Delete specific records        | Yes           |
| DELETE | `/delete-state-topic`             | Delete state topic             | Yes           |

---

## ⚠️ COMMON ERROR HANDLING

| HTTP Status | Error Type                  | Handling Strategy               |
| ----------- | --------------------------- | ------------------------------- |
| 400         | Bad Request / Invalid Token | Validate inputs, refresh token  |
| 401         | Unauthorized                | Redirect to login, clear tokens |
| 405         | Method Not Allowed          | Check HTTP method (POST vs GET) |
| 500         | Server Error                | Retry with exponential backoff  |

**Device Authorization Error:**

```json
{
  "status": "Error",
  "data": "Device does not belong to the user"
}
```

_Solution: Verify device ID is registered to the authenticated user._

---

## 🔧 ENVIRONMENT VARIABLES

```env
# API Configuration
VITE_API_BASE_URL=https://api.protonestconnect.co

# WebSocket Configuration
VITE_WS_URL=wss://api.protonestconnect.co/ws

# Auto-Login Credentials
VITE_USER_EMAIL=your_email@example.com
VITE_USER_PASSWORD=your_secret_key

# Optional: Fallback JWT Token for development
VITE_FALLBACK_JWT_TOKEN=your_fallback_token
```

---

## 🎨 FLEET MANAGEMENT TOPIC STRUCTURE

**Full MQTT Topic Paths on Broker:**

| Type          | Pattern                                                       | Example                                                         |
| ------------- | ------------------------------------------------------------- | --------------------------------------------------------------- |
| Device Stream | `protonest/{deviceId}/stream/fleetMS/{sensor}`                | `protonest/device9988/stream/fleetMS/temperature`               |
| Device State  | `protonest/{deviceId}/state/fleetMS/{control}`                | `protonest/device9988/state/fleetMS/ac`                         |
| Robot Stream  | `protonest/{deviceId}/stream/fleetMS/robots/{robotId}/{data}` | `protonest/device9988/stream/fleetMS/robots/robot-001/location` |
| Robot State   | `protonest/{deviceId}/state/fleetMS/robots/{robotId}/{cmd}`   | `protonest/device9988/state/fleetMS/robots/robot-001/tasks`     |

**API Topic Format (in payloads):**

- Always use `fleetMS/<topic_name>` format
- Examples: `fleetMS/temperature`, `fleetMS/ac`, `fleetMS/robots/robot-001/tasks`

---

## 📈 SENSOR THRESHOLD RECOMMENDATIONS

For dashboard alert systems, use these default thresholds:

| Sensor        | Warning Threshold       | Critical Threshold   |
| ------------- | ----------------------- | -------------------- |
| Temperature   | > 28°C                  | > 32°C or < 10°C     |
| Humidity      | > 60%                   | > 75%                |
| Pressure      | < 980 hPa or > 1040 hPa | Outside normal range |
| Robot Battery | < 20%                   | < 10%                |
| WiFi RSSI     | < -70 dBm               | < -80 dBm            |

---

## 🤖 FLEET MANAGEMENT SPECIFIC DATA STRUCTURES

### Device Data Structure

```javascript
const DEFAULT_DEVICE_STATE = {
  environment: {
    ambient_temp: null, // °C
    ambient_hum: null, // %
    atmospheric_pressure: null, // hPa
  },
  state: {
    ac_power: null, // 'ON' | 'OFF'
    air_purifier: null, // 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'
    status: null, // 'NOMINAL' | 'DEGRADED' | 'CRITICAL'
    gateway_health: null, // 'NOMINAL' | 'DEGRADED' | 'CRITICAL'
    active_alert: null, // Alert message or null
    wifi_rssi: null, // dBm
  },
  taskSummary: null,
  lastUpdate: null, // Unix timestamp
};
```

### Robot Data Structure

```javascript
const robotData = {
  id: "robot-001",
  deviceId: "device9988",
  location: {
    lat: 37.7749,
    lng: -122.4194,
    z: 1,
    heading: 45,
  },
  status: {
    battery: 85,
    load: "Package A-123",
    status: "MOVING", // 'IDLE' | 'MOVING' | 'CHARGING' | 'ERROR'
    connectivity: "ONLINE",
  },
  temperature: 35.5,
  tasks: {
    current: "Delivering to Zone B",
    queue: ["Return to base", "Charge"],
  },
  lastUpdate: Date.now(),
};
```

### Available Devices

```javascript
const DEVICES = [
  { id: "device9988", name: "Device 9988", zone: "Cleanroom A" },
  { id: "device0011233", name: "Device 0011233", zone: "Cleanroom B" },
  { id: "deviceA72Q", name: "Device A72Q", zone: "Loading Bay" },
  { id: "deviceZX91", name: "Device ZX91", zone: "Storage" },
];
```

---

## 🚀 QUICK START CHECKLIST

1. ✅ Set up environment variables (`.env` file)
2. ✅ Implement authentication flow with `/get-token`
3. ✅ Store JWT token in localStorage
4. ✅ Configure Axios interceptor to add `X-Token` header
5. ✅ Create service functions for each API endpoint
6. ✅ Implement WebSocket client for real-time updates
7. ✅ Subscribe to device topics on device selection
8. ✅ Subscribe to robot topics when robots are discovered
9. ✅ Handle error responses and token refresh
10. ✅ Build visualization components with historical data APIs
11. ✅ Implement control panels using state update API
12. ✅ Add localStorage persistence for state across refreshes

---

## 📁 FILE STRUCTURE REFERENCE

```
src/
├── services/
│   ├── api.js                 # Axios client with token interceptor
│   ├── authService.js         # Auto-login authentication
│   └── webSocketClient.js     # STOMP WebSocket client & topics
├── contexts/
│   ├── AuthContext.jsx        # Authentication state provider
│   ├── DeviceContext.jsx      # Device & robot state management
│   └── StompContext.jsx       # WebSocket connection provider
├── components/
│   └── dashboard/
│       ├── AlertsPanel.jsx    # Real-time alerts display
│       ├── DeviceEnvironmentPanel.jsx  # Sensor readings
│       ├── FabMap.jsx         # Robot location map
│       └── RobotFleetPanel.jsx # Robot fleet overview
└── pages/
    ├── Dashboard.jsx          # Main monitoring dashboard
    ├── Analysis.jsx           # Historical data charts
    └── Settings.jsx           # Threshold configuration
```
