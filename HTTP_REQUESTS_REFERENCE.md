leet Management System - HTTP Requests and Payloads Reference

## Overview
This document provides a comprehensive list of all HTTP requests used in the Fleet Management System, including request/response payloads, authentication requirements, and implementation details.

---

## 🔐 Authentication Requests

### 1. User Authentication (Auto-Login)

**File**: `src/services/authService.js`  
**Function**: `login()`  
**Endpoint**: `POST /get-token`  
**Base URL**: From `VITE_API_BASE_URL` env variable

**Request Payload**:
```json
{
  "email": "{{VITE_USER_EMAIL}}",
  "password": "{{VITE_USER_PASSWORD}}"
}
```

**Request Headers**:
```json
{
  "Content-Type": "application/json",
  "Accept": "application/json"
}
```

**Success Response** (200 OK):
```json
{
  "status": "Success",
  "data": {
    "jwtToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh_token_string"
  }
}
```

**Error Responses** (400 Bad Request):
- `"Invalid email format"` - Email validation failed
- `"Invalid credentials"` - Wrong email or password
- `"User not found"` - Email not registered
- `"Email not verified"` - Unverified user account

**Implementation**:
```javascript
// Auto-login on app start
const { jwtToken, refreshToken } = await login();
localStorage.setItem('jwtToken', jwtToken);
localStorage.setItem('refreshToken', refreshToken);
```

---

## 📊 Stream Data Requests (Historical/Time-Series Data)

### 2. Get Stream Data for Device Topic

**File**: `src/services/api.js`  
**Function**: `getStreamData(deviceId, topic, startTime, endTime, pagination, pageSize)`  
**Endpoint**: `POST /get-stream-data/device/topic`  
**Authentication**: Required (X-Token header)

**Request Payload**:
```json
{
  "deviceId": "device9988",
  "topic": "fleetMS/temperature",
  "startTime": "2026-01-12T00:00:00Z",
  "endTime": "2026-01-12T23:59:59Z",
  "pagination": "0",
  "pageSize": "100"
}
```

**Important Notes**:
- `pagination` and `pageSize` MUST be **strings**, not numbers
- `startTime` and `endTime` follow ISO-8601 format (UTC)

**Success Response**:
```json
{
  "status": "Success",
  "data": [
    {
      "id": "d94a68a3-3d52-4333-a18a-6cb5a474856e",
      "deviceId": "device9988",
      "topicSuffix": "fleetMS/temperature",
      "payload": "22.5",
      "timestamp": "2026-01-12T10:30:00.000Z"
    }
  ]
}
```

**Common Topics**:
- `fleetMS/temperature` - Device ambient temperature (°C)
- `fleetMS/humidity` - Relative humidity (%)
- `fleetMS/pressure` - Atmospheric pressure (hPa)
- `fleetMS/robots` - Robot discovery list (JSON)
- `fleetMS/robots/{robotId}/location` - Robot GPS position
- `fleetMS/robots/{robotId}/temperature` - Robot internal temp (°C)
- `fleetMS/robots/{robotId}/status` - Robot operational status
- `fleetMS/robots/{robotId}/battery` - Robot battery level (%)
- `fleetMS/robots/{robotId}/tasks` - Robot task info

---

### 3. Get All Stream Data for Device

**File**: `src/services/api.js`  
**Function**: `getAllStreamData(deviceId, startTime, endTime, pagination, pageSize)`  
**Endpoint**: `POST /get-stream-data/device`  
**Authentication**: Required (X-Token header)

**Request Payload**:
```json
{
  "deviceId": "device9988",
  "startTime": "2026-01-12T00:00:00Z",
  "endTime": "2026-01-12T23:59:59Z",
  "pagination": "0",
  "pageSize": "100"
}
```

**Success Response**:
```json
{
  "status": "Success",
  "data": [
    {
      "timestamp": "2026-01-12T10:30:00Z",
      "temperature": 22.3,
      "humidity": 45.2,
      "pressure": 1013
    }
  ]
}
```

**Use Cases**:
- Dashboard overview charts
- Multi-sensor data visualization
- Historical trend analysis

---

### 4. Get Stream Data for All User Devices

**File**: `src/services/api.js`  
**Function**: `getUserStreamData(startTime, endTime, pagination, pageSize)`  
**Endpoint**: `POST /get-stream-data/user`  
**Authentication**: Required (X-Token header)

