import mongoose, { Document, Model } from 'mongoose';
/**
 * Interface representing a compartment sub-structure on a device.
 */
export interface ICompartment {
    compartmentNumber: number;
    linkedMedicineId: mongoose.Types.ObjectId;
    state: 'locked' | 'unlocked-awaiting-meal' | 'available' | 'dispensed' | 'empty';
    lastIrEventAt?: Date;
    lastLoadCellReading: number;
}
/**
 * Interface representing a Device document in MongoDB.
 */
export interface IDevice extends Document {
    deviceId: string;
    patientId: mongoose.Types.ObjectId;
    online: boolean;
    batteryPercent: number;
    wifiSignalPercent: number;
    lastSeenAt: Date;
    firmwareVersion: string;
    compartments: ICompartment[];
    createdAt: Date;
    updatedAt: Date;
}
export declare const Device: Model<IDevice>;
//# sourceMappingURL=device.model.d.ts.map