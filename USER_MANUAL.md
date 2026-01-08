# 📖 Fabrix - User Manual

<div align="center">

**Complete Guide to Using the Fleet Management System**

Version 1.0 | Last Updated: January 2026

</div>

---

## 📋 Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Dashboard Overview](#3-dashboard-overview)
4. [Robot Fleet Monitoring](#4-robot-fleet-monitoring)
5. [Facility Map](#5-facility-map)
6. [Environmental Monitoring](#6-environmental-monitoring)
7. [Alerts & Notifications](#7-alerts--notifications)
8. [Analysis Page](#8-analysis-page)
9. [Settings & Configuration](#9-settings--configuration)
10. [Best Practices](#10-best-practices)

---

## 1. Introduction

### What is Fabrix?

Fabrix is a real-time fleet management dashboard designed for monitoring and controlling autonomous robots in industrial environments. It provides:

- **Live robot tracking** with position updates every second
- **Environmental monitoring** of temperature, humidity, and pressure
- **Device control** for HVAC and air purification systems
- **Historical data analysis** with exportable reports
- **Smart alerts** for critical conditions

### Who Should Use This Manual?

- **Facility Managers** - Monitor overall fleet status and environment
- **Operators** - Track individual robot tasks and assignments
- **Maintenance Staff** - View alerts and device status
- **Analysts** - Generate reports from historical data

---

## 2. Getting Started

### 2.1 Logging In

When you launch Fabrix, the system automatically authenticates using pre-configured credentials. You'll see:

1. **Loading Screen** - Displays while connecting to the server
2. **Authenticating** - JWT token retrieval in progress
3. **Connecting WebSocket** - Real-time data channel establishing

Once connected, you'll be redirected to the Dashboard.

### 2.2 Understanding the Interface

The interface consists of three main areas:

```
┌────────────────────────────────────────────────────────────┐
│                      HEADER BAR                            │
│  Logo | Dashboard Title | Connection Status | User Menu    │
├────────────┬───────────────────────────────────────────────┤
│            │                                               │
│  SIDEBAR   │              MAIN CONTENT AREA                │
│            │                                               │
│ • Dashboard│   (Dashboard / Analysis / Settings)           │
│ • Analysis │                                               │
│ • Settings │                                               │
│            │                                               │
└────────────┴───────────────────────────────────────────────┘
```

### 2.3 Navigation

Use the **Sidebar** to switch between pages:

| Icon | Page      | Purpose                    |
| ---- | --------- | -------------------------- |
| 📊   | Dashboard | Real-time monitoring       |
| 📈   | Analysis  | Historical data & charts   |
| ⚙️   | Settings  | Configuration & thresholds |

---

## 3. Dashboard Overview

The Dashboard is your primary monitoring interface, divided into four main panels:

### 3.1 Layout

```
┌─────────────────────────┬─────────────────────────┐
│                         │                         │
│    FACILITY MAP         │    ROBOT FLEET PANEL    │
│    (Interactive)        │    (Robot Cards)        │
│                         │                         │
├─────────────────────────┼─────────────────────────┤
│                         │                         │
│    ENVIRONMENT PANEL    │    ALERTS PANEL         │
│    (Sensors + Controls) │    (Notifications)      │
│                         │                         │
└─────────────────────────┴─────────────────────────┘
```

### 3.2 Device Selector

At the top of the Dashboard, you'll find a **Device Selector** dropdown. Use this to switch between monitoring different devices:

- **Device 9988** - Cleanroom A
- **Device 0011233** - Cleanroom B
- **Device A72Q** - Loading Bay
- **Device ZX91** - Storage

> 💡 **Tip**: The selected device persists across sessions.

### 3.3 Connection Status

Look for the connection indicator in the header:

| Status            | Meaning                          |
| ----------------- | -------------------------------- |
| 🟢 **ONLINE**     | Connected to real-time data      |
| 🔴 **OFFLINE**    | Disconnected - data may be stale |
| 🟡 **CONNECTING** | Attempting to reconnect          |

---

## 4. Robot Fleet Monitoring

### 4.1 Robot Fleet Panel

The Robot Fleet Panel displays cards for each detected robot with the following information:

#### Robot Card Anatomy

```
┌─────────────────────────────────────┐
│ [R1]  robot-001                     │
│       🟢 ACTIVE                     │
├─────────────────────────────────────┤
│ 🔋 Battery    ████████░░  85%       │
│ 🌡️ Temp       32.5°C                │
│ 📦 Load       FOUP-A7               │
│ 📍 Position   0.4521, 0.7832        │
├─────────────────────────────────────┤
│ Current Task: MOVE_FOUP             │
│ Progress:     ███████░░░  72%       │
│ Route:        Cleanroom A → Storage │
└─────────────────────────────────────┘
```

### 4.2 Robot Status Indicators

| Status            | Color    | Description                                   |
| ----------------- | -------- | --------------------------------------------- |
| **ACTIVE/MOVING** | 🟢 Green | Robot is executing a task                     |
| **CHARGING**      | 🟡 Amber | Robot is at charging station                  |
| **IDLE**          | ⚪ Gray  | Robot is waiting for tasks                    |
| **ERROR**         | 🔴 Red   | Robot has encountered an issue                |
| **STOPPED**       | 🔴 Red   | Robot is stopped (manual intervention needed) |

### 4.3 Fleet Statistics

At the top of the Robot Fleet Panel, you'll see summary statistics:

- **Total**: Number of robots detected
- **Active**: Robots currently executing tasks
- **Charging**: Robots at charging stations
- **Error**: Robots requiring attention

### 4.4 Monitoring Battery Levels

Battery indicators use color coding:

| Level  | Color    | Action Needed                 |
| ------ | -------- | ----------------------------- |
| > 60%  | 🟢 Green | Normal operation              |
| 30-60% | 🟡 Amber | Schedule charging             |
| < 30%  | 🔴 Red   | Critical - immediate charging |

---

## 5. Facility Map

### 5.1 Map Overview

The interactive Facility Map provides a visual representation of your workspace with:

- **Zones** - Defined areas (Cleanrooms, Loading Bay, Storage, Maintenance)
- **Robot Markers** - Real-time robot positions
- **Status Dots** - Color-coded robot health

### 5.2 Zone Types

| Zone          | Color       | Purpose                      |
| ------------- | ----------- | ---------------------------- |
| Cleanroom A/B | Blue tint   | Controlled environment areas |
| Loading Bay   | Green tint  | Material handling area       |
| Storage       | Purple tint | Inventory storage            |
| Maintenance   | Orange tint | Robot service area           |

### 5.3 Interacting with Robots

**Click on any robot marker** to view detailed information:

```
┌─────────────────────────────┐
│ ROBOT R-001                 │
├─────────────────────────────┤
│ STATUS:     🟢 ACTIVE       │
│ BATTERY:    85%             │
│ CURRENT TASK: MOVE_FOUP     │
│ TASK PROGRESS: 72%          │
└─────────────────────────────┘
```

Click elsewhere or on the same marker to close the tooltip.

### 5.4 Active Tasks Overlay

When robots have active tasks, an overlay shows:

- Number of robots currently executing tasks
- Real-time task progress

---

## 6. Environmental Monitoring

### 6.1 Device Environment Panel

This panel displays sensor readings for the selected device:

| Metric          | Unit | Typical Range |
| --------------- | ---- | ------------- |
| **Temperature** | °C   | 20-28°C       |
| **Humidity**    | %    | 30-60%        |
| **Pressure**    | hPa  | 980-1040 hPa  |

### 6.2 Device Controls

#### AC Control

Toggle the AC unit on/off:

- **ON** - Cooling active
- **OFF** - Cooling inactive

#### Air Purifier Control

Adjust air purifier settings:

- **OFF** - Purifier disabled
- **LOW** - Low fan speed
- **MEDIUM** - Medium fan speed
- **HIGH** - High fan speed

> ⚠️ **Note**: Control changes are sent to the IoT device. Allow 2-3 seconds for status to update.

### 6.3 Gateway Health

The panel shows gateway connection status:

- **HEALTHY** - Device communicating normally
- **DEGRADED** - Intermittent communication
- **OFFLINE** - Device not responding

---

## 7. Alerts & Notifications

### 7.1 Alerts Panel

The Alerts Panel displays real-time warnings and notifications:

#### Alert Types

| Icon | Type     | Priority | Example                       |
| ---- | -------- | -------- | ----------------------------- |
| 🔴   | Critical | High     | Robot Error, System Failure   |
| 🟡   | Warning  | Medium   | Low Battery, High Temperature |
| 🔵   | Info     | Low      | Task Completed, Robot Charged |

### 7.2 Alert Categories

**Robot Alerts**

- Low battery (< 20%)
- Temperature exceeds threshold
- Robot error state
- Task failure

**Environment Alerts**

- Temperature out of range
- Humidity out of range
- Gateway offline

### 7.3 Acknowledging Alerts

Click on an alert to expand details. Alerts automatically clear when conditions return to normal.

---

## 8. Analysis Page

### 8.1 Overview

The Analysis page provides historical data visualization and export capabilities.

### 8.2 Time Range Selection

Select the time period to analyze:

| Option | Period        |
| ------ | ------------- |
| 1h     | Last 1 hour   |
| 6h     | Last 6 hours  |
| 12h    | Last 12 hours |
| 24h    | Last 24 hours |
| 7d     | Last 7 days   |
| 30d    | Last 30 days  |

### 8.3 Metric Filters

Toggle which metrics to display on the chart:

- 🌡️ **Temperature** - Ambient temperature readings
- 💧 **Humidity** - Humidity percentage
- 🔋 **Battery** - Robot battery levels (average)

Click the metric buttons to show/hide data series.

### 8.4 Interactive Chart

The line chart provides:

- **Hover tooltips** - View exact values at any point
- **Legend** - Click to toggle series visibility
- **Auto-scaling** - Y-axis adjusts to data range

### 8.5 Task History Table

Below the chart, view recent robot tasks:

| Column    | Description       |
| --------- | ----------------- |
| Task ID   | Unique identifier |
| Task Name | Type of operation |
| Robot ID  | Assigned robot    |
| Status    | Current status    |

### 8.6 Exporting Data

Click **Export CSV** to download the current data:

1. Select desired time range
2. Enable relevant metrics
3. Click **Export CSV**
4. File downloads as `fabrix_analysis_YYYY-MM-DD.csv`

The CSV includes:

- Timestamp
- Temperature
- Humidity
- Battery level

### 8.7 Refreshing Data

Click the **Refresh** button (🔄) to fetch the latest data from the API.

---

## 9. Settings & Configuration

### 9.1 Device Settings

Configure threshold alerts for environmental monitoring:

#### Temperature Thresholds

- **Min Temperature** (°C) - Alert when below this value
- **Max Temperature** (°C) - Alert when above this value

#### Humidity Thresholds

- **Min Humidity** (%) - Alert when below this value
- **Max Humidity** (%) - Alert when above this value

#### Pressure Thresholds

- **Min Pressure** (hPa) - Alert when below this value
- **Max Pressure** (hPa) - Alert when above this value

#### Battery Threshold

- **Min Battery** (%) - Alert when robot battery falls below this value

### 9.2 System Mode

Select the operating mode:

| Mode       | Description                                      |
| ---------- | ------------------------------------------------ |
| **MANUAL** | All controls require manual operation            |
| **AUTO**   | System automatically adjusts based on thresholds |

### 9.3 Robot Settings

For each connected robot, configure:

#### Task Assignment

- Select task type (MOVE_FOUP, PICKUP, DELIVERY, etc.)
- Choose source location
- Choose destination location

#### Available Task Types

| Task        | Description              |
| ----------- | ------------------------ |
| MOVE_FOUP   | Transport FOUP container |
| PICKUP      | Pick up item at location |
| DELIVERY    | Deliver item to location |
| RETURN_HOME | Return to home position  |
| CHARGE      | Go to charging station   |

### 9.4 Saving Settings

Click **Save Device Settings** or **Save Robot Settings** to persist changes.

> ✅ Settings are stored locally and persist across sessions.

---

## 10. Best Practices

### 10.1 Daily Operations

1. **Start of Shift**

   - Check Dashboard for any overnight alerts
   - Verify all robots are accounted for
   - Review battery levels and charging status

2. **During Operations**

   - Monitor the Facility Map for robot positions
   - Keep alerts panel visible
   - Respond to low battery warnings promptly

3. **End of Shift**
   - Ensure all robots are charging or idle
   - Export Analysis data for records
   - Check for any unacknowledged alerts

### 10.2 Responding to Alerts

| Alert Type       | Recommended Action                    |
| ---------------- | ------------------------------------- |
| Low Battery      | Assign robot to charging station      |
| High Temperature | Check AC settings, verify ventilation |
| Robot Error      | Contact maintenance, check robot logs |
| Gateway Offline  | Verify network connectivity           |

### 10.3 Performance Tips

- **Use appropriate time ranges** in Analysis to avoid loading excessive data
- **Switch devices** to check on all zones periodically
- **Keep browser tab active** for real-time updates
- **Refresh data** if you notice stale readings

### 10.4 Troubleshooting Quick Reference

| Issue                   | Solution                                        |
| ----------------------- | ----------------------------------------------- |
| No real-time updates    | Check connection status, refresh page           |
| Robots not appearing    | Verify device selection, check WebSocket        |
| Controls not responding | Wait 3 seconds, try again                       |
| Charts not loading      | Select smaller time range, click Refresh        |
| Login issues            | Verify credentials in environment configuration |

---

## 📞 Support

For technical support or questions:

- Review [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- Check [API_REFERENCE.md](API_REFERENCE.md) for developer information
- Contact your system administrator

---

<div align="center">

**© 2026 Fabrix Fleet Management System**

</div>
