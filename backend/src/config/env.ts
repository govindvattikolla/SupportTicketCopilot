import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables from .env file (checks backend/.env, current cwd, or repo root)
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend', '.env'),
  path.resolve(__dirname, '../../.env'),
];

for (const p of envPaths) {
  dotenv.config({ path: p });
}

const envSchema = z.object({
  PORT: z
    .string()
    .default('5000')
    .transform((val) => parseInt(val, 10))
    .refine((port) => port > 0 && port < 65536, {
      message: 'PORT must be a valid port number between 1 and 65535',
    }),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  MONGODB_URI: z
    .string({
      required_error: 'MONGODB_URI is required. Please set it in your .env file.',
    })
    .min(1, 'MONGODB_URI cannot be empty'),
  CLIENT_URL: z
    .string()
    .default('http://localhost:5173'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:');
  parsedEnv.error.issues.forEach((issue) => {
    console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
  });
  // In test environment, allow tests to set their own variables if needed
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
}

export const env = parsedEnv.success
  ? parsedEnv.data
  : {
      PORT: 5000,
      NODE_ENV: 'test' as const,
      MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/supportflow_test',
      CLIENT_URL: 'http://localhost:5173',
    };
