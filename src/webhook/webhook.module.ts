import { Module } from "@nestjs/common";
import { WebhookController } from "./webhook.controller";
import { WebhookService } from "./webhook.service";
import { PaymentsModule } from "../payments/payments.module";
import { WebsocketModule } from "../websocket/websocket.module";

@Module({
  imports: [PaymentsModule, WebsocketModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
