# Robot Task Assignment Implementation

## ✅ **Implementation Complete**

The robot task assignment functionality has been fully implemented using HTTP `/update-state-details` and `/get-state-details` endpoints.

---

## 🎯 **Architecture**

### **Task Assignment Flow**

```
User assigns task to robot
         ↓
HTTP POST /update-state-details
{
  "deviceId": "deviceTestUC",
  "topic": "fleetMS/robots/<robotID>/task",
  "payload": {
    "taskId": "TSK-001",
    "taskName": "Transport Material",
    "location": "Zone A → Zone B",
    "priority": "High",
    "status": "Assigned"
  }
}
         ↓
Backend creates/updates topic
         ↓
Task History fetches tasks
         ↓
HTTP POST /get-state-details/device
         ↓
Parses robot task topics
         ↓
Displays in Task History table
```

---

## 📡 **API Functions**

### **1. Assign Task to Robot**

```javascript
// src/services/api.js
assignTaskToRobot(deviceId, robotId, taskData)
```

**Parameters:**
- `deviceId` - Device ID (e.g., "deviceTestUC")
- `robotId` - Robot ID (e.g., "R-001", "robot-alpha")
- `taskData` - Object containing:
  - `taskId` - Unique task identifier
  - `taskName` - Human-readable task name
  - `location` - Target location or route
  - `priority` - Task priority (Low/Normal/High/Critical)
  - `status` - Task status (Assigned/In Progress/Completed)
  - Any other custom fields

**HTTP Request:**
```http
POST /update-state-details
Headers: X-Token: <JWT>
Body:
{
  "deviceId": "deviceTestUC",
  "topic": "fleetMS/robots/R-001/task",
  "payload": {
    "taskId": "TSK-123",
    "taskName": "Transport Material",
    "location": "Cleanroom A → Storage",
    "priority": "High",
    "status": "Assigned"
  }
}
```

**Response:**
```json
{
  "status": "Success",
  "message": "State updated successfully"
}
```

---

### **2. Fetch Robot Tasks**

```javascript
// src/pages/Analysis.jsx
fetchRobotData()
```

**HTTP Request:**
```http
POST /get-state-details/device
Headers: X-Token: <JWT>
Body:
{
  "deviceId": "deviceTestUC"
}
```

**Response:**
```json
{
  "status": "Success",
  "data": {
    "fleetMS/ac": "ON",
    "fleetMS/airPurifier": "AUTO",
    "fleetMS/robots/R-001/task": "{\"taskId\":\"TSK-123\",\"taskName\":\"Transport\",\"status\":\"Active\"}",
    "fleetMS/robots/R-002/task": "{\"taskId\":\"TSK-456\",\"taskName\":\"Inspection\",\"status\":\"Assigned\"}"
  }
}
```

**Data Transformation:**
```javascript
// Extract robot tasks from state
Object.entries(response.data).forEach(([topicKey, value]) => {
    if (topicKey.includes('fleetMS/robots/') && topicKey.includes('/task')) {
        const robotId = extractRobotIdFromTopic(topicKey);
        const taskData = JSON.parse(value);
        
        robots.push({
            robotId: robotId,
            taskId: taskData.taskId,
            taskName: taskData.taskName,
            status: taskData.status,
            location: taskData.location,
            priority: taskData.priority
        });
    }
});
```

---

## 🎨 **Task Data Structure**

### **Recommended Payload Fields**

```javascript
{
  // Required fields
  "taskId": "TSK-001",
  "taskName": "Transport Material",
  "status": "Assigned",  // Assigned | In Progress | Completed | Failed
  
  // Recommended fields
  "priority": "High",    // Low | Normal | High | Critical
  "location": "Zone A → Zone B",
  "targetLocation": "Storage Area 3",
  "estimatedDuration": "15min",
  
  // Optional fields
  "assignedBy": "Operator-123",
  "assignedAt": "2026-01-13T12:30:00Z",
  "startedAt": null,
  "completedAt": null,
  "robotId": "R-001",
  "description": "Move chemical containers from clean room to storage",
  "requirements": ["Chemical handling", "Clean room access"]
}
```

---

## 🔄 **Auto-Refresh Behavior**

### **Task History Updates**

The Task History table automatically refreshes every 30 seconds:

```
0s    → Page loads (fetch from /get-state-details)
30s   → Auto-refresh #1 (fetch tasks again)
60s   → Auto-refresh #2
90s   → Auto-refresh #3
...
```

