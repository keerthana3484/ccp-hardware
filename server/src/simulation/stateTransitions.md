# Compartment State Machine & Transition Rules

This document serves as the absolute source of truth for the compartment state machine of the simulated IoT device. Every state transition MUST be triggered by an explicit event and accompanied by a corresponding sensor event or system log (written to the `SensorEvent` collection).

---

## State Definitions

Each compartment on a device can be in one of the following states:

1. **`locked`**: The compartment is closed and locked. It contains medicine, but it is not time for the patient to take it yet.
2. **`unlocked-awaiting-meal`**: The dose time has arrived, but this medicine requires a meal confirmation before the patient can consume it. The compartment is unlocked (or ready to unlock), but the user interface or device display instructs the patient to eat.
3. **`available`**: The compartment is unlocked, and the medicine is ready to be taken immediately.
4. **`dispensed`**: The medicine has been successfully retrieved from the compartment (detected via sensors).
5. **`empty`**: The compartment contains no medicine. This state is reached after the medicine is dispensed and the sensors confirm no remaining weight, or if it has not been refilled.

---

## Transition Matrix

| Current State | Trigger Event | Target State | Action / Sensor Log Requirement |
| :--- | :--- | :--- | :--- |
| **`locked`** | `reminder fired` *(No meal required)* | **`available`** | System triggers notification and unlocks the compartment. |
| **`locked`** | `reminder fired` *(Meal required)* | **`unlocked-awaiting-meal`** | System prompts patient to confirm meal. Compartment is prepared for unlock. |
| **`unlocked-awaiting-meal`** | `meal confirmed` | **`available`** | Patient confirms meal (via app/button). Dispenser signals "ready to take". |
| **`unlocked-awaiting-meal`** | `IR event` / `load-cell drop` | **`dispensed`** | *Safety Override:* Patient takes the medicine before confirming meal. Logged in `SensorEvent`. |
| **`available`** | `IR event` / `load-cell drop` | **`dispensed`** | Patient retrieves medicine. Break of IR beam or drop in weight. Logged in `SensorEvent`. |
| **`unlocked-awaiting-meal`** / **`available`** | `timeout` *(Dose window expires)* | **`locked`** *(or `dispensed` if empty)* | The patient missed the dose window. Compartment locks back for safety. |
| **`dispensed`** | `load-cell drop` (value ≈ 0g) | **`empty`** | Sensor detects weight has dropped below threshold. Logged in `SensorEvent`. |
| **`dispensed`** / **`empty`** | `restock` | **`locked`** | Caregiver refills the compartment, resets weight, closes/locks it. |

---

## Trigger Descriptions & Audit Trail Logs

Every state change must be traceable. Below is how events are mapped to the `SensorEvent` collection to prevent silent field updates.

### 1. IR Event (`sensorType: 'ir'`)
*   **Trigger**: The infrared sensor detects that the compartment slot has been accessed (e.g. beam broken / value = `true` or `1`).
*   **Transitions Triggered**:
    *   `available` → `dispensed`
    *   `unlocked-awaiting-meal` → `dispensed`
*   **SensorEvent Log**:
    ```json
    {
      "deviceId": "DEV-12345",
      "compartmentId": 1,
      "sensorType": "ir",
      "value": 1,
      "timestamp": "2026-07-23T22:17:00.000Z"
    }
    ```

### 2. Load-Cell Drop (`sensorType: 'loadcell'`)
*   **Trigger**: The weight sensor reports a decrease in weight below a threshold (e.g., weight changes from standard cup/pill package weight to base weight).
*   **Transitions Triggered**:
    *   `available` → `dispensed` (weight drops by medicine package weight)
    *   `dispensed` → `empty` (weight drops to approx 0g)
*   **SensorEvent Log**:
    ```json
    {
      "deviceId": "DEV-12345",
      "compartmentId": 1,
      "sensorType": "loadcell",
      "value": 0.05, // Current reading in grams (near zero)
      "timestamp": "2026-07-23T22:17:01.000Z"
    }
    ```

### 3. Reminder Fired / Meal Confirmed / Restock / Timeout (System & App Events)
*   While these are system/software events rather than raw physical sensor events, they can be logged as system triggers or audit events as well to maintain a complete history.
