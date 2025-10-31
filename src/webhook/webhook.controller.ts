import {
  Controller,
  Post,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { WebhookService } from "./webhook.service";
import { WompiWebhookDto } from "./dto/wompi-webhook.dto";
import { PaymentWebsocketGateway } from "../websocket/payment-websocket.gateway";

@Controller("payments")
@SkipThrottle() // Wompi necesita enviar múltiples webhooks sin limitación
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly webhookService: WebhookService,
    private readonly websocketGateway: PaymentWebsocketGateway,
  ) {}

  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() webhookData: WompiWebhookDto) {
    this.logger.log(`Received webhook event: ${webhookData.event}`);

    const result = await this.webhookService.processWebhook(webhookData);

    // Si el estado es APPROVED o DECLINED, enviar notificación por WebSocket
    if (result.status && ["APPROVED", "DECLINED"].includes(result.status)) {
      const { reference, status } = webhookData.data.transaction;

      this.logger.log(
        `Emitting payment update via WebSocket: ${reference} -> ${status}`,
      );
      this.websocketGateway.notifyPaymentUpdate({
        reference,
        status,
        timestamp: new Date().toISOString(),
      });
    }

    return result;
  }
}
