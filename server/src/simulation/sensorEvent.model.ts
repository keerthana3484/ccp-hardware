import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Interface representing a SensorEvent document in MongoDB.
 */
export interface ISensorEvent extends Document {
  deviceId: string;
  compartmentId: number | string; // Corresponds to the compartmentNumber (or ID) of the device
  sensorType: 'ir' | 'loadcell';
  value: any; // Can be boolean/number for IR, or number (weight) for loadcell
  timestamp: Date;
}

const SensorEventSchema = new Schema<ISensorEvent>({
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

export const SensorEvent: Model<ISensorEvent> = mongoose.models.SensorEvent || mongoose.model<ISensorEvent>('SensorEvent', SensorEventSchema);
