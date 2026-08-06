import mongoose from 'mongoose';
import { Device } from './device.model.js';
import type { IDevice, ICompartment } from './device.model.js';
import { SensorEvent } from './sensorEvent.model.js';
import {
  evaluateBatteryAlert,
  evaluateDeviceOfflineAlert,
  evaluateUnscheduledOpenAlert,
  evaluateCompartmentEmptyAlert
} from './alertService.js';

export type TriggerEvent =
  | 'REMINDER_FIRED_NO_MEAL'
  | 'REMINDER_FIRED_WITH_MEAL'
  | 'MEAL_CONFIRMED'
  | 'IR_EVENT'
  | 'LOAD_CELL_DROP'
  | 'TIMEOUT'
  | 'RESTOCK';

// Map to track active interval handles for each simulated device
const activeSimulators = new Map<string, NodeJS.Timeout>();

/**
 * Service to execute a single simulation tick for a device.
 * Updates battery percentage, Wi-Fi signal, online status flakiness, and lastSeenAt.
 */
export async function simulateDeviceTick(deviceId: string): Promise<void> {
  try {
    const device = await Device.findOne({ deviceId });
    if (!device) {
      console.warn(`[DeviceSimulator][${deviceId}] Device not found in database.`);
      return;
    }

    // 1. Online status flakiness (1% chance to flip online/offline on each tick)
    const previousOnline = device.online;
    let online = device.online;
    if (Math.random() < 0.02) {
      online = !online;
      console.log(`[DeviceSimulator][${deviceId}] Connection flakiness trigger. Device went ${online ? 'ONLINE' : 'OFFLINE'}.`);
      if (previousOnline && !online) {
        evaluateDeviceOfflineAlert(deviceId);
      }
    }

    // 2. Telemetry changes
    let batteryPercent = device.batteryPercent;
    let wifiSignalPercent = device.wifiSignalPercent;
    let lastSeenAt = device.lastSeenAt;

    if (online) {
      // Drains battery slowly (gradual drift between 0.01% and 0.15% per tick)
      const batteryDrain = 0.01 + Math.random() * 0.14;
      batteryPercent = Math.max(0, parseFloat((batteryPercent - batteryDrain).toFixed(2)));

      // Jitters Wi-Fi signal slightly (drift between -3% and +3%, clamped to 20-100)
      const wifiJitter = Math.floor((Math.random() - 0.5) * 6);
      wifiSignalPercent = Math.min(100, Math.max(20, wifiSignalPercent + wifiJitter));

      // Update last seen
      lastSeenAt = new Date();
    }

    // Save updated device telemetry
    const previousBattery = device.batteryPercent;
    device.online = online;
    device.batteryPercent = batteryPercent;
    device.wifiSignalPercent = wifiSignalPercent;
    device.lastSeenAt = lastSeenAt;
    await device.save();

    // Trigger low battery alert if transitioning below 15%
    if (previousBattery >= 15 && batteryPercent < 15) {
      evaluateBatteryAlert(deviceId, batteryPercent);
    }

    console.log(
      `[DeviceSimulator][${deviceId}] Telemetry Update: ` +
      `Online: ${online} | Battery: ${batteryPercent}% | Wi-Fi: ${wifiSignalPercent}% | ` +
      `LastSeen: ${lastSeenAt.toISOString()}`
    );
  } catch (error) {
    console.error(`[DeviceSimulator][${deviceId}] Error during simulation tick:`, error);
  }
}

/**
 * Starts the periodic simulator engine for a given device.
 * Defaults to a 15-second tick interval.
 */
export function startDeviceSimulator(deviceId: string, intervalMs: number = 15000): void {
  if (activeSimulators.has(deviceId)) {
    console.log(`[DeviceSimulator][${deviceId}] Simulator already running.`);
    return;
  }

  console.log(`[DeviceSimulator][${deviceId}] Starting simulator with interval ${intervalMs}ms...`);
  
  // Run an initial tick immediately
  simulateDeviceTick(deviceId);

  const timer = setInterval(() => {
    simulateDeviceTick(deviceId);
  }, intervalMs);

  activeSimulators.set(deviceId, timer);
}

/**
 * Stops the periodic simulator engine for a given device.
 */
export function stopDeviceSimulator(deviceId: string): void {
  const timer = activeSimulators.get(deviceId);
  if (timer) {
    clearInterval(timer);
    activeSimulators.delete(deviceId);
    console.log(`[DeviceSimulator][${deviceId}] Stopped simulator.`);
  } else {
    console.log(`[DeviceSimulator][${deviceId}] No simulator found to stop.`);
  }
}

/**
 * Stops all running device simulators.
 */
export function stopAllSimulators(): void {
  for (const deviceId of activeSimulators.keys()) {
    stopDeviceSimulator(deviceId);
  }
}

