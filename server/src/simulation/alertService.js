/**
 * Service to dispatch alerts to the system's notification layer.
 * Logs to terminal in dev mode; can be wired to real SMS/Email/Push integrations.
 */
export function triggerAlert(type, deviceId, message, metadata) {
    const timestamp = new Date().toISOString();
    // Dev-only eye-catching console log
    console.error(`\n🚨 [ALERT_DISPATCHER][${type}] Device: ${deviceId} | Time: ${timestamp}\n` +
        `👉 Message: ${message}\n` +
        (metadata ? `📦 Metadata: ${JSON.stringify(metadata, null, 2)}\n` : ''));
    // In a real application, this would hook into:
    // - PushNotificationService.sendToUser(patientId, ...)
    // - Email/SMS notifications to Caregiver/Emergency contact
    // - Alert log table database record creation
}
/**
 * Evaluates device battery level and triggers an alert if below 15%.
 */
export function evaluateBatteryAlert(deviceId, batteryPercent) {
    if (batteryPercent < 15) {
        triggerAlert('LOW_BATTERY', deviceId, `Device battery is critically low (${batteryPercent}%). Please charge immediately.`, { batteryPercent });
    }
}
/**
 * Triggers a device offline alert.
 */
export function evaluateDeviceOfflineAlert(deviceId) {
    triggerAlert('DEVICE_OFFLINE', deviceId, `Device has lost connection and is now OFFLINE.`);
}
/**
 * Checks if a compartment access event (IR or Load-Cell drop) occurred outside of its allowed window.
 * The allowed window is when the state is 'available' or 'unlocked-awaiting-meal'.
 */
export function evaluateUnscheduledOpenAlert(deviceId, compartmentNumber, currentState, triggerEvent) {
    // If the compartment is locked or empty, but we receive an access sensor event, trigger tampering alert
    if (currentState === 'locked' || currentState === 'empty') {
        triggerAlert('UNSCHEDULED_OPEN', deviceId, `WARNING: Compartment ${compartmentNumber} was accessed via ${triggerEvent} while in state '${currentState}' (unscheduled access / tampering detected).`, { compartmentNumber, currentState, triggerEvent });
    }
}
/**
 * Triggers an empty compartment alert.
 */
export function evaluateCompartmentEmptyAlert(deviceId, compartmentNumber) {
    triggerAlert('COMPARTMENT_EMPTY', deviceId, `Notification: Compartment ${compartmentNumber} is now completely empty. A restock is required.`, { compartmentNumber });
}
//# sourceMappingURL=alertService.js.map