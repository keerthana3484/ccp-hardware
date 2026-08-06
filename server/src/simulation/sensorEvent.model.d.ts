import { Document, Model } from 'mongoose';
/**
 * Interface representing a SensorEvent document in MongoDB.
 */
export interface ISensorEvent extends Document {
    deviceId: string;
    compartmentId: number | string;
    sensorType: 'ir' | 'loadcell';
    value: any;
    timestamp: Date;
}
export declare const SensorEvent: Model<ISensorEvent>;
//# sourceMappingURL=sensorEvent.model.d.ts.map