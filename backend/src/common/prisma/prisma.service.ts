import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private connected = false;

  async onModuleInit() {
    try {
      await this.$connect();
      this.connected = true;
      this.logger.log('Database connected');
    } catch (error) {
      this.connected = false;
      this.logger.warn(
        `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      this.logger.warn('Server will start without database connection');
    }
  }

  async onModuleDestroy() {
    if (this.connected) {
      await this.$disconnect();
      this.logger.log('Database disconnected');
    }
  }

  async isConnected(): Promise<boolean> {
    if (!this.connected) return false;
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      this.connected = false;
      return false;
    }
  }
}
