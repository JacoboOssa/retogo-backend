/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Post,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
  Req,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { WebhookService } from "./webhook.service";
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
  async handleWebhook(@Req() req: any, @Body() webhookData: any) {
    const reference = webhookData?.data?.transaction?.reference || "UNKNOWN";
    const event = webhookData?.event || "UNKNOWN";

    this.logger.log(
      `Webhook received - Event: ${event}, Reference: ${reference}`,
    );

    try {
      const result = await this.webhookService.processWebhook(webhookData);

      // Si el estado es APPROVED o DECLINED, enviar notificación por WebSocket
      if (result.status && ["APPROVED", "DECLINED"].includes(result.status)) {
        const { reference, status } = webhookData.data.transaction;

        this.websocketGateway.notifyPaymentUpdate({
          reference,
          status,
          timestamp: new Date().toISOString(),
        });
      }

      return result;
    } catch (error) {
      // CRÍTICO: Aunque falle el procesamiento, SIEMPRE devolvemos 200
      this.logger.error(
        `Webhook processing error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        note: "Webhook received but processing failed",
      };
    }
  }
}
