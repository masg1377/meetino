import { Controller, Get, HttpCode, HttpStatus, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { HealthLiveResponse, HealthReadyResponse } from '@meetino/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Liveness — answers "is the process up?". No I/O, always fast.
   */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  live(): HealthLiveResponse {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness — answers "can this instance serve real traffic?".
   * Pings Postgres and Redis. Returns 503 if either is unreachable so that
   * orchestrators stop sending traffic to this pod/container.
   */
  @Get('ready')
  async ready(): Promise<HealthReadyResponse> {
    const checks: HealthReadyResponse['checks'] = {
      database: 'ok',
      redis: 'ok',
    };

    try {
      await this.prisma.ping();
    } catch (err) {
      this.logger.error(`DB readiness check failed: ${(err as Error).message}`);
      checks.database = 'down';
    }

    try {
      await this.redis.ping();
    } catch (err) {
      this.logger.error(`Redis readiness check failed: ${(err as Error).message}`);
      checks.redis = 'down';
    }

    const isHealthy = checks.database === 'ok' && checks.redis === 'ok';
    const response: HealthReadyResponse = {
      status: isHealthy ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    };

    if (!isHealthy) {
      throw new ServiceUnavailableException(response);
    }
    return response;
  }
}
