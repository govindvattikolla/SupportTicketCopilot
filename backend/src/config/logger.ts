import { env } from './env';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'trackingtoken',
  'authorization',
  'cookie',
  'set-cookie',
  'jwt_secret',
  'secret',
  'creditcard',
  'cvv',
  'apikey',
]);

/**
 * Deeply redact sensitive properties from logged objects
 */
export const redactSensitiveData = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item));
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactSensitiveData(value);
    } else {
      result[key] = value;
    }
  }
  return result;
};

class Logger {
  private currentLevelIndex: number;

  constructor() {
    const configuredLevel = (env.LOG_LEVEL || (env.NODE_ENV === 'production' ? 'info' : 'debug')) as LogLevel;
    this.currentLevelIndex = LOG_LEVELS[configuredLevel] ?? LOG_LEVELS.info;
  }

  private shouldLog(level: LogLevel): boolean {
    if (env.NODE_ENV === 'test') {
      // In tests, only log warnings and errors to keep test output clean
      return LOG_LEVELS[level] >= LOG_LEVELS.warn;
    }
    return LOG_LEVELS[level] >= this.currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const cleanMeta = meta ? redactSensitiveData(meta) : undefined;

    if (env.NODE_ENV === 'production') {
      // Structured JSON format for cloud log aggregators (Datadog, CloudWatch, Loki)
      return JSON.stringify({
        timestamp,
        level: level.toUpperCase(),
        message,
        environment: env.NODE_ENV,
        service: 'supportflow-api',
        ...(cleanMeta ? { meta: cleanMeta } : {}),
      });
    }

    // Human-readable format in development
    const metaStr = cleanMeta ? ` ${JSON.stringify(cleanMeta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  debug(message: string, meta?: any): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }

  info(message: string, meta?: any): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, meta));
    }
  }

  warn(message: string, meta?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  error(message: string, meta?: any): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, meta));
    }
  }

  /**
   * Stream adapter for Express morgan HTTP access logger
   */
  get morganStream() {
    return {
      write: (message: string) => {
        this.info(message.trim());
      },
    };
  }
}

export const logger = new Logger();
