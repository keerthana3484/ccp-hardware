import mongoose, { Schema, Document, Model } from 'mongoose';
// Compartment sub-schema definition (embedded in Device)
const CompartmentSchema = new Schema({
    compartmentNumber: {
        type: Number,
        required: true
    },
    linkedMedicineId: {
        type: Schema.Types.ObjectId,
        ref: 'Medicine',
        required: true
    },
    state: {
        type: String,
        enum: ['locked', 'unlocked-awaiting-meal', 'available', 'dispensed', 'empty'],
        default: 'locked',
        required: true
    },
    lastIrEventAt: {
        type: Date
    },
    lastLoadCellReading: {
        type: Number,
        required: true,
        default: 0.0
    }
}, {
    _id: false // Disable auto-generating _id for subdocuments unless needed
});
// Device main schema definition
const DeviceSchema = new Schema({
    deviceId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    patientId: {
        type: Schema.Types.ObjectId,
        ref: 'Patient',
        required: true,
        index: true
    },
    online: {
        type: Boolean,
        required: true,
        default: false
    },
    batteryPercent: {
        type: Number,
        required: true,
        default: 100,
        min: 0,
        max: 100
    },
    wifiSignalPercent: {
        type: Number,
        required: true,
        default: 100,
        min: 0,
        max: 100
    },
    lastSeenAt: {
        type: Date,
        required: true,
        default: Date.now
    },
    firmwareVersion: {
        type: String,
        required: true,
        default: '1.0.0-mock'
    },
    compartments: {
        type: [CompartmentSchema],
        default: []
    }
}, {
    timestamps: true
});
export const Device = mongoose.models.Device || mongoose.model('Device', DeviceSchema);
//# sourceMappingURL=device.model.js.map