/**
 * Advances the compartment state based on a physical or system triggering event.
 * Follows the transition table strictly, logging a SensorEvent for each successful transition.
 */
export async function advanceCompartmentState(
  deviceId: string,
  compartmentNumber: number,
  event: TriggerEvent,
  payload?: any
): Promise<string> {
  const device = await Device.findOne({ deviceId });
  if (!device) {
    throw new Error(`Device '${deviceId}' not found.`);
  }

  const compartment = device.compartments.find(c => c.compartmentNumber === compartmentNumber);
  if (!compartment) {
    throw new Error(`Compartment ${compartmentNumber} not found on device '${deviceId}'.`);
  }

  const currentState = compartment.state;
  let nextState: typeof compartment.state | null = null;
  let sensorType: 'ir' | 'loadcell' | null = null;
  let sensorValue: any = null;

  switch (currentState) {
    case 'locked':
      if (event === 'REMINDER_FIRED_NO_MEAL') {
        nextState = 'available';
        sensorType = 'loadcell';
        sensorValue = compartment.lastLoadCellReading; // log current weight
      } else if (event === 'REMINDER_FIRED_WITH_MEAL') {
        nextState = 'unlocked-awaiting-meal';
        sensorType = 'loadcell';
        sensorValue = compartment.lastLoadCellReading;
      }
      break;

    case 'unlocked-awaiting-meal':
      if (event === 'MEAL_CONFIRMED') {
        nextState = 'available';
        sensorType = 'loadcell';
        sensorValue = compartment.lastLoadCellReading;
      } else if (event === 'IR_EVENT') {
        nextState = 'dispensed';
        sensorType = 'ir';
        sensorValue = payload !== undefined ? payload : true;
        compartment.lastIrEventAt = new Date();
      } else if (event === 'LOAD_CELL_DROP') {
        nextState = 'dispensed';
        sensorType = 'loadcell';
        sensorValue = payload !== undefined ? payload : 0.0;
        compartment.lastLoadCellReading = sensorValue;
      } else if (event === 'TIMEOUT') {
        nextState = 'locked';
        sensorType = 'loadcell';
        sensorValue = compartment.lastLoadCellReading;
      }
      break;

    case 'available':
      if (event === 'IR_EVENT') {
        nextState = 'dispensed';
        sensorType = 'ir';
        sensorValue = payload !== undefined ? payload : true;
        compartment.lastIrEventAt = new Date();
      } else if (event === 'LOAD_CELL_DROP') {
        nextState = 'dispensed';
        sensorType = 'loadcell';
        sensorValue = payload !== undefined ? payload : 0.0;
        compartment.lastLoadCellReading = sensorValue;
      } else if (event === 'TIMEOUT') {
        nextState = 'locked';
        sensorType = 'loadcell';
        sensorValue = compartment.lastLoadCellReading;
      }
      break;

    case 'dispensed':
      if (event === 'LOAD_CELL_DROP' && (payload === 0 || payload < 0.1)) {
        nextState = 'empty';
        sensorType = 'loadcell';
        sensorValue = payload !== undefined ? payload : 0.0;
        compartment.lastLoadCellReading = sensorValue;
      } else if (event === 'RESTOCK') {
        nextState = 'locked';
        sensorType = 'loadcell';
        sensorValue = payload !== undefined ? payload : 15.0; // standard restock weight
        compartment.lastLoadCellReading = sensorValue;
      }
      break;

    case 'empty':
      if (event === 'RESTOCK') {
        nextState = 'locked';
        sensorType = 'loadcell';
        sensorValue = payload !== undefined ? payload : 15.0;
        compartment.lastLoadCellReading = sensorValue;
      }
      break;
  }

  // 1. Check for unscheduled compartment opening / tampering (IR or weight drop when locked or empty)
  if (event === 'IR_EVENT' || event === 'LOAD_CELL_DROP') {
    evaluateUnscheduledOpenAlert(deviceId, compartmentNumber, currentState, event);
  }

  // Reject invalid transition
  if (!nextState) {
    throw new Error(
      `Invalid compartment transition: current state is '${currentState}' but received trigger event '${event}'.`
    );
  }

  // 2. Check if transitioning to empty state
  if (nextState === 'empty') {
    evaluateCompartmentEmptyAlert(deviceId, compartmentNumber);
  }

  // Log to SensorEvent collection to trace state change
  if (sensorType) {
    const logEntry = new SensorEvent({
      deviceId,
      compartmentId: compartmentNumber,
      sensorType,
      value: sensorValue,
      timestamp: new Date()
    });
    await logEntry.save();
  }

  // Persist state change to the device
  compartment.state = nextState;
  await device.save();

  console.log(
    `[DeviceSimulator][${deviceId}][Compartment ${compartmentNumber}] ` +
    `State transitioned: '${currentState}' --(${event})--> '${nextState}' (SensorEvent logged: ${sensorType}=${sensorValue})`
  );

  return nextState;
}
