import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { bootServer } from '../server.js';
import { SensorEvent } from './sensorEvent.model.js';
// Helper to delay execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function runEndpointsTest() {
    let mongoServer = null;
    let serverInstance = null;
    try {
        console.log('=== Starting REST Endpoints Integration Test ===');
        // 1. Setup In-Memory DB
        mongoServer = await MongoMemoryServer.create({ binary: { version: '4.4.24' } });
        const mongoUri = mongoServer.getUri();
        // Set environment variables for bootServer configuration
        process.env.MONGODB_URI = mongoUri;
        process.env.PORT = '5001';
        console.log(`Spinning up test DB and Express server...`);
        await bootServer();
        await sleep(2000); // Wait for express to start listening
        const baseUrl = 'http://127.0.0.1:5001/api/v1/device';
        // 2. Test GET Status snapshot
        console.log('\n[Test 1] GET Status snapshot...');
        const statusRes = await fetch(`${baseUrl}/DEV-SIM-001/status`);
        console.log(`Status Code: ${statusRes.status}`);
        const statusData = await statusRes.json();
        console.log('Response Payload:', JSON.stringify(statusData, null, 2));
        if (statusRes.status !== 200 || statusData.deviceId !== 'DEV-SIM-001') {
            throw new Error('GET status test failed.');
        }
        // 3. Test POST Heartbeat
        console.log('\n[Test 2] POST Heartbeat (telemetry update)...');
        const heartbeatRes = await fetch(`${baseUrl}/DEV-SIM-001/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batteryPercent: 92, wifiSignalPercent: 88 })
        });
        console.log(`Status Code: ${heartbeatRes.status}`);
        const heartbeatData = await heartbeatRes.json();
        console.log('Response Payload:', JSON.stringify(heartbeatData, null, 2));
        if (heartbeatRes.status !== 200 || !heartbeatData.success) {
            throw new Error('POST heartbeat test failed.');
        }
        // 4. Test POST Unlock (Server-side Trigger: Awaiting Meal)
        console.log('\n[Test 3] POST Unlock (requiring meal, transitions locked -> awaiting meal)...');
        const unlockRes = await fetch(`${baseUrl}/DEV-SIM-001/compartment/1/unlock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requiresMeal: true })
        });
        console.log(`Status Code: ${unlockRes.status}`);
        const unlockData = await unlockRes.json();
        console.log('Response Payload:', JSON.stringify(unlockData, null, 2));
        if (unlockRes.status !== 200 || unlockData.state !== 'unlocked-awaiting-meal') {
            throw new Error('POST unlock test failed.');
        }
        // 5. Test POST Sensor-Event: Meal Confirmed
        console.log('\n[Test 4] POST Simulate Meal Confirmed (transitions awaiting-meal -> available)...');
        const mealRes = await fetch(`${baseUrl}/simulate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceId: 'DEV-SIM-001',
                event: 'MEAL_CONFIRMED',
                compartmentNumber: 1
            })
        });
        console.log(`Status Code: ${mealRes.status}`);
        const mealData = await mealRes.json();
        console.log('Response Payload:', JSON.stringify(mealData, null, 2));
        if (mealRes.status !== 200 || mealData.newState !== 'available') {
            throw new Error('POST meal confirm simulation failed.');
        }
        // 6. Test POST Sensor-Event: IR event (transitions available -> dispensed)
        console.log('\n[Test 5] POST raw Sensor Event: IR beam broken (transitions available -> dispensed)...');
        const irRes = await fetch(`${baseUrl}/DEV-SIM-001/sensor-event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                compartmentId: 1,
                sensorType: 'ir',
                value: true
            })
        });
        console.log(`Status Code: ${irRes.status}`);
        const irData = await irRes.json();
        console.log('Response Payload:', JSON.stringify(irData, null, 2));
        if (irRes.status !== 200 || irData.newState !== 'dispensed') {
            throw new Error('POST IR sensor-event test failed.');
        }
        // 7. Test POST Sensor-Event: Load Cell weight drops to 0 (transitions dispensed -> empty & alerts)
        console.log('\n[Test 6] POST raw Sensor Event: Load cell weight drops to 0g (transitions dispensed -> empty & triggers Empty Alert)...');
        const lcRes = await fetch(`${baseUrl}/DEV-SIM-001/sensor-event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                compartmentId: 1,
                sensorType: 'loadcell',
                value: 0.0
            })
        });
        console.log(`Status Code: ${lcRes.status}`);
        const lcData = await lcRes.json();
        console.log('Response Payload:', JSON.stringify(lcData, null, 2));
        if (lcRes.status !== 200 || lcData.newState !== 'empty') {
            throw new Error('POST Loadcell sensor-event test failed.');
        }
        // 8. Test Dev Simulation: Low Battery Alert trigger
        console.log('\n[Test 7] POST Simulate Low Battery Demo (triggers Low Battery Alert)...');
        const batRes = await fetch(`${baseUrl}/simulate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceId: 'DEV-SIM-001',
                event: 'LOW_BATTERY_DEMO'
            })
        });
        console.log(`Status Code: ${batRes.status}`);
        const batData = await batRes.json();
        console.log('Response Payload:', JSON.stringify(batData, null, 2));
        // 9. Test Dev Simulation: Unscheduled open tampering alert trigger
        // Since compartment 1 is in state 'empty', triggering an IR event represents tampering/unauthorized access
        console.log('\n[Test 8] POST Simulate Tampering / Unscheduled open (triggers Unscheduled Open Alert)...');
        const tampRes = await fetch(`${baseUrl}/simulate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceId: 'DEV-SIM-001',
                event: 'IR_EVENT',
                compartmentNumber: 1,
                payload: true
            })
        });
        console.log(`Status Code: ${tampRes.status}`);
        const tampData = await tampRes.json();
        console.log('Response Payload:', JSON.stringify(tampData, null, 2));
        // Print final sensor event logs
        console.log('\n--- Final Database Sensor Events log ---');
        const events = await SensorEvent.find({ deviceId: 'DEV-SIM-001' }).sort({ timestamp: 1 });
        console.log(`Found ${events.length} SensorEvent logs:`);
        events.forEach((ev, idx) => {
            console.log(`  [Log #${idx + 1}] Sensor: ${ev.sensorType} | Value: ${JSON.stringify(ev.value)} | Time: ${ev.timestamp.toISOString()}`);
        });
        console.log('\n=== All REST Endpoints & Alert Tests Passed Successfully! ===');
    }
    catch (error) {
        console.error('✗ Integration test failed with error:', error);
        process.exit(1);
    }
    finally {
        console.log('Cleaning up connection and closing servers...');
        await mongoose.disconnect();
        if (mongoServer) {
            await mongoServer.stop();
        }
        console.log('Teardown complete. Exiting test execution.');
        process.exit(0);
    }
}
runEndpointsTest();
//# sourceMappingURL=testEndpoints.js.map