**Request Payload**:
```json
{
  "startTime": "2026-01-12T00:00:00Z",
  "endTime": "2026-01-12T23:59:59Z",
  "pagination": "0",
  "pageSize": "100"
}
```

**Success Response**:
```json
{
  "status": "Success",
  "data": [
    {
      "deviceId": "device9988",
      "timestamp": "2026-01-12T10:30:00Z",
      "temperature": 22.3,
      "humidity": 45.2
    },
    {
      "deviceId": "deviceA72Q",
      "timestamp": "2026-01-12T10:30:00Z",
      "temperature": 21.8,
      "humidity": 48.1
    }
  ]
}
```

**Use Cases**:
- Multi-device fleet dashboard
- Cross-device comparison analytics
- Fleet-wide reporting

---

## 🎛️ State Data Requests (Device Control & Status)

### 5. Get All Device States

**File**: `src/services/api.js`  
**Function**: `getStateDetails(deviceId)`  
**Endpoint**: `POST /get-state-details/device`  
**Authentication**: Required (X-Token header)

**Request Payload**:
```json
{
  "deviceId": "device9988"
}
```

**Success Response**:
```json
{
  "status": "Success",
  "data": {
    "ac": { 
      "status": "ON" 
    },
    "airPurifier": { 
      "status": "ACTIVE" 
    },
    "status": { 
      "gateway_health": "NOMINAL", 
      "active_alert": null 
    }
  }
}
```

**Use Cases**:
- Dashboard control panel initialization
- Device status overview
- State synchronization on page load (called in `DeviceContext.jsx`)

---

### 6. Get Specific State for Device Topic

**File**: `src/services/api.js`  
**Function**: `getStateDetailsByTopic(deviceId, topic)`  
**Endpoint**: `POST /get-state-details/device/topic`  
**Authentication**: Required (X-Token header)

**Request Payload**:
```json
{
  "deviceId": "device9988",
  "topic": "fleetMS/ac"
}
```

**Success Response**:
```json
{
  "status": "Success",
  "data": {
    "payload": { 
      "status": "ON" 
    },
    "timestamp": "2026-01-12T10:30:00.000Z"
  }
}
```

**Available State Topics**:
- `fleetMS/ac` - AC power control (ON/OFF)
- `fleetMS/airPurifier` - Air purifier control (ACTIVE/INACTIVE/MAINTENANCE)
- `fleetMS/status` - Device operational status (NOMINAL/DEGRADED/CRITICAL)
- `fleetMS/robots/{robotId}/tasks` - Robot task control

---

### 7. Update Device State (Primary Control API) ⭐

**File**: `src/services/api.js`  
**Function**: `updateState(deviceId, topic, payload)`  
**Endpoint**: `POST /update-state-details`  
**Authentication**: Required (X-Token header)

**Request Payload (Turn AC ON)**:
```json
{
  "deviceId": "device9988",
  "topic": "fleetMS/ac",
  "payload": { 
    "status": "ON" 
  }
}
```

**Request Payload (Turn AC OFF)**:
```json
{
  "deviceId": "device9988",
  "topic": "fleetMS/ac",
  "payload": { 
    "status": "OFF" 
  }
}
```

**Request Payload (Activate Air Purifier)**:
```json
{
  "deviceId": "device9988",
  "topic": "fleetMS/airPurifier",
  "payload": { 
    "status": "ACTIVE" 
  }
}
```

**Request Payload (Air Purifier Maintenance Mode)**:
```json
{
  "deviceId": "device9988",
  "topic": "fleetMS/airPurifier",
  "payload": { 
    "status": "MAINTENANCE" 
  }
}
```

**Request Payload (Assign Robot Task)**:
```json
{
  "deviceId": "device9988",
  "topic": "fleetMS/robots/robot-001/tasks",
  "payload": {
    "taskId": "task-001",
    "type": "patrol",
    "destination": { 
      "lat": 37.7749, 
      "lng": -122.4194 
    },
    "priority": "high"
  }
}
```

**Success Response**:
```json
{
  "status": "Success",
  "message": "State updated successfully"
}
```

**Backend Flow**:
1. API receives state update request
2. Validates device ownership and authorization
3. Forwards update to MQTT broker
4. MQTT broker publishes to: `protonest/<deviceId>/state/fleetMS/<topic>`
5. IoT device receives and executes command

