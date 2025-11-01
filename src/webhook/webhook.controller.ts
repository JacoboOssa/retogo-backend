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
    // IMPORTANTE: Siempre logueamos la recepción del webhook
    this.logger.log("=================================================");
    this.logger.log("🔔 WEBHOOK RECEIVED FROM WOMPI");
    this.logger.log(`Event: ${webhookData?.event || "UNKNOWN"}`);
    this.logger.log(`Timestamp: ${new Date().toISOString()}`);
    this.logger.log(`Data: ${JSON.stringify(webhookData)}`);
    this.logger.log("=================================================");

    try {
      const result = await this.webhookService.processWebhook(webhookData);

      // Si el estado es APPROVED o DECLINED, enviar notificación por WebSocket
      if (result.status && ["APPROVED", "DECLINED"].includes(result.status)) {
        const { reference, status } = webhookData.data.transaction;

        this.logger.log(
          `✅ Emitting payment update via WebSocket: ${reference} -> ${status}`,
        );
        this.websocketGateway.notifyPaymentUpdate({
          reference,
          status,
          timestamp: new Date().toISOString(),
        });
      }

      this.logger.log(`✅ Webhook processed successfully`);
      return result;
    } catch (error) {
      // CRÍTICO: Aunque falle el procesamiento, SIEMPRE devolvemos 200
      // para que Wompi no reintente. Registramos el error internamente.
      this.logger.error("❌ Error processing webhook (returning 200 anyway):");
      this.logger.error(error);

      // Wompi recibe 200 OK pero sabemos que hubo un error
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        note: "Webhook received but processing failed",
      };
    }
  }
}
