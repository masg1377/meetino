import * as Joi from 'joi';

/**
 * Boot-time validation of process.env. Any missing/invalid var fails the
 * NestJS bootstrap with a clear error, instead of breaking at runtime.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  API_PORT: Joi.number().port().default(4000),
  API_HOST: Joi.string().default('0.0.0.0'),

  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),

  REDIS_URL: Joi.string().uri({ scheme: ['redis', 'rediss'] }).required(),

  WEB_ORIGIN: Joi.string().uri().default('http://localhost:3000'),

  // Reserved for Phase 2. Strings of at least 32 chars to discourage weak secrets.
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Phase 6 — LiveKit. API key/secret must match the keys: block in livekit.yaml.
  LIVEKIT_API_KEY: Joi.string().min(3).required(),
  LIVEKIT_API_SECRET: Joi.string().min(32).required(),
  LIVEKIT_URL: Joi.string()
    .uri({ scheme: ['ws', 'wss', 'http', 'https'] })
    .default('ws://localhost:7880'),
  LIVEKIT_TOKEN_TTL_MINUTES: Joi.number().integer().min(5).max(24 * 60).default(360),

  // Phase 7.7 — meeting-files storage (self-hosted local disk).
  MEDIA_UPLOAD_DIR: Joi.string().default('./storage/meeting-files'),
  MEDIA_MAX_FILE_BYTES: Joi.number().integer().min(1024).default(25 * 1024 * 1024),
});
