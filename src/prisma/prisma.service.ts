import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await this.$connect();
      this.logger.log("✅ Connected to database successfully");
    } catch (error) {
      this.logger.error("❌ Failed to connect to database:", error);
      this.logger.warn("⚠️ Database connection will be retried on first query");
      // No lanzamos el error para permitir que la aplicación inicie
      // La conexión se intentará en la primera query
    }
  }

  async onModuleDestroy() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await this.$disconnect();
  }
}