---

## 🗑️ Data Deletion Requests

### 8. Delete Specific Stream Data Records

**File**: `src/services/api.js`  
**Function**: `deleteStreamData(deviceId, topic, dataIds)`  
**Endpoint**: `DELETE /delete-stream-data-by-id`  
**Authentication**: Required (X-Token header)

**Request Payload**:
```json
{
  "deviceId": "device9988",
  "topic": "fleetMS/temperature",
  "dataIds": [
    "uuid-1234-5678-abcd",
    "uuid-5678-1234-efgh"
  ]
}
```

**Success Response**:
```json
{
  "status": "Success",
  "message": "Stream data deleted successfully"
}
```

**Note**: Uses `axios.delete()` with data in the `data` property (not `body`)

---

### 9. Delete State Topic

**File**: `src/services/api.js`  
**Function**: `deleteStateTopic(deviceId, topic)`  
**Endpoint**: `DELETE /delete-state-topic`  
**Authentication**: Required (X-Token header)

**Request Payload**:
```json
{
  "deviceId": "device9988",
  "topic": "fleetMS/customTopic"
}
```

**Success Response**:
```json
{
  "status": "Success",
  "message": "State topic deleted successfully"
}
```

---

## 🔧 Helper/Convenience Functions (Built on Top of Core APIs)

### 10. Fetch Chart Data for Specific Metric

**File**: `src/services/api.js`  
**Function**: `fetchChartData(deviceId, metric, timeRange)`  
**Built On**: `getStreamData()`

**Parameters**:
- `deviceId`: Device ID (e.g., "device9988")
- `metric`: Metric name (e.g., "temperature", "humidity", "pressure")
- `timeRange`: Time range (e.g., "1h", "6h", "12h", "24h", "7d")

**Internal Implementation**:
```javascript
const { startTime, endTime } = getTimeRange(timeRange);
const response = await getStreamData(
  deviceId,
  `fleetMS/${metric}`,
  startTime,
  endTime,
  0,
  500
);
```

**Returns** (Transformed Data):
```json
[
  {
    "timestamp": 1736678400000,
    "time": "10:30 AM",
    "fullTime": "2026-01-12T10:30:00Z",
    "value": 22.5
  }
]
```

---

### 11. Fetch All Chart Data (Combined Sensors)

**File**: `src/services/api.js`  
**Function**: `fetchAllChartData(deviceId, timeRange)`  
**Built On**: `getAllStreamData()`

**Parameters**:
- `deviceId`: Device ID
- `timeRange`: Time range

**Returns** (Transformed Data):
```json
[
  {
    "timestamp": 1736678400000,
    "time": "10:30 AM",
    "fullTime": "2026-01-12T10:30:00Z",
    "temp": 22.3,
    "humidity": 45.2,
    "pressure": 1013
  }
]
```

---

### 12. Toggle AC Power

**File**: `src/services/api.js`  
**Function**: `toggleAC(deviceId, turnOn)`  
**Built On**: `updateState()`

**Implementation**:
```javascript
return updateState(deviceId, "fleetMS/ac", {
  status: turnOn ? "ON" : "OFF"
});
```

---

### 13. Set Air Purifier Mode

**File**: `src/services/api.js`  
**Function**: `setAirPurifier(deviceId, mode)`  
**Built On**: `updateState()`

**Parameters**:
- `mode`: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'

**Implementation**:
```javascript
return updateState(deviceId, "fleetMS/airPurifier", {
  status: mode
});
```

---

### 14. Assign Robot Task

**File**: `src/services/api.js`  
**Function**: `assignRobotTask(deviceId, robotId, taskPayload)`  
**Built On**: `updateState()`

**Implementation**:
```javascript
return updateState(deviceId, `fleetMS/robots/${robotId}/tasks`, taskPayload);
```

---

## 🌐 WEBSOCKET REAL-TIME DATA

### WebSocket Connection

**Connection URL Format:**

```
wss://api.protonestconnect.co/ws?token={encoded_jwt_token}
```

### Simplified Topic Structure

**This system subscribes to ONLY 2 topics per device:**

1. **Stream Topic**: `/topic/protonest/{deviceId}/stream`
   - All sensor data (temperature, humidity, pressure)
   - Robot discovery messages
   - Robot telemetry (location, battery, temperature, status, tasks)

