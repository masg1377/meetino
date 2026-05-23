import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MeetingsModule } from './modules/meetings/meetings.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { ChatModule } from './modules/chat/chat.module';
import { LivekitModule } from './modules/livekit/livekit.module';
import { FilesModule } from './modules/files/files.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule,
    // Phase 7.6 — enables @Cron decorators (auto-end empty meetings job).
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    UsersModule,
    AuthModule,
    MeetingsModule,
    RealtimeModule,
    ChatModule,
    LivekitModule,
    // Phase 7.7 — file sharing (depends on Meetings + Realtime).
    FilesModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
