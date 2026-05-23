import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Marked @Global so PrismaService is available everywhere without re-import.
 * Acceptable here because PrismaService is a thin singleton wrapper.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
