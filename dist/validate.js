"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const device_model_1 = require("./device.model");
const sensorEvent_model_1 = require("./sensorEvent.model");
console.log('Starting Mongoose schema validation check...');
const patientId = new mongoose_1.default.Types.ObjectId();
const linkedMedicineId = new mongoose_1.default.Types.ObjectId();
// 1. Create a valid mock Device document instance
const mockDevice = new device_model_1.Device({
    deviceId: 'test-device-123',
    patientId,
    online: true,
    batteryPercent: 85,
    wifiSignalPercent: 90,
    lastSeenAt: new Date(),
    firmwareVersion: '1.0.0-mock',
    compartments: [
        {
            compartmentNumber: 1,
            linkedMedicineId,
            state: 'locked',
            lastLoadCellReading: 12.5
        },
        {
            compartmentNumber: 2,
            linkedMedicineId,
            state: 'unlocked-awaiting-meal',
            lastLoadCellReading: 0.0
        }
    ]
});
// Run mongoose validation
const deviceValidationError = mockDevice.validateSync();
if (deviceValidationError) {
    console.error('Device validation failed:', deviceValidationError.message);
    process.exit(1);
}
else {
    console.log('✓ Device model validation passed!');
}
// 2. Create a valid mock SensorEvent document instance
const mockSensorEvent = new sensorEvent_model_1.SensorEvent({
    deviceId: 'test-device-123',
    compartmentId: 1,
    sensorType: 'loadcell',
    value: 12.4,
    timestamp: new Date()
});
const eventValidationError = mockSensorEvent.validateSync();
if (eventValidationError) {
    console.error('SensorEvent validation failed:', eventValidationError.message);
    process.exit(1);
}
else {
    console.log('✓ SensorEvent model validation passed!');
}
// 3. Test invalid states / values to check schema constraints
const invalidDevice = new device_model_1.Device({
    deviceId: 'invalid-device',
    patientId,
    batteryPercent: 150, // Invalid: max is 100
    compartments: [
        {
            compartmentNumber: 1,
            linkedMedicineId,
            state: 'invalid-state' // Invalid enum value
        }
    ]
});
const invalidValidationError = invalidDevice.validateSync();
if (invalidValidationError) {
    console.log('✓ Schema constraints validated successfully (rejected invalid input as expected).');
}
else {
    console.error('✗ Schema validation failed to catch invalid constraints.');
    process.exit(1);
}
console.log('All schema validation checks completed successfully!');
