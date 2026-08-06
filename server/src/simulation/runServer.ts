import { MongoMemoryServer } from 'mongodb-memory-server';
import { bootServer } from '../server.js';

async function run() {
  console.log('=== Starting Simulated IoT Backend Server with In-Memory MongoDB ===');
  try {
    const mongoServer = await MongoMemoryServer.create({ binary: { version: '4.4.24' } });
    const mongoUri = mongoServer.getUri();
    
    process.env.MONGODB_URI = mongoUri;
    process.env.PORT = '5000';

    await bootServer();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

run();
