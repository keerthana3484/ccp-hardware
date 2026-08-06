/**
 * Simulates the application's reminder scheduler engine.
 * When a scheduled medication dose time is reached, it fires a reminder by
 * sending an unlock instruction to the physical IoT device compartment.
 */
export async function fireReminder(port, deviceId, compartmentNumber, medicine) {
    const unlockUrl = `http://127.0.0.1:${port}/api/v1/device/${deviceId}/compartment/${compartmentNumber}/unlock`;
    console.log(`⏰ [ReminderWorkflow] Reminder Fired! Medication: '${medicine.name}' | ` +
        `Compartment: ${compartmentNumber} | Food Required: ${medicine.foodRequired}`);
    try {
        const response = await fetch(unlockUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                requiresMeal: medicine.foodRequired
            })
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to unlock compartment on device. Status: ${response.status}. Detail: ${errorText}`);
        }
        const data = await response.json();
        console.log(`[ReminderWorkflow] Device unlock instruction acknowledged. ` +
            `Next state: '${data.state}' (acknowledged by device)`);
    }
    catch (error) {
        console.error(`[ReminderWorkflow] Error firing reminder to device layer:`, error);
        throw error;
    }
}
//# sourceMappingURL=reminderWorkflow.js.map