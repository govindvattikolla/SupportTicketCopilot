import mongoose from 'mongoose';
import { env } from './env';

export type DatabaseStatus = 'connected' | 'connecting' | 'disconnected' | 'disconnecting' | 'uninitialized';

export const getDatabaseStatus = (): DatabaseStatus => {
  switch (mongoose.connection.readyState) {
    case 1:
      return 'connected';
    case 2:
      return 'connecting';
    case 3:
      return 'disconnecting';
    case 0:
    default:
      return 'disconnected';
  }
};

export const connectDatabase = async (uri?: string): Promise<void> => {
  const connectionUri = uri || env.MONGODB_URI;

  if (mongoose.connection.readyState === 1) {
    return;
  }

  // Sanitize URI for safe logging (mask username and password)
  const sanitizedUri = connectionUri.replace(/\/\/(.*?)@/, '//***:***@');

  try {
    if (mongoose.connection.listenerCount('connected') === 0) {
      mongoose.connection.on('connected', () => {
        console.log(`[Database] MongoDB connection established (${sanitizedUri})`);
      });

      mongoose.connection.on('error', (err) => {
        console.error('[Database] MongoDB connection error:', err.message);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('[Database] MongoDB disconnected');
      });
    }

    await mongoose.connect(connectionUri, {
      serverSelectionTimeoutMS: 15000,
      autoIndex: env.NODE_ENV !== 'production',
    });
  } catch (error: any) {
    console.error(`[Database] Failed to connect to MongoDB (${sanitizedUri}):`, error.message);
    // In production or development, don't crash the entire HTTP server on initial DB failure
    // so the health endpoint can accurately report the connection failure without crashing.
    if (env.NODE_ENV === 'production') {
      throw error;
    }
  }
};

export const closeDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};
