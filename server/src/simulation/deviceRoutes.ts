import { Router } from 'express';
import type { Request, Response } from 'express';
import { Device } from './device.model.js';
import { advanceCompartmentState } from './deviceSimulator.js';
import type { TriggerEvent } from './deviceSimulator.js';
import {
  evaluateBatteryAlert,
  evaluateDeviceOfflineAlert
} from './alertService.js';

const router = Router();

/**
 * GET /api/v1/device/:id/status
 * Returns the full state snapshot of the device.
 */
router.get('/:id/status', async (req: Request, res: Response): Promise<void> => {
  const deviceId = req.params.id as string;
  try {
    const device = await Device.findOne({ deviceId } as any);
    if (!device) {
      res.status(404).json({ error: `Device '${deviceId}' not found.` });
      return;
    }

    res.status(200).json({
      deviceId: device.deviceId,
      online: device.online,
      batteryPercent: device.batteryPercent,
      wifiSignalPercent: device.wifiSignalPercent,
      rtcTime: new Date().toISOString(), // Simulates device RTC synchronization
      lastSeenAt: device.lastSeenAt,
      firmwareVersion: device.firmwareVersion,
      compartments: device.compartments
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/device/:id/heartbeat
 * Device check-in updating lastSeenAt, and optionally battery/wifi signal.
 */
router.post('/:id/heartbeat', async (req: Request, res: Response): Promise<void> => {
  const deviceId = req.params.id as string;
  const { batteryPercent, wifiSignalPercent } = req.body;

  try {
    const device = await Device.findOne({ deviceId } as any);
    if (!device) {
      res.status(404).json({ error: `Device '${deviceId}' not found.` });
      return;
    }

    const wasOffline = !device.online;
    const previousBattery = device.batteryPercent;

    // Update check-in telemetry
    device.online = true;
    device.lastSeenAt = new Date();
    if (typeof batteryPercent === 'number') device.batteryPercent = batteryPercent;
    if (typeof wifiSignalPercent === 'number') device.wifiSignalPercent = wifiSignalPercent;

    await device.save();

    // Check battery level alerts
    if (typeof batteryPercent === 'number') {
      if (previousBattery >= 15 && batteryPercent < 15) {
        evaluateBatteryAlert(deviceId, batteryPercent);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Heartbeat acknowledged.',
      online: device.online,
      lastSeenAt: device.lastSeenAt
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/device/:id/sensor-event
 * Receives raw sensor events from the device (e.g. IR beam broke, load cell weight changed).
 */
router.post('/:id/sensor-event', async (req: Request, res: Response): Promise<void> => {
  const deviceId = req.params.id as string;
  const { compartmentId, sensorType, value } = req.body;

  if (compartmentId === undefined || !sensorType || value === undefined) {
    res.status(400).json({ error: 'Missing required fields: compartmentId, sensorType, value.' });
    return;
  }

  try {
    // Map raw sensor types to state machine triggers
    let triggerEvent: TriggerEvent;
    if (sensorType === 'ir') {
      triggerEvent = 'IR_EVENT';
    } else if (sensorType === 'loadcell') {
      triggerEvent = 'LOAD_CELL_DROP';
    } else {
      res.status(400).json({ error: `Unsupported sensorType '${sensorType}'. Supported types are 'ir' and 'loadcell'.` });
      return;
    }

    const compartmentNumber = Number(compartmentId);
    const nextState = await advanceCompartmentState(deviceId, compartmentNumber, triggerEvent, value);

    res.status(200).json({
      success: true,
      sensorEvent: { deviceId, compartmentId: compartmentNumber, sensorType, value },
      newState: nextState
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/v1/device/:id/compartment/:compartmentId/unlock
 * Moves the compartment to unlocked / available (or awaiting-meal if required).
 * Typically called by the server's reminder workflow.
 */
router.post('/:id/compartment/:compartmentId/unlock', async (req: Request, res: Response): Promise<void> => {
  const deviceId = req.params.id as string;
  const compartmentNumber = Number(req.params.compartmentId);
  const { requiresMeal } = req.body;

  try {
    const triggerEvent = requiresMeal ? 'REMINDER_FIRED_WITH_MEAL' : 'REMINDER_FIRED_NO_MEAL';
    const nextState = await advanceCompartmentState(deviceId, compartmentNumber, triggerEvent);

    res.status(200).json({
      success: true,
      message: `Compartment ${compartmentNumber} unlocked.`,
      state: nextState
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/v1/device/simulate
 * Dev-only simulation endpoint to manual override device state and trigger alerts.
 * NOTE: This is a developer-only debugging route and would NOT be present on production firmware.
 */
router.post('/simulate', async (req: Request, res: Response): Promise<void> => {
  const { deviceId, event, compartmentNumber, payload } = req.body;

  if (!deviceId || !event) {
    res.status(400).json({ error: 'Missing required fields: deviceId, event.' });
    return;
  }

  try {
    const device = await Device.findOne({ deviceId });
    if (!device) {
      res.status(404).json({ error: `Device '${deviceId}' not found.` });
      return;
    }

    // Handle dev-only simulation triggers
    if (event === 'LOW_BATTERY_DEMO') {
      const originalBattery = device.batteryPercent;
      device.batteryPercent = 10; // Trigger battery alert threshold
      await device.save();
      evaluateBatteryAlert(deviceId, 10);
      res.status(200).json({
        success: true,
        message: `Simulated low battery alert from ${originalBattery}% down to 10%.`
      });
      return;
    }

    if (event === 'OFFLINE_TOGGLE') {
      const wasOnline = device.online;
      device.online = !wasOnline;
      await device.save();
      if (wasOnline) {
        evaluateDeviceOfflineAlert(deviceId);
      }
      res.status(200).json({
        success: true,
        message: `Simulated online status toggled from ${wasOnline} to ${!wasOnline}.`
      });
      return;
    }

    // Forward standard state machine trigger events
    if (compartmentNumber === undefined) {
      res.status(400).json({ error: `Event '${event}' requires a compartmentNumber.` });
      return;
    }

    const compNum = Number(compartmentNumber);
    const nextState = await advanceCompartmentState(deviceId, compNum, event as TriggerEvent, payload);

    res.status(200).json({
      success: true,
      message: `Simulation event '${event}' triggered on compartment ${compNum}.`,
      newState: nextState
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/v1/device/patient/confirm-meal
 * Simulates a patient confirming their meal.
 * Transitions compartment from unlocked-awaiting-meal to available.
 */
router.post('/patient/confirm-meal', async (req: Request, res: Response): Promise<void> => {
  const { deviceId, compartmentNumber } = req.body;
  if (!deviceId || compartmentNumber === undefined) {
    res.status(400).json({ error: 'Missing required fields: deviceId, compartmentNumber.' });
    return;
  }

  try {
    const compNum = Number(compartmentNumber);
    const nextState = await advanceCompartmentState(deviceId as string, compNum, 'MEAL_CONFIRMED');

    res.status(200).json({
      success: true,
      message: `Meal confirmed for compartment ${compNum}.`,
      state: nextState
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/v1/device/patient/take-medicine
 * Simulates patient tapping "Taken" in the UI.
 * Programmatically hits our own physical sensor-event REST endpoints to transition state.
 */
router.post('/patient/take-medicine', async (req: Request, res: Response): Promise<void> => {
  const { deviceId, compartmentNumber } = req.body;
  if (!deviceId || compartmentNumber === undefined) {
    res.status(400).json({ error: 'Missing required fields: deviceId, compartmentNumber.' });
    return;
  }

  try {
    const compNum = Number(compartmentNumber);
    const port = req.socket.localPort || 5001;
    const baseUrl = `http://127.0.0.1:${port}/api/v1/device/${deviceId}`;

    console.log(`[PatientUI] Simulating physical intake actions via HTTP REST for compartment ${compNum}...`);

    // 1. Programmatically post IR event (representing prying/grabbing cup)
    const irRes = await fetch(`${baseUrl}/sensor-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compartmentId: compNum, sensorType: 'ir', value: true })
    });
    if (!irRes.ok) {
      throw new Error(`IR event simulation failed: ${await irRes.text()}`);
    }

    // 2. Programmatically post Load-Cell drop event (representing cup weight drop to 0g)
    const lcRes = await fetch(`${baseUrl}/sensor-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compartmentId: compNum, sensorType: 'loadcell', value: 0.0 })
    });
    if (!lcRes.ok) {
      throw new Error(`Load-cell drop event simulation failed: ${await lcRes.text()}`);
    }

    // Retrieve updated device state to return
    const device = await Device.findOne({ deviceId } as any);
    const compartment = device?.compartments.find(c => c.compartmentNumber === compNum);

    res.status(200).json({
      success: true,
      message: `Intake sensor simulation completed. Compartment ${compNum} state is now '${compartment?.state}'.`,
      state: compartment?.state
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/v1/device/dashboard/medicine-status/:deviceId
 * Caretaker/Patient Dashboard query endpoint that maps internal device compartment states
 * to human-readable medication statuses.
 */
router.get('/dashboard/medicine-status/:deviceId', async (req: Request, res: Response): Promise<void> => {
  const deviceId = req.params.deviceId as string;

  try {
    const device = await Device.findOne({ deviceId } as any);
    if (!device) {
      res.status(404).json({ error: `Device '${deviceId}' not found.` });
      return;
    }

    // Map Mongoose compartment states to friendly dashboard statuses
    const mappedCompartments = device.compartments.map(comp => {
      let dashboardStatus = 'Unknown';
      switch (comp.state) {
        case 'locked':
          dashboardStatus = 'Scheduled';
          break;
        case 'unlocked-awaiting-meal':
          dashboardStatus = 'Awaiting Meal Confirmation';
          break;
        case 'available':
          dashboardStatus = 'Ready to Take';
          break;
        case 'dispensed':
          dashboardStatus = 'Taken';
          break;
        case 'empty':
          dashboardStatus = 'Taken (Out of Stock)';
          break;
      }

      return {
        compartmentNumber: comp.compartmentNumber,
        linkedMedicineId: comp.linkedMedicineId,
        state: comp.state,
        dashboardStatus
      };
    });

    res.status(200).json({
      deviceId: device.deviceId,
      online: device.online,
      batteryPercent: device.batteryPercent,
      compartments: mappedCompartments
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
