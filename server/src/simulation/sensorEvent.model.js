import mongoose, { Schema, Document, Model } from 'mongoose';
const SensorEventSchema = new Schema({
    deviceId: {
        type: String,
        required: true,
        index: true
    },
    compartmentId: {
        type: Schema.Types.Mixed, // Allows either compartment number (index) or unique ID
        required: true,
        index: true
    },
    sensorType: {
        type: String,
        enum: ['ir', 'loadcell'],
        required: true
    },
    value: {
        type: Schema.Types.Mixed, // Flexible to support IR triggers (boolean/number) and loadcell weight (number)
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
export const SensorEvent = mongoose.models.SensorEvent || mongoose.model('SensorEvent', SensorEventSchema);
//# sourceMappingURL=sensorEvent.model.js.map