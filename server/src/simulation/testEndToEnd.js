import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { bootServer } from '../server.js';
import { SensorEvent } from './sensorEvent.model.js';
import { fireReminder } from './reminderWorkflow.js';
// Helper to delay execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function runEndToEndTest() {
    let mongoServer = null;
    const PORT = 5002;
    const baseUrl = `http://127.0.0.1:${PORT}/api/v1/device`;
    try {
        console.log('===========================================================');
        console.log('=== Starting Smart Dispenser End-to-End Workflow Test ===');
        console.log('===========================================================');
        // 1. Start In-Memory DB and Express server
        mongoServer = await MongoMemoryServer.create({ binary: { version: '4.4.24' } });
        const mongoUri = mongoServer.getUri();
        process.env.MONGODB_URI = mongoUri;
        process.env.PORT = String(PORT);
        console.log('[Setup] Spinning up test DB and Express server on port 5002...');
        await bootServer();
        await sleep(2000); // Allow server to bind
        // 2. Define our Medicine configuration (Requires Meal!)
        const metformin = {
            name: 'Metformin 500mg',
            foodRequired: true,
            standardWeight: 15.0 // weight of cup + medicine
        };
        console.log('\n--- Initial State Check ---');
        // Fetch dashboard status before workflow
        const initialDashRes = await fetch(`${baseUrl}/dashboard/medicine-status/DEV-SIM-001`);
        const initialDashData = await initialDashRes.json();
        console.log(`Initial Dashboard Status (Compartment 1): '${initialDashData.compartments[0].dashboardStatus}'`);
        if (initialDashData.compartments[0].dashboardStatus !== 'Scheduled') {
            throw new Error('Initial state mismatch. Expected "Scheduled".');
        }
        // =========================================================================
        // STEP 1: Reminder Fires
        // =========================================================================
        console.log('\n--- STEP 1: Medicine Reminder Fires (requires meal) ---');
        await fireReminder(PORT, 'DEV-SIM-001', 1, metformin);
        // Verify compartment state is unlocked-awaiting-meal
        const step1StatusRes = await fetch(`${baseUrl}/DEV-SIM-001/status`);
        const step1StatusData = await step1StatusRes.json();
        console.log(`Compartment 1 Device State: '${step1StatusData.compartments[0].state}'`);
        const step1DashRes = await fetch(`${baseUrl}/dashboard/medicine-status/DEV-SIM-001`);
        const step1DashData = await step1DashRes.json();
        console.log(`Caretaker Dashboard Status: '${step1DashData.compartments[0].dashboardStatus}'`);
        if (step1StatusData.compartments[0].state !== 'unlocked-awaiting-meal' ||
            step1DashData.compartments[0].dashboardStatus !== 'Awaiting Meal Confirmation') {
            throw new Error('Step 1 validation failed.');
        }
        // =========================================================================
        // STEP 2: Meal Confirmed
        // =========================================================================
        console.log('\n--- STEP 2: Patient Confirms Meal Intake ---');
        console.log('Sending Patient Meal Confirmation to endpoint...');
        const confirmMealRes = await fetch(`${baseUrl}/patient/confirm-meal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId: 'DEV-SIM-001', compartmentNumber: 1 })
        });
        const confirmMealData = await confirmMealRes.json();
        console.log('Response Payload:', JSON.stringify(confirmMealData, null, 2));
        // Verify compartment state advanced to available
        const step2StatusRes = await fetch(`${baseUrl}/DEV-SIM-001/status`);
        const step2StatusData = await step2StatusRes.json();
        console.log(`Compartment 1 Device State: '${step2StatusData.compartments[0].state}'`);
        const step2DashRes = await fetch(`${baseUrl}/dashboard/medicine-status/DEV-SIM-001`);
        const step2DashData = await step2DashRes.json();
        console.log(`Caretaker Dashboard Status: '${step2DashData.compartments[0].dashboardStatus}'`);
        if (step2StatusData.compartments[0].state !== 'available' ||
            step2DashData.compartments[0].dashboardStatus !== 'Ready to Take') {
            throw new Error('Step 2 validation failed.');
        }
        // =========================================================================
        // STEP 3: Patient marks taken (UI Tapped "Taken")
        // =========================================================================
        console.log('\n--- STEP 3: Patient Taps "Taken" in mobile app UI ---');
        console.log('App UI posts to /patient/take-medicine...');
        const takeMedRes = await fetch(`${baseUrl}/patient/take-medicine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId: 'DEV-SIM-001', compartmentNumber: 1 })
        });
        const takeMedData = await takeMedRes.json();
        console.log('Response Payload:', JSON.stringify(takeMedData, null, 2));
        // Verify compartment state advanced to dispensed and empty
        const step3StatusRes = await fetch(`${baseUrl}/DEV-SIM-001/status`);
        const step3StatusData = await step3StatusRes.json();
        console.log(`Compartment 1 Device State: '${step3StatusData.compartments[0].state}'`);
        const step3DashRes = await fetch(`${baseUrl}/dashboard/medicine-status/DEV-SIM-001`);
        const step3DashData = await step3DashRes.json();
        console.log(`Caretaker Dashboard Status: '${step3DashData.compartments[0].dashboardStatus}'`);
        if (step3StatusData.compartments[0].state !== 'empty' ||
            step3DashData.compartments[0].dashboardStatus !== 'Taken (Out of Stock)') {
            throw new Error('Step 3 validation failed.');
        }
        // =========================================================================
        // Verify Database Audit Logs
        // =========================================================================
        console.log('\n--- Verification: Checking Database SensorEvent Audit Trails ---');
        const events = await SensorEvent.find({ deviceId: 'DEV-SIM-001' }).sort({ timestamp: 1 });
        console.log(`Found ${events.length} SensorEvent(s) in database:`);
        events.forEach((ev, idx) => {
            console.log(`  [Log #${idx + 1}] Type: ${ev.sensorType.toUpperCase()} | ` +
                `Value: ${JSON.stringify(ev.value)} | ` +
                `Time: ${ev.timestamp.toISOString()}`);
        });
        if (events.length < 4) {
            throw new Error(`Expected at least 4 logged events, but found ${events.length}`);
        }
        console.log('\n===========================================================');
        console.log('=== 🎉 ALL END-TO-END WORKFLOW CHECKS PASSED SUCCESSFULLY ===');
        console.log('===========================================================');
    }
    catch (error) {
        console.error('✗ End-to-end integration test failed:', error);
        process.exit(1);
    }
    finally {
        console.log('\nShutting down servers and clearing connections...');
        await mongoose.disconnect();
        if (mongoServer) {
            await mongoServer.stop();
        }
        console.log('Teardown complete. Exiting.');
        process.exit(0);
    }
}
runEndToEndTest();
//# sourceMappingURL=testEndToEnd.js.map