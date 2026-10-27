import mongoose from 'mongoose';
import { env } from '../config/env';
import { connectDatabase, closeDatabase, getDatabaseStatus } from '../config/db';

async function verifyConnection() {
  console.log('Testing MongoDB connection...');
  console.log(`Environment: ${env.NODE_ENV}`);

  // Safely display host and db name without credentials
  try {
    const parsedUri = new URL(env.MONGODB_URI);
    console.log(`Target Host: ${parsedUri.host}`);
    console.log(`Database:    ${parsedUri.pathname.replace(/^\//, '') || 'default'}`);
  } catch {
    // If not standard URL format (e.g. srv without standard URL parsing), mask credentials
    const masked = env.MONGODB_URI.replace(/\/\/(.*?)@/, '//***:***@');
    console.log(`Target URI:  ${masked}`);
  }

  const startTime = Date.now();
  await connectDatabase();
  const latency = Date.now() - startTime;

  const status = getDatabaseStatus();

  if (status !== 'connected' || !mongoose.connection.db) {
    throw new Error(`Database connection status is '${status}', not 'connected'`);
  }

  // Ping the database
  const pingResult = await mongoose.connection.db.admin().ping();
  console.log('Ping Result:', pingResult);
  console.log(`Latency:     ${latency}ms`);
  console.log('✅ MongoDB connection successfully verified and active!');

  await closeDatabase();
}

verifyConnection()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Connection verification failed:', err.message);
    process.exit(1);
  });
