# Firmware Development Guide

This document describes recommended practices, messaging contracts, and development workflows for robot firmware that integrates with the Fabrix Fleet Management System.

## Goals

- Provide a clear messaging contract with the backend (MQTT topic names and payload shapes)
- Recommend a reproducible toolchain and development workflow
- Describe testing, OTA, and debugging guidance

## Toolchain Recommendations

- Use a supported embedded framework:
  - PlatformIO (recommended) — supports ESP32, STM32, NRF, and others
  - Zephyr RTOS — for more complex multi-threaded systems
  - Arduino core — for quick prototypes
- C/C++ toolchain with cross-compilation configured in `platformio.ini` or build scripts
- Use `git` for firmware source and tag releases with semantic versioning (vMAJOR.MINOR.PATCH)

## Hardware Requirements

- MCU with required peripherals (Wi-Fi/Cellular/BLE as needed)
- NTP-capable RTC or maintain time synchronization with the backend
- Sensors: IMU/GPS (if GPS required), battery fuel gauge, temperature sensors
- Secure storage for credentials (secure element or flash encrypted region)

## Communication Protocols

- Primary protocol: MQTT over TLS for robust connectivity
- Topics (use these suffixes exactly):
  - `fleetMS/robots/{robotId}/location` — GPS location updates (JSON)
  - `fleetMS/robots/{robotId}/battery` — battery percentage (JSON or numeric). The backend and dashboard compute robot health from `battery_pct` by default; firmware SHOULD publish `battery_pct` when possible.
  - `fleetMS/robots/{robotId}/status` — optional extended health and state (JSON). When supplied include `firmware_version`, `uptime`, `free_heap`, `last_error`, `state`, and `emergency` flags.
  - `fleetMS/robots/{robotId}/tasks` — assigned task, ack, progress
  - `fleetMS/emergencyStop` — emergency stop/clear command (device-level)

### Emergency topic

- Topic: `fleetMS/emergencyStop`
- Payload to stop all robots on a device:

```json
{ "emergency_stop": true }
```

- Payload to clear emergency state:

```json
{ "emergency_stop": false }
```

Firmware should:

- Immediately stop motion when `emergency_stop: true` received
- Prefer publishing `battery_pct` (topic `fleetMS/robots/{robotId}/battery`) so the backend/dashboard can compute health using the project's defined math. Optionally publish extended `status` messages for debugging and operator information.
- Continue publishing telemetry where safe (battery, health) so operator can triage

## Location Payload (GPS)

Example `fleetMS/robots/{robotId}/location` payload:

```json
{
  "robotId": "R-001",
  "lat": 37.422033,
  "lng": -122.084095,
  "heading": 90,
  "speed_m_s": 0.6,
  "accuracy_m": 3.2
}
```

Notes:

- Use WGS84 decimal degrees
- `timestamp` is optional: the backend will automatically add/normalize a `timestamp` when messages are received. Firmware MAY omit the `timestamp` field.
- Include `accuracy_m` when available

## Task Assignment Contract

Tasks are delivered on `fleetMS/robots/{robotId}/tasks` as a JSON object. Include a unique `taskId`, `type`, `destination` (lat/lng), and `priority`.

Example:

```json
{
  "taskId": "task-001",
  "type": "pickup",
  "destination": { "lat": 37.4221, "lng": -122.0839 },
  "priority": "high"
}
```

Firmware should acknowledge tasks by publishing `ack` to a `fleetMS/robots/{robotId}/tasks/ack` topic and update progress to `fleetMS/robots/{robotId}/tasks/progress`.

## OTA and Versioning

- Implement OTA mechanisms (PlatformIO, MCU vendor SDKs, or custom) with signatures when possible
- Publish firmware version on `fleetMS/robots/{robotId}/status` as `firmware_version`
- CI pipeline should build artifacts and provide signed binaries for OTA

## Safety and Recovery

- Implement watchdog timers and safe-state fallback when connectivity is lost
- On `emergency_stop`, hardware brakes or immediate motor disable should be applied
- On `emergency_clear`, require operator confirmation or double-check conditions before resuming autonomous motion

## Debugging and Logging

- Publish periodic health telemetry on `fleetMS/robots/{robotId}/status` including `uptime`, `free_heap`, `firmware_version`, and `last_error`
- Support different log levels configured via `fleetMS/robots/{robotId}/config/log_level`

## Testing

- Unit test critical motion / safety code where possible
- Hardware-in-the-loop (HIL) tests for motion controllers
- Integration tests with a broker simulator for MQTT topics

## Example Files & Testing Aids

- Use `src/examples/gps_payload_examples.json` in the dashboard repo as sample MQTT payloads for development and testing
- Use `src/examples/mqtt_firmware_payloads.md` for firmware- and MQTT-client-ready sample payloads (location, battery, status, tasks, progress, emergency stop).
- See `GPS_COORDINATES_AND_MATH.md` for coordinate samples and the health/task math formulas implemented in `src/utils/telemetryMath.js`.
