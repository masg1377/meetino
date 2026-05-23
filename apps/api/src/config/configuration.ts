/**
 * Centralized config loader. Read once from process.env and expose a typed
 * shape so the rest of the app never touches process.env directly.
 */
export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  host: string;
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  cors: {
    webOrigin: string;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
  };
  livekit: {
    apiKey: string;
    apiSecret: string;
    /** WS URL the backend hands back to clients. */
    url: string;
    /** TTL of the join token, in minutes. */
    tokenTtlMinutes: number;
  };
  /** Phase 7.7 — shared-files storage. */
  media: {
    /** Absolute or process-relative directory used to write uploaded files. */
    uploadDir: string;
    /** Hard cap; per-type checks happen in code as well. Bytes. */
    maxFileSizeBytes: number;
  };
}

export const configuration = (): AppConfig => ({
  nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development',
  port: parseInt(process.env.API_PORT ?? '4000', 10),
  host: process.env.API_HOST ?? '0.0.0.0',
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  cors: {
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  livekit: {
    apiKey: process.env.LIVEKIT_API_KEY ?? '',
    apiSecret: process.env.LIVEKIT_API_SECRET ?? '',
    url: process.env.LIVEKIT_URL ?? 'ws://localhost:7880',
    tokenTtlMinutes: parseInt(process.env.LIVEKIT_TOKEN_TTL_MINUTES ?? '360', 10),
  },
  media: {
    uploadDir: process.env.MEDIA_UPLOAD_DIR ?? './storage/meeting-files',
    maxFileSizeBytes: parseInt(
      process.env.MEDIA_MAX_FILE_BYTES ?? `${25 * 1024 * 1024}`,
      10,
    ),
  },
});