2. **State Topic**: `/topic/protonest/{deviceId}/state`
   - Device control states (AC, air purifier)
   - Device status updates
   - Robot command confirmations

**All data routing is handled internally** - robot-specific data includes a `robotId` field in the payload.

### Message Routing Logic

**Stream Topic Messages** are routed based on payload structure:

```javascript
// Device temperature: { ambient_temp, ambient_hum, atmospheric_pressure }
if (payload.ambient_temp !== undefined) {
  handleTemperatureUpdate(deviceId, payload);
}

// Robot discovery: { robots: ["robot-001", "robot-002"] }
if (payload.robots !== undefined) {
  handleRobotsDiscovery(deviceId, payload);
}

// Robot location: { robotId: "robot-001", lat, lng, z, heading }
if (payload.robotId && payload.lat !== undefined) {
  handleRobotLocationUpdate(deviceId, payload.robotId, payload);
}

// Robot battery: { robotId: "robot-001", battery: 85 }
if (payload.robotId && payload.battery !== undefined) {
  handleRobotBatteryUpdate(deviceId, payload.robotId, payload);
}
```

**State Topic Messages** are routed similarly:

```javascript
// AC control: { ac_power: "ON" }
if (payload.ac_power !== undefined) {
  handleACUpdate(deviceId, payload);
}

// Robot task: { robotId: "robot-001", task: {...} }
if (payload.robotId && payload.task !== undefined) {
  handleRobotTaskUpdate(deviceId, payload.robotId, payload);
}
```
### WebSocket Connection Setup

**File**: `src/services/webSocketClient.js`  
**Class**: `WebSocketClient`  
**Method**: `connect(token)`  
**Connection URL**: `wss://api.protonestconnect.co/ws?token={encoded_jwt_token}`

**Connection Flow**:
```javascript
const encodedToken = encodeURIComponent(jwtToken);
const wsUrl = `${WS_BASE_URL}?token=${encodedToken}`;

await webSocketClient.connect(jwtToken);
```

**Protocol**: STOMP over WebSocket

**Configuration**:
```javascript
{
  brokerURL: wsUrl,
  reconnectDelay: 5000,      // 5 seconds
  heartbeatIncoming: 4000,   // 4 seconds
  heartbeatOutgoing: 4000    // 4 seconds
}
```

---

## 📡 WebSocket Subscriptions

### STOMP Topic Format

**Device-Level Topics**:
- Stream: `/topic/protonest/{deviceId}/stream`
- State: `/topic/protonest/{deviceId}/state`

**Robot-Level Topics**:
- Location: `/topic/protonest/{deviceId}/stream/fleetMS/robots/{robotId}/location`
- Temperature: `/topic/protonest/{deviceId}/stream/fleetMS/robots/{robotId}/temperature`
- Status: `/topic/protonest/{deviceId}/stream/fleetMS/robots/{robotId}/status`
- Battery: `/topic/protonest/{deviceId}/stream/fleetMS/robots/{robotId}/battery`
- Tasks (Stream): `/topic/protonest/{deviceId}/stream/fleetMS/robots/{robotId}/tasks`
- Tasks (State): `/topic/protonest/{deviceId}/state/fleetMS/robots/{robotId}/tasks`

### WebSocket Message Formats

**Device Temperature Message**:
```json
{
  "ambient_temp": 22.5,
  "ambient_hum": 45.2,
  "atmospheric_pressure": 1013
}
```

**Robot Discovery Message**:
```json
{
  "robots": ["robot-001", "robot-002", "robot-003"]
}
```

**Robot Location Message**:
```json
{
  "lat": 37.7749,
  "lng": -122.4194,
  "z": 1,
  "heading": 45
}
```

**Robot Status Message**:
```json
{
  "battery": 85,
  "load": "Package A-123",
  "status": "MOVING",
  "connectivity": "ONLINE"
}
```

**Robot Battery Message**:
```json
{
  "level": 85,
  "charging": false,
  "estimatedRuntime": 180
}
```

---

## 🔑 Authentication & Headers

### Axios Interceptor Configuration

**File**: `src/services/api.js`

**Request Interceptor** (Adds JWT to every request):
```javascript
api.interceptors.request.use((config) => {
  const token = getToken(); // from localStorage
  if (token) {
    config.headers["X-Token"] = token;
  }
  return config;
});
```

