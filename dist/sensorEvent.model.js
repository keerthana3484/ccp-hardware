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
exports.SensorEvent = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SensorEventSchema = new mongoose_1.Schema({
    deviceId: {
        type: String,
        required: true,
        index: true
    },
    compartmentId: {
        type: mongoose_1.Schema.Types.Mixed, // Allows either compartment number (index) or unique ID
        required: true,
        index: true
    },
    sensorType: {
        type: String,
        enum: ['ir', 'loadcell'],
        required: true
    },
    value: {
        type: mongoose_1.Schema.Types.Mixed, // Flexible to support IR triggers (boolean/number) and loadcell weight (number)
        required: true
    },
    timestamp: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    }
}, {
    timestamps: false // We use the timestamp field directly as event timestamp
});
exports.SensorEvent = mongoose_1.default.models.SensorEvent || mongoose_1.default.model('SensorEvent', SensorEventSchema);
