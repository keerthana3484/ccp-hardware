export interface Medicine {
    name: string;
    foodRequired: boolean;
    standardWeight: number;
}
/**
 * Simulates the application's reminder scheduler engine.
 * When a scheduled medication dose time is reached, it fires a reminder by
 * sending an unlock instruction to the physical IoT device compartment.
 */
export declare function fireReminder(port: number, deviceId: string, compartmentNumber: number, medicine: Medicine): Promise<void>;
//# sourceMappingURL=reminderWorkflow.d.ts.map