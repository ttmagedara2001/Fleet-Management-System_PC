# 🤖 Fabrix - Fleet Management System

<div align="center">

![Fabrix Logo](https://img.shields.io/badge/Fabrix-Fleet%20Management-7C3AED?style=for-the-badge&logo=robot&logoColor=white)
![React](https://img.shields.io/badge/React-19.2.0-61DAFB?style=flat-square&logo=react)
![Vite](https://img.shields.io/badge/Vite-7.2.4-646CFF?style=flat-square&logo=vite)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.1.18-38B2AC?style=flat-square&logo=tailwind-css)

**A modern, real-time robot fleet management dashboard for monitoring and controlling autonomous robots in industrial environments.**

[Getting Started](#-getting-started) • [Features](#-features) • [Documentation](#-documentation) • [API Reference](API_REFERENCE.md)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [System Architecture](#-system-architecture)
- [Getting Started](#-getting-started)
- [Configuration](#-configuration)
- [Project Structure](#-project-structure)
- [Documentation](#-documentation)
- [Technology Stack](#-technology-stack)
- [Contributing](#-contributing)

---

## 🎯 Overview

**Fabrix** is a comprehensive fleet management system designed to monitor and control autonomous robots operating in industrial environments such as cleanrooms, loading bays, and storage facilities. The system provides:

- **Real-time robot tracking** with live location updates on an interactive facility map
- **Environmental monitoring** with temperature, humidity, and pressure sensors
- **Device control** for AC units and air purifiers
- **Historical data analysis** with customizable charts and data export
- **Alert management** for critical conditions and robot status changes
- **Task management** for assigning and monitoring robot operations

The application connects to the **ProtoNest IoT Backend** using WebSocket/STOMP for real-time data streaming and REST APIs for historical data and device control.

---

## ✨ Features

### 🗺️ Interactive Facility Map

- Real-time robot positions displayed on a facility layout
- Zone visualization (Cleanrooms, Loading Bay, Storage, Maintenance)
- Click-to-select robot details with status tooltips
- Active task progress indicators

### 🤖 Robot Fleet Management

- Monitor multiple robots simultaneously
- Track battery levels, temperature, and operational status
- View current tasks and progress
- Status indicators: Active, Charging, Idle, Error

### 📊 Environmental Monitoring

- Ambient temperature monitoring (°C)
- Humidity level tracking (%)
- Atmospheric pressure readings (hPa)
- Real-time sensor data updates

### 🔔 Smart Alerts

- Low battery warnings
- Temperature threshold alerts
- Robot error notifications
- Connection status monitoring

### 📈 Data Analysis

- Historical data visualization with interactive charts
- Multiple time range options (1h, 6h, 24h, 7d, 30d)
- Metric filtering (Temperature, Humidity, Battery)
- CSV data export functionality

### ⚙️ Device Control

- AC unit power control
- Air purifier settings management
- Threshold configuration for alerts
- Robot task assignment

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Fabrix Dashboard (React)                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Dashboard  │  │  Analysis   │  │  Settings   │             │
│  │    Page     │  │    Page     │  │    Page     │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   AuthContext   │  │  DeviceContext  │  │  StompContext   │ │
│  │ (JWT Auth)      │  │ (Device State)  │  │ (WebSocket)     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                    Services Layer                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  authService    │  │      api        │  │ webSocketClient │ │
│  │  (Login/Token)  │  │  (REST APIs)    │  │    (STOMP)      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 ProtoNest IoT Backend                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  REST API       │  │  STOMP/WS       │  │  MQTT Broker    │ │
│  │  (Historical)   │  │  (Real-time)    │  │  (IoT Devices)  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18.0 or higher
- **npm** or **yarn** package manager
- **ProtoNest Account** with API credentials

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/ttmagedara2001/Fleet-Management-System_PC.git
   cd Fleet-Management-System_PC
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env` file in the root directory:

   ```env
   # ProtoNest API Configuration
   VITE_API_BASE_URL=https://api.protonest.co
   VITE_WS_URL=wss://ws.protonest.co/ws

   # User Credentials
   VITE_USER_EMAIL=your-email@example.com
   VITE_USER_PASSWORD=your-secret-key
   ```

   > ⚠️ **Important**: The `VITE_USER_PASSWORD` is your ProtoNest **Secret Key**, not your login password. Find it in your ProtoNest dashboard.

4. **Start the development server**

   ```bash
   npm run dev
   ```

5. **Open in browser**

   Navigate to `http://localhost:5173`

### Build for Production

```bash
npm run build
npm run preview
```

---

## ⚙️ Configuration

### Environment Variables

| Variable             | Description                  | Required |
| -------------------- | ---------------------------- | -------- |
| `VITE_API_BASE_URL`  | ProtoNest REST API base URL  | ✅       |
| `VITE_WS_URL`        | ProtoNest WebSocket URL      | ✅       |
| `VITE_USER_EMAIL`    | Your ProtoNest account email | ✅       |
| `VITE_USER_PASSWORD` | Your ProtoNest secret key    | ✅       |

### Available Devices

The system is pre-configured with the following devices:

| Device ID       | Name           | Default Zone |
| --------------- | -------------- | ------------ |
| `device9988`    | Device 9988    | Cleanroom A  |
| `device0011233` | Device 0011233 | Cleanroom B  |
| `deviceA72Q`    | Device A72Q    | Loading Bay  |
| `deviceZX91`    | Device ZX91    | Storage      |

---

## 📁 Project Structure

```
Fleet-Management-System_PC/
├── public/                 # Static assets
├── src/
│   ├── assets/            # Images and icons
│   ├── components/        # React components
│   │   ├── dashboard/     # Dashboard-specific components
│   │   │   ├── AlertsPanel.jsx
│   │   │   ├── DeviceEnvironmentPanel.jsx
│   │   │   ├── FabMap.jsx
│   │   │   └── RobotFleetPanel.jsx
│   │   └── layout/        # Layout components
│   │       ├── Header.jsx
│   │       └── Sidebar.jsx
│   ├── contexts/          # React contexts
│   │   ├── AuthContext.jsx
│   │   ├── DeviceContext.jsx
│   │   └── StompContext.jsx
│   ├── hooks/             # Custom hooks
│   │   └── useApi.js
│   ├── pages/             # Page components
│   │   ├── Dashboard.jsx
│   │   ├── Analysis.jsx
│   │   └── Settings.jsx
│   ├── services/          # API and WebSocket services
│   │   ├── api.js
│   │   ├── authService.js
│   │   └── webSocketClient.js
│   ├── types/             # Type definitions
│   │   └── index.js
│   ├── App.jsx            # Main application component
│   ├── App.css            # Global styles
│   ├── main.jsx           # Application entry point
│   └── index.css          # Tailwind CSS imports
├── .env                   # Environment variables (create this)
├── API_REFERENCE.md       # API documentation
├── USER_MANUAL.md         # User manual
├── TROUBLESHOOTING.md     # Troubleshooting guide
├── package.json           # Dependencies and scripts
├── vite.config.js         # Vite configuration
├── tailwind.config.js     # Tailwind CSS configuration
└── README.md              # This file
```

---

## 📚 Documentation

| Document                                 | Description                          |
| ---------------------------------------- | ------------------------------------ |
| [README.md](README.md)                   | Project overview and setup guide     |
| [USER_MANUAL.md](USER_MANUAL.md)         | Complete user guide with screenshots |
| [API_REFERENCE.md](API_REFERENCE.md)     | REST API and WebSocket documentation |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common issues and solutions          |

---

## 🛠️ Technology Stack

### Frontend

- **React 19.2** - UI library with hooks
- **Vite 7.2** - Build tool and dev server
- **TailwindCSS 4.1** - Utility-first CSS framework
- **Recharts 3.6** - Charting library
- **Lucide React** - Icon library

### Communication

- **@stomp/stompjs 7.2** - STOMP over WebSocket
- **Axios 1.13** - HTTP client

### Development

- **ESLint** - Code linting
- **PostCSS** - CSS processing

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is proprietary software. All rights reserved.

---

<div align="center">

**Built with ❤️ for Industrial Automation**

</div>
