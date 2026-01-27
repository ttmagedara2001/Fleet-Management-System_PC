# MQTT Firmware Sample Payloads

Use these payloads when testing from firmware or MQTT clients (MQTTX, mosquitto_pub, etc.). Replace `{robotId}` with your robot identifier.

1. Location update — topic: `fleetMS/robots/{robotId}/location`

```json
{
  "robotId": "R-001",
  "lat": 37.422033,
  "lng": -122.084095,
  "heading": 90,
  "speed_m_s": 0.6,
  "accuracy_m": 3.2,
  "battery_pct": 84,
  "timestamp": "2026-01-27T12:34:56Z"
}
```

2. Battery-only update — topic: `fleetMS/robots/{robotId}/battery` (can be numeric or JSON)

Numeric example (payload = `84`)

JSON example:

```json
{
  "robotId": "R-001",
  "battery_pct": 84,
  "timestamp": "2026-01-27T12:34:56Z"
}
```

3. Status / health telemetry — topic: `fleetMS/robots/{robotId}/status`

Firmware SHOULD include battery and minimal health telemetry; the dashboard computes health from `battery_pct`.

```json
{
  "robotId": "R-001",
  "uptime": 3600,
  "free_heap": 24576,
  "firmware_version": "v1.2.3",
  "battery_pct": 84,
  "last_error": null,
  "state": "ACTIVE",
  "emergency": false
}
```

4. Task assignment — topic: `fleetMS/robots/{robotId}/tasks`

```json
{
  "taskId": "task-001",
  "type": "pickup",
  "source": { "lat": 37.422, "lng": -122.084 },
  "destination": { "lat": 37.4225, "lng": -122.0838 },
  "priority": "high",
  "initialDistance": 45.2
}
```

5. Task ack — topic: `fleetMS/robots/{robotId}/tasks/ack`

```json
{
  "taskId": "task-001",
  "robotId": "R-001",
  "status": "ACK",
  "acceptedAt": "2026-01-27T12:35:10Z"
}
```

6. Task progress updates — topic: `fleetMS/robots/{robotId}/tasks/progress`

Provide either `progress` (0-100) OR distance/steps fields. Examples:

Progress direct:

```json
{ "taskId": "task-001", "progress": 45 }
```

Distance-based:

```json
{
  "taskId": "task-001",
  "initialDistance": 45.2,
  "remainingDistance": 24.9
}
```

Steps-based:

```json
{
  "taskId": "task-001",
  "stepsCompleted": 3,
  "totalSteps": 5
}
```

7. Emergency stop — topic: `fleetMS/emergencyStop` (broadcast)

Stop payload:

```json
{ "emergency_stop": true }
```

Clear payload:

```json
{ "emergency_stop": false }
```

8. Remote config (example) — topic: `fleetMS/robots/{robotId}/config/log_level`

```json
{ "log_level": "debug" }
```

Quick `mosquitto_pub` example (publish location):

```bash
mosquitto_pub -h <broker> -t "fleetMS/robots/R-001/location" -m '{"robotId":"R-001","lat":37.422033,"lng":-122.084095,"battery_pct":84}'
```

Drop these files into MQTTX or use `mosquitto_pub` for quick tests. The dashboard expects `battery_pct` for health math and will compute `task` completion based on the fields described in `src/utils/telemetryMath.js`.
