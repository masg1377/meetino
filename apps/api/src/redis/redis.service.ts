import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { AppConfig } from '../config/configuration';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get('redis', { infer: true }).url;

    this.client = new Redis(url, {
      // Fail fast in dev rather than retrying forever.
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    this.client.on('connect', () => this.logger.log('Redis connection established'));
    this.client.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));

    // Verify connection at boot.
    await this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis connection closed');
    }
  }

  /** Direct access to the underlying ioredis client. */
  getClient(): Redis {
    return this.client;
  }

  /** Health probe: throws if Redis isn't responding. */
  async ping(): Promise<void> {
    const result = await this.client.ping();
    if (result !== 'PONG') {
      throw new Error(`Unexpected Redis ping response: ${result}`);
    }
  }
}
