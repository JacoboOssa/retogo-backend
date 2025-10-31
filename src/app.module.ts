import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./prisma/prisma.module";
import { PaymentsModule } from "./payments/payments.module";
import { WebhookModule } from "./webhook/webhook.module";
import { WebsocketModule } from "./websocket/websocket.module";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    // Rate limiting: 10 requests por minuto por IP
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 segundos
        limit: 10, // 10 requests
      },
    ]),
    PrismaModule,
    PaymentsModule,
    WebhookModule,
    WebsocketModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
