# IoT Device Simulator Specification & Transition Guide

This document specifies the Smart Medicine Dispenser simulated IoT device layer, details the state machine mechanics, and outlines how the API contract transitions to physical ESP32 hardware.

---

## 1. REST API Endpoints Specification

The endpoints are separated into two distinct categories: **Hardware-Shaped Endpoints** (which real ESP32 firmware will invoke) and **Developer-Only Endpoints** (used for workflow automation, client UI simulation, and caretakers).

### A. Hardware-Shaped Endpoints (ESP32 Firmware Contract)

These endpoints are designed to match the typical constraint-based REST communication used by physical microcontrollers. They do not require complex session state, only basic identifiers and raw telemetry payload blocks.

#### 1. Device Heartbeat
*   **Path**: `POST /api/v1/device/:id/heartbeat`
*   **Description**: Invoked by the device at a regular interval (e.g., every 30 seconds) to signal it is alive and report telemetry metrics.
*   **Request Body**:
    ```json
    {
      "batteryPercent": 92,
      "wifiSignalPercent": 85
    }
    ```
*   **Response**: `200 OK`
    ```json
    {
      "success": true,
      "message": "Heartbeat acknowledged.",
      "online": true,
      "lastSeenAt": "2026-07-23T22:45:00.000Z"
    }
    ```

#### 2. Physical Sensor Event Log
*   **Path**: `POST /api/v1/device/:id/sensor-event`
*   **Description**: Sent by the device immediately when a physical sensor change occurs (e.g., IR beam broken or load-cell weight drops).
*   **Request Body**:
    ```json
    {
      "compartmentId": 1,
      "sensorType": "ir",
      "value": true
    }
    ```
    *or*
    ```json
    {
      "compartmentId": 1,
      "sensorType": "loadcell",
      "value": 0.0
    }
    ```
*   **Response**: `200 OK`
    ```json
    {
      "success": true,
      "sensorEvent": {
        "deviceId": "DEV-SIM-001",
        "compartmentId": 1,
        "sensorType": "ir",
        "value": true
      },
      "newState": "dispensed"
    }
    ```

---

### B. Developer-Only & Application-Facing Endpoints

These endpoints are used by the caretaker dashboards, patient mobile application interfaces, and simulated scheduler engines.

#### 1. GET Device Status
*   **Path**: `GET /api/v1/device/:id/status`
*   **Description**: Returns the full state snapshot of the device. Real firmware does not call this, but the caretaker dashboard uses it.
*   **Response**: `200 OK`

#### 2. Compartment Unlock (Reminder Workflow Trigger)
*   **Path**: `POST /api/v1/device/:id/compartment/:compartmentId/unlock`
*   **Description**: Invoked by the server-side reminder scheduler workflow when a medicine reminder time is hit.
*   **Request Body**:
    ```json
    {
      "requiresMeal": true
    }
    ```

#### 3. Patient UI Confirm Meal
*   **Path**: `POST /api/v1/device/patient/confirm-meal`
*   **Description**: Called by the patient mobile app when they tap "I have eaten".
*   **Request Body**: `{ "deviceId": "DEV-SIM-001", "compartmentNumber": 1 }`

#### 4. Patient UI Mark Taken
*   **Path**: `POST /api/v1/device/patient/take-medicine`
*   **Description**: Simulates the physical action of prying open the lid. Programmatically POSTs raw `ir` and `loadcell` events to `/sensor-event` to prove the contract works symmetrically.
*   **Request Body**: `{ "deviceId": "DEV-SIM-001", "compartmentNumber": 1 }`

#### 5. Developer Manual Simulation Event Override
*   **Path**: `POST /api/v1/device/simulate`
*   **Description**: Developer dashboard trigger to force low battery states, toggle online flakiness, or inject mock events.
*   **Request Body**: `{ "deviceId", "event", "compartmentNumber"?, "payload"? }`

---

## 2. Compartment State Machine Transition Matrix

Every valid state transition is accompanied by a database write to the `SensorEvent` collection to ensure audit logging integrity.

| Current State | Trigger Event | Next State | Sensor Event Logged | Description |
| :--- | :--- | :--- | :--- | :--- |
| **locked** | `REMINDER_FIRED_NO_MEAL` | **available** | `loadcell` (weight) | Medicine reminder fires; no food required. |
| **locked** | `REMINDER_FIRED_WITH_MEAL` | **unlocked-awaiting-meal** | `loadcell` (weight) | Medicine reminder fires; waits for meal. |
| **unlocked-awaiting-meal** | `MEAL_CONFIRMED` | **available** | `loadcell` (weight) | Meal confirmed by patient; moves to ready. |
| **unlocked-awaiting-meal** | `IR_EVENT` | **dispensed** | `ir` (true) | Patient accessed slot before meal confirmation. |
| **unlocked-awaiting-meal** | `LOAD_CELL_DROP` | **dispensed** | `loadcell` (weight) | Weight drop detected before meal confirmation. |
| **unlocked-awaiting-meal** | `TIMEOUT` | **locked** | `loadcell` (weight) | Dose window closed without patient action. |
| **available** | `IR_EVENT` | **dispensed** | `ir` (true) | Patient breaks IR beam when retrieving cup. |
| **available** | `LOAD_CELL_DROP` | **dispensed** | `loadcell` (weight) | Weight drop recorded as cup is lifted. |
| **available** | `TIMEOUT` | **locked** | `loadcell` (weight) | Dose window closed; compartment locks back. |
| **dispensed** | `LOAD_CELL_DROP` (value = 0) | **empty** | `loadcell` (0.0) | Weight drops to 0g, triggering restocking alert. |
| **dispensed** | `RESTOCK` | **locked** | `loadcell` (restock wt)| Compartment weight increases on refill. |
| **empty** | `RESTOCK` | **locked** | `loadcell` (restock wt)| Compartment refilled; locked for next schedule. |

---

## 3. Transitioning to Real ESP32 Hardware

When real hardware is swapped in:

1.  **Disable the Simulator Daemon**:
    *   Set the background simulation tick interval to inactive, or remove the bootstrapping function loop in `server.ts` that triggers `startDeviceSimulator()`.
2.  **No API Changes**:
    *   The API contract is identical. The real ESP32 firmware will execute standard HTTP client posts:
        - Checks in periodically via `POST /api/v1/device/:id/heartbeat`.
        - Transmits immediate IR beam breaks and load-cell weight drops via `POST /api/v1/device/:id/sensor-event`.
3.  **Physical Locking Control**:
    *   For unlocking/locking directives, the ESP32 should poll a command queue endpoint, or maintain a WebSocket connection to listen for unlocks. Alternatively, the device status endpoint `GET /api/v1/device/:id/status` lists the correct target compartment state, allowing the device to actuate physical solenoid locks whenever the state changes from `locked` to `available` or `unlocked-awaiting-meal`.
