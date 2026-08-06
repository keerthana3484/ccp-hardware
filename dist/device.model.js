"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Device = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// Compartment sub-schema definition (embedded in Device)
const CompartmentSchema = new mongoose_1.Schema({
    compartmentNumber: {
        type: Number,
        required: true
    },
    linkedMedicineId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
const DeviceSchema = new mongoose_1.Schema({
    deviceId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    patientId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
exports.Device = mongoose_1.default.models.Device || mongoose_1.default.model('Device', DeviceSchema);