**Console Output:**
```
[Analysis] 🤖 Fetching robot task data from STATE
[Analysis] 📥 State HTTP Response:
   Status: Success
   Data keys: fleetMS/ac, fleetMS/robots/R-001/task, fleetMS/robots/R-002/task
[Analysis] ✅ Robot task data updated: 2 robots with tasks
```

---

## 💡 **Topic Auto-Creation**

### **How It Works**

When you assign a task to a robot:

1. **Topic doesn't exist** → Backend creates new topic automatically
   ```
   POST /update-state-details
   Topic: fleetMS/robots/R-001/task
   → New topic created
   ```

2. **Topic exists** → Backend updates existing value
   ```
   POST /update-state-details
   Topic: fleetMS/robots/R-001/task
   → Existing topic updated
   ```

3. **Multiple robots** → Each robot has its own topic
   ```
   fleetMS/robots/R-001/task
   fleetMS/robots/R-002/task
   fleetMS/robots/R-003/task
   ```

---

## 📊 **Task History Table**

### **Displayed Columns**

| Column | Field | Description |
|--------|-------|-------------|
| **Task ID** | `taskId` | Unique task identifier |
| **Task Name** | `taskName` | Human-readable task description |
| **Robot ID** | `robotId` | Extracted from topic |
| **Status** | `status` | Current task status with colored badge |

### **Status Badge Colors**

```javascript
// Completed - Green
{ status: "Completed" } → Green badge

// In Progress - Blue  
{ status: "In Progress" } → Blue badge

// Assigned - Amber
{ status: "Assigned" } → Amber badge

// Failed - Red
{ status: "Failed" } → Red badge
```

---

## 🛠️ **Usage Example**

### **Assign Task from Robot Settings**

```javascript
import { assignTaskToRobot } from '../services/api';

// In robot settings modal/form
const handleAssignTask = async () => {
    try {
        const taskData = {
            taskId: generateTaskId(),  // e.g., "TSK-001"
            taskName: "Transport Material",
            location: "Cleanroom A → Storage",
            priority: "High",
            status: "Assigned",
            assignedAt: new Date().toISOString(),
            estimatedDuration: "15min"
        };
        
        await assignTaskToRobot(
            selectedDeviceId,
            selectedRobotId,
            taskData
        );
        
        alert('Task assigned successfully!');
        
        // Refresh task history
        fetchRobotData();
    } catch (error) {
        console.error('Task assignment failed:', error);
        alert('Failed to assign task');
    }
};
```

---

## 🔍 **Debugging**

### **Console Logs**

**Task Assignment:**
```
[API] 📡 POST /update-state-details (Assign Task to Robot)
[API] Robot ID: R-001
[API] Task Data: { taskId: "TSK-123", taskName: "Transport", ... }
[API] ✅ Task assigned successfully
```

**Task Fetching:**
```
[Analysis] 🤖 Fetching robot task data from STATE
[Analysis] 📥 State HTTP Response:
   Status: Success
   Data keys: fleetMS/ac, fleetMS/robots/R-001/task
[Analysis] ✅ Robot task data updated: 1 robots with tasks
```

### **Network Tab**

**Request:**
```
POST /api/v1/user/update-state-details
Headers:
  X-Token: eyJhbGciOiJIUzI1NiIs...
Body:
{
  "deviceId": "deviceTestUC",
  "topic": "fleetMS/robots/R-001/task",
  "payload": {
    "taskId": "TSK-123",
    "taskName": "Transport Material"
  }
}
```

**Response:**
```
200 OK
{
  "status": "Success"
}
```

---

## ✅ **Implementation Checklist**

### **Backend Requirements**
- [x] `/update-state-details` endpoint accepts topic and payload
- [x] Auto-creates topics if they don't exist
- [x] `/get-state-details` returns all state topics
- [x] Topics persisted in database

### **Frontend Implementation**
- [x] `assignTaskToRobot()` function created
- [x] Task History fetches from `/get-state-details`
- [x] Task data parsed from state topics
- [x] Auto-refresh every 30 seconds
- [x] Manual refresh button
- [x] Task table displays robot tasks

### **Data Flow**
- [x] Assign task → Update state API
- [x] Fetch tasks → Get state details API
- [x] Parse robot task topics
- [x] Display in UI table
- [x] Auto-refresh working

---

## 📝 **Summary**

**Task Assignment System:**
- ✅ HTTP POST to `/update-state-details`
- ✅ Topic: `fleetMS/robots/<robotID>/task`
- ✅ Payload: Task details (taskId, taskName, etc.)
- ✅ Auto-creation of topics
- ✅ Fetch from `/get-state-details`
- ✅ Display in Task History table
- ✅ Auto-refresh every 30 seconds

**The robot task assignment system is now fully functional!** 🚀

