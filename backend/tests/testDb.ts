import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDatabase, closeDatabase } from '../src/config/db';

export interface TestDbInstance {
  uri: string;
  close: () => Promise<void>;
}

export async function createTestDatabase(suiteName: string): Promise<TestDbInstance> {
  const directUri = process.env.TEST_MONGO_URI;
  if (directUri) {
    await connectDatabase(directUri);
    return {
      uri: directUri,
      close: async () => {
        await closeDatabase();
      },
    };
  }

  // Check if local MongoDB is available on 127.0.0.1:27017
  try {
    const testConn = await mongoose.connect('mongodb://127.0.0.1:27017/admin', {
      serverSelectionTimeoutMS: 1500,
    });
    await testConn.connection.close();

    const cleanSuite = suiteName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const localUri = `mongodb://127.0.0.1:27017/supportflow_test_${cleanSuite}_${Date.now()}`;
    await connectDatabase(localUri);

    return {
      uri: localUri,
      close: async () => {
        try {
          if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.dropDatabase();
          }
        } catch {
          // ignore drop errors
        } finally {
          await closeDatabase();
        }
      },
    };
  } catch {
    // Fallback to MongoMemoryServer
    const mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await connectDatabase(uri);

    return {
      uri,
      close: async () => {
        await closeDatabase();
        await mongoServer.stop();
      },
    };
  }
}
