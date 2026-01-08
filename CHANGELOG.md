# 🔄 Changelog

All notable changes to the Fabrix Fleet Management System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned

- Robot task queue management
- Multi-user support with role-based access
- Push notifications for alerts
- Mobile-responsive design improvements
- Dark mode theme

---

## [1.0.0] - 2026-01-08

### Added

- **Dashboard Page**
  - Real-time facility map with robot tracking
  - Robot fleet panel with status cards
  - Environmental monitoring panel (temperature, humidity, pressure)
  - Alerts panel with notification system
  - Device selector for multi-device support
- **Robot Fleet Management**
  - Real-time robot position tracking
  - Battery level monitoring with color-coded indicators
  - Robot status tracking (Active, Charging, Idle, Error)
  - Task progress visualization
  - Robot temperature monitoring
- **Environmental Controls**
  - AC unit toggle control
  - Air purifier settings (Off, Low, Medium, High)
  - Real-time sensor data display
- **Analysis Page**
  - Historical data visualization with interactive charts
  - Multiple time range options (1h to 30d)
  - Metric filtering (Temperature, Humidity, Battery)
  - CSV data export functionality
  - Task history table
- **Settings Page**
  - Temperature threshold configuration
  - Humidity threshold configuration
  - Pressure threshold configuration
  - Battery alert threshold
  - System mode selection (Manual/Auto)
  - Robot task assignment interface
- **Authentication**
  - JWT-based authentication with ProtoNest backend
  - Automatic token refresh
  - Secure credential management via environment variables
- **Real-time Communication**
  - STOMP over WebSocket implementation
  - Automatic reconnection handling
  - Topic subscription management
  - Connection status indicators
- **Data Persistence**
  - Local storage for user preferences
  - Selected device persistence
  - Settings persistence across sessions

### Technical Stack

- React 19.2 with functional components and hooks
- Vite 7.2 for development and building
- TailwindCSS 4.1 for styling
- Recharts 3.6 for data visualization
- @stomp/stompjs 7.2 for WebSocket communication
- Axios 1.13 for HTTP requests

---

## Version History Template

### [X.Y.Z] - YYYY-MM-DD

#### Added

- New features

#### Changed

- Changes in existing functionality

#### Deprecated

- Soon-to-be removed features

#### Removed

- Removed features

#### Fixed

- Bug fixes

#### Security

- Vulnerability fixes

---

<div align="center">

**Fabrix Fleet Management System**

</div>
