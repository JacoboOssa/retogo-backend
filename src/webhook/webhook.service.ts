import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import { PaymentsService } from "../payments/payments.service";

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * Valida la firma del webhook de Wompi
   * Concatena: transaction.id + transaction.status + transaction.amount_in_cents + timestamp + WOMPI_EVENTS_SECRET
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private validateSignature(webhookData: any): boolean {
    try {
      const eventsSecret = this.configService.get<string>(
        "WOMPI_EVENTS_SECRET",
      );
      const { transaction } = webhookData.data;
      const { timestamp, signature } = webhookData;

      // Validar que el timestamp no sea muy antiguo (máximo 5 minutos)
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const webhookTimestamp = Math.floor(timestamp / 1000);
      const timeDifference = currentTimestamp - webhookTimestamp;

      if (timeDifference > 300 || timeDifference < -300) {
        this.logger.warn(
          `Webhook timestamp too old or in future: ${timeDifference}s`,
        );
        return false;
      }

      const data = `${transaction.id}${transaction.status}${transaction.amount_in_cents}${timestamp}${eventsSecret}`;
      const calculatedChecksum = createHash("sha256")
        .update(data)
        .digest("hex");

      const isValid = calculatedChecksum === signature.checksum;

      if (!isValid) {
        this.logger.warn("Invalid webhook signature");
      }

      return isValid;
    } catch (error) {
      this.logger.error("Error validating webhook signature", error);
      return false;
    }
  }

  /**
   * Procesa el webhook de Wompi
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async processWebhook(
    webhookData: any,
  ): Promise<{ success: boolean; status?: string }> {
    try {
      // Validar la firma
      const isValidSignature = this.validateSignature(webhookData);
      if (!isValidSignature) {
        this.logger.error("❌ Invalid webhook signature - continuing anyway");
        // NO lanzamos excepción, solo registramos el error
      }

      // Solo procesar eventos de actualización soportados
      const supportedEvents = [
        "transaction.updated",
        "nequi_token.updated",
        "bancolombia_transfer_token.updated",
      ];

      if (!supportedEvents.includes(webhookData.event)) {
        this.logger.log(
          `⚠️ Ignoring unsupported event type: ${webhookData.event}`,
        );
        return { success: true };
      }

      const { transaction } = webhookData.data;
      const { reference, status, id, payment_method_type } = transaction;

      this.logger.log(
        `Processing ${webhookData.event} for reference: ${reference}, status: ${status}`,
      );

      // Verificar que el pago existe
      const payment =
        await this.paymentsService.getPaymentByReference(reference);
      if (!payment) {
        this.logger.warn(`⚠️ Payment not found for reference: ${reference}`);
        // NO lanzamos excepción - respondemos 200 pero indicamos que no se procesó
        return { success: false, status: "payment_not_found" };
      }

      // Actualizar el estado del pago
      await this.paymentsService.updatePaymentStatus(
        reference,
        status,
        id,
        payment_method_type,
        webhookData.data,
      );

      this.logger.log(
        `✅ Payment updated successfully: ${reference} -> ${status} (event: ${webhookData.event})`,
      );

      return {
        success: true,
        status,
      };
    } catch (error) {
      this.logger.error("❌ Error processing webhook", error);
      // Relanzamos el error para que el controller lo maneje
      throw error;
    }
  }
}
