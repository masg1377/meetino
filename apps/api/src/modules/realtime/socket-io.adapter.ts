import type { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';
import type { AppConfig } from '../../config/configuration';

/**
 * Custom Socket.IO adapter that wires CORS from our config (WEB_ORIGIN)
 * at server-creation time. The default IoAdapter ignores the gateway's
 * decorator CORS in some cases, so we set it here once for all gateways.
 */
export class MeetinoIoAdapter extends IoAdapter {
  private readonly webOrigin: string;

  constructor(app: INestApplicationContext) {
    super(app);
    const config = app.get(ConfigService<AppConfig, true>);
    this.webOrigin = config.get('cors', { infer: true }).webOrigin;
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    const merged: Partial<ServerOptions> = {
      ...options,
      cors: {
        origin: this.webOrigin,
        credentials: true,
        methods: ['GET', 'POST'],
      },
      // Conservative defaults — Iran latency can be high, so we lean long.
      pingInterval: 20_000,
      pingTimeout: 25_000,
      // Disable per-message-deflate to avoid CPU spikes; meetings are small JSON.
      perMessageDeflate: false,
    };
    return super.createIOServer(port, merged as ServerOptions);
  }
}
