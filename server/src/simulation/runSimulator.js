import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Device } from './device.model.js';
import { SensorEvent } from './sensorEvent.model.js';
import { simulateDeviceTick, advanceCompartmentState } from './deviceSimulator.js';
// Helper to delay execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function runSimulationTest() {
    let mongoServer = null;
    try {
        console.log('=== Starting IoT Simulator Integration Test ===');
        // 1. Connect to In-Memory MongoDB
        mongoServer = await MongoMemoryServer.create({ binary: { version: '4.4.24' } });
        const uri = mongoServer.getUri();
        console.log(`Connecting to In-Memory MongoDB at: ${uri}`);
        await mongoose.connect(uri);
        // Clean collections to ensure test isolation
        await Device.deleteMany({});
        await SensorEvent.deleteMany({});
        console.log('Cleaned test database collections.');
        // 2. Seed a test device
        const deviceId = 'DEV-TEST-999';
        const patientId = new mongoose.Types.ObjectId();
        const medicineId = new mongoose.Types.ObjectId();
        console.log(`Seeding test device: ${deviceId}`);
        const device = new Device({
            deviceId,
            patientId,
            online: true,
            batteryPercent: 100,
            wifiSignalPercent: 90,
            lastSeenAt: new Date(),
            firmwareVersion: '1.0.0-test',
            compartments: [
                {
                    compartmentNumber: 1,
                    linkedMedicineId: medicineId,
                    state: 'locked',
                    lastLoadCellReading: 15.0
                }
            ]
        });
        await device.save();
        // 3. Test telemetry loop (execute 3 ticks and observe values)
        console.log('\n--- Telemetry Tick Simulation (Gradual battery drain & Wi-Fi jitter) ---');
        for (let i = 1; i <= 3; i++) {
            console.log(`Executing tick #${i}...`);
            await simulateDeviceTick(deviceId);
            await sleep(500); // short wait to space logs
        }
        // Verify telemetry updated in DB
        const deviceAfterTicks = await Device.findOne({ deviceId });
        if (!deviceAfterTicks)
            throw new Error('Device missing after ticks');
        console.log(`Updated Battery: ${deviceAfterTicks.batteryPercent}%, Wi-Fi: ${deviceAfterTicks.wifiSignalPercent}%`);
        // 4. Test State Machine Transition flow
        console.log('\n--- State Transition Simulation (Compartment 1) ---');
        const steps = [
            {
                event: 'REMINDER_FIRED_WITH_MEAL',
                expectedState: 'unlocked-awaiting-meal'
            },
            {
                event: 'MEAL_CONFIRMED',
                expectedState: 'available'
            },
            {
                event: 'IR_EVENT',
                payload: true,
                expectedState: 'dispensed'
            },
            {
                event: 'LOAD_CELL_DROP',
                payload: 0.0,
                expectedState: 'empty'
            },
            {
                event: 'RESTOCK',
                payload: 15.0,
                expectedState: 'locked'
            }
        ];
        for (const step of steps) {
            console.log(`Triggering event: '${step.event}' (payload: ${step.payload !== undefined ? JSON.stringify(step.payload) : 'none'})`);
            const newState = await advanceCompartmentState(deviceId, 1, step.event, step.payload);
            if (newState !== step.expectedState) {
                throw new Error(`Expected state '${step.expectedState}', but got '${newState}'`);
            }
            console.log(`✓ Confirmed state is now: '${newState}'`);
        }
        // 5. Verify SensorEvent Logs
        console.log('\n--- Verifying Saved SensorEvent Audit Logs ---');
        const events = await SensorEvent.find({ deviceId }).sort({ timestamp: 1 });
        console.log(`Found ${events.length} SensorEvent(s) in database:`);
        events.forEach((ev, idx) => {
            console.log(`  [Event #${idx + 1}] Type: ${ev.sensorType} | Value: ${JSON.stringify(ev.value)} | Time: ${ev.timestamp.toISOString()}`);
        });
        if (events.length !== 5) {
            throw new Error(`Expected 5 logged events, but found ${events.length}`);
        }
        console.log('✓ All 5 state transitions logged a matching SensorEvent!');
        console.log('\n=== All Simulator Engine Checks Passed Successfully! ===');
    }
    catch (error) {
        console.error('✗ Simulation test failed with error:', error);
    }
    finally {
        await mongoose.disconnect();
        if (mongoServer) {
            await mongoServer.stop();
        }
        console.log('Disconnected from MongoDB.');
    }
}
runSimulationTest();
//# sourceMappingURL=runSimulator.js.map