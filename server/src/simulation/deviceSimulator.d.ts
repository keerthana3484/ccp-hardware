export type TriggerEvent = 'REMINDER_FIRED_NO_MEAL' | 'REMINDER_FIRED_WITH_MEAL' | 'MEAL_CONFIRMED' | 'IR_EVENT' | 'LOAD_CELL_DROP' | 'TIMEOUT' | 'RESTOCK';
/**
 * Service to execute a single simulation tick for a device.
 * Updates battery percentage, Wi-Fi signal, online status flakiness, and lastSeenAt.
 */
export declare function simulateDeviceTick(deviceId: string): Promise<void>;
/**
 * Starts the periodic simulator engine for a given device.
 * Defaults to a 15-second tick interval.
 */
export declare function startDeviceSimulator(deviceId: string, intervalMs?: number): void;
/**
 * Stops the periodic simulator engine for a given device.
 */
export declare function stopDeviceSimulator(deviceId: string): void;
/**
 * Stops all running device simulators.
 */
export declare function stopAllSimulators(): void;
/**
 * Advances the compartment state based on a physical or system triggering event.
 * Follows the transition table strictly, logging a SensorEvent for each successful transition.
 */
export declare function advanceCompartmentState(deviceId: string, compartmentNumber: number, event: TriggerEvent, payload?: any): Promise<string>;
//# sourceMappingURL=deviceSimulator.d.ts.map