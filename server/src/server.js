import mongoose from 'mongoose';
import express from 'express';
import { Device } from './simulation/device.model.js';
import { startDeviceSimulator } from './simulation/deviceSimulator.js';
import deviceRouter from './simulation/deviceRoutes.js';
const app = express();
// Custom CORS middleware to allow dynamic cross-origin requests in development
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    next();
});
app.use(express.json());
app.use('/api/v1/device', deviceRouter);
/**
 * Seeds a dummy device if none exists in the database.
 */
async function seedMockDevice() {
    const count = await Device.countDocuments();
    if (count === 0) {
        console.log('[Server] No devices found. Seeding a mock IoT device: DEV-SIM-001...');
        const dummyPatientId = new mongoose.Types.ObjectId();
        const dummyMedicineId1 = new mongoose.Types.ObjectId();
        const dummyMedicineId2 = new mongoose.Types.ObjectId();
        const seededDevice = new Device({
            deviceId: 'DEV-SIM-001',
            patientId: dummyPatientId,
            online: true,
            batteryPercent: 100,
            wifiSignalPercent: 95,
            lastSeenAt: new Date(),
            firmwareVersion: '1.0.0-mock',
            compartments: [
                {
                    compartmentNumber: 1,
                    linkedMedicineId: dummyMedicineId1,
                    state: 'locked',
                    lastLoadCellReading: 15.0
                },
                {
                    compartmentNumber: 2,
                    linkedMedicineId: dummyMedicineId2,
                    state: 'locked',
                    lastLoadCellReading: 10.0
                }
            ]
        });
        await seededDevice.save();
        console.log('[Server] Mock IoT device seeded successfully.');
    }
}
/**
 * Connects to MongoDB, seeds initial data, and boots all active device simulators.
 */
export async function bootServer() {
    const mongoDbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smart-medicine-dispenser';
    try {
        console.log('[Server] Connecting to MongoDB...');
        await mongoose.connect(mongoDbUri);
        console.log('[Server] Connected to MongoDB.');
        // Seed data
        await seedMockDevice();
        // Query all devices and start their simulators
        const devices = await Device.find({});
        console.log(`[Server] Bootstrapping ${devices.length} device simulator(s)...`);
        for (const device of devices) {
            // Start simulator with a 15-second tick interval
            startDeviceSimulator(device.deviceId, 15000);
        }
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => {
            console.log(`[Server] REST API listening on port ${PORT}`);
        });
        console.log('[Server] Device simulation engine initialized and running.');
    }
    catch (error) {
        console.error('[Server] Boot error:', error);
        process.exit(1);
    }
}
// Run immediately if executed directly
if (process.argv[1]?.endsWith('server.js') || process.argv[1]?.endsWith('server.ts')) {
    bootServer();
}
//# sourceMappingURL=server.js.map