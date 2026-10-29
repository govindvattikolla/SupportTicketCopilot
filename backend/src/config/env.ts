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

const envSchema = z
  .object({
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
    CLIENT_URL: z.string().default('http://localhost:5173'),
    JWT_SECRET: z.string().default('supportflow_super_secret_jwt_key_2026'),
    JWT_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_SECRET: z.string().default('supportflow_super_secret_jwt_refresh_key_2026'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
    REDIS_URL: z.string().optional(),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_PATH: z.string().default('uploads'),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_ENDPOINT: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Production Security Invariant: Reject default/weak JWT secrets in production
    if (data.NODE_ENV === 'production') {
      if (
        data.JWT_SECRET === 'supportflow_super_secret_jwt_key_2026' ||
        data.JWT_SECRET.length < 32
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_SECRET'],
          message:
            'In production, JWT_SECRET must be explicitly set and be at least 32 characters long.',
        });
      }
      if (
        data.JWT_REFRESH_SECRET === 'supportflow_super_secret_jwt_refresh_key_2026' ||
        data.JWT_REFRESH_SECRET.length < 32
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_REFRESH_SECRET'],
          message:
            'In production, JWT_REFRESH_SECRET must be explicitly set and be at least 32 characters long.',
        });
      }
    }
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

export type EnvConfig = z.infer<typeof envSchema>;

export const env: EnvConfig = parsedEnv.success
  ? parsedEnv.data
  : {
      PORT: 5000,
      NODE_ENV: 'test',
      MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/supportflow_test',
      CLIENT_URL: 'http://localhost:5173',
      JWT_SECRET: process.env.JWT_SECRET || 'supportflow_super_secret_jwt_key_2026',
      JWT_EXPIRES_IN: '15m',
      JWT_REFRESH_SECRET:
        process.env.JWT_REFRESH_SECRET || 'supportflow_super_secret_jwt_refresh_key_2026',
      JWT_REFRESH_EXPIRES_IN: '7d',
      REDIS_URL: process.env.REDIS_URL,
      LOG_LEVEL: 'info',
      STORAGE_DRIVER: 'local',
      STORAGE_LOCAL_PATH: 'uploads',
      S3_BUCKET: process.env.S3_BUCKET,
      S3_REGION: process.env.S3_REGION,
      S3_ENDPOINT: process.env.S3_ENDPOINT,
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    };