**Response Interceptor** (Handles errors):
```javascript
api.interceptors.response.use(
  (response) => {
    console.log("📥 API Response:", response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error("❌ API Error:", error.response?.status, error.config?.url);
    
    if (error.response?.status === 401) {
      console.warn("🔐 Unauthorized - token may be expired");
      // Could trigger token refresh here
    }
    
    return Promise.reject(error);
  }
);
```

---

## ⏰ Time Range Utility

**File**: `src/services/api.js`  
**Function**: `getTimeRange(range)`

**Supported Ranges**:
- `"1m"` - 1 minute
- `"5m"` - 5 minutes
- `"15m"` - 15 minutes
- `"1h"` - 1 hour
- `"6h"` - 6 hours
- `"12h"` - 12 hours
- `"24h"` - 24 hours
- `"7d"` - 7 days
- `"30d"` - 30 days

**Returns**:
```json
{
  "startTime": "2026-01-12T04:30:00Z",
  "endTime": "2026-01-12T10:30:00Z"
}
```

**Implementation**:
```javascript
const now = new Date();
const rangeMs = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  ...
};
const startDate = new Date(now.getTime() - rangeMs[range]);

return {
  startTime: startDate.toISOString().split(".")[0] + "Z",
  endTime: now.toISOString().split(".")[0] + "Z"
};
```

---

## 📋 Complete HTTP Request Summary

| # | Method | Endpoint | Function | Authentication |
|---|--------|----------|----------|----------------|
| 1 | POST | `/get-token` | `login()` | No |
| 2 | POST | `/get-stream-data/device/topic` | `getStreamData()` | Yes |
| 3 | POST | `/get-stream-data/device` | `getAllStreamData()` | Yes |
| 4 | POST | `/get-stream-data/user` | `getUserStreamData()` | Yes |
| 5 | POST | `/get-state-details/device` | `getStateDetails()` | Yes |
| 6 | POST | `/get-state-details/device/topic` | `getStateDetailsByTopic()` | Yes |
| 7 | POST | `/update-state-details` | `updateState()` | Yes |
| 8 | DELETE | `/delete-stream-data-by-id` | `deleteStreamData()` | Yes |
| 9 | DELETE | `/delete-state-topic` | `deleteStateTopic()` | Yes |

### Helper Functions (Built on Core APIs)

| # | Function | Built On | Purpose |
|---|----------|----------|---------|
| 10 | `fetchChartData()` | `getStreamData()` | Chart visualization |
| 11 | `fetchAllChartData()` | `getAllStreamData()` | Multi-sensor charts |
| 12 | `toggleAC()` | `updateState()` | AC control |
| 13 | `setAirPurifier()` | `updateState()` | Air purifier control |
| 14 | `assignRobotTask()` | `updateState()` | Robot task assignment |

---

## ⚠️ Common Error Handling

### HTTP Error Codes

| Status | Error Type | Handling Strategy |
|--------|-----------|-------------------|
| 400 | Bad Request / Invalid Token | Validate inputs, refresh token |
| 401 | Unauthorized | Redirect to login, clear tokens |
| 405 | Method Not Allowed | Check HTTP method (POST vs GET) |
| 500 | Server Error | Retry with exponential backoff |

### Device Authorization Error

**Response**:
```json
{
  "status": "Error",
  "data": "Device does not belong to the user"
}
```

**Solution**: Verify device ID is registered to the authenticated user

---

## 🔧 Environment Variables

**File**: `.env`

```env
# API Configuration
VITE_API_BASE_URL=https://api.protonestconnect.co/api/v1/user

# WebSocket Configuration
VITE_WS_URL=wss://api.protonestconnect.co/ws

# Auto-Login Credentials
VITE_USER_EMAIL=your_email@example.com
VITE_USER_PASSWORD=your_secret_key
```

---

## 📚 Implementation Files

1. **`src/services/authService.js`** - Authentication logic
2. **`src/services/api.js`** - HTTP API client (Axios)
3. **`src/services/webSocketClient.js`** - WebSocket client (STOMP)
4. **`src/contexts/AuthContext.jsx`** - Auth state management
5. **`src/contexts/StompContext.jsx`** - WebSocket state management
6. **`src/contexts/DeviceContext.jsx`** - Device & robot state management

---

**Generated**: 2026-01-12T16:33:56+05:30  
**Version**: Fleet Management System v1.0
