/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { PaymentsService } from '../payments/payments.service';
import { WompiWebhookDto } from './dto/wompi-webhook.dto';

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
  private validateSignature(webhookData: WompiWebhookDto): boolean {
    try {
      const eventsSecret = this.configService.get<string>(
        'WOMPI_EVENTS_SECRET',
      );
      const { transaction } = webhookData.data;
      const { timestamp, signature } = webhookData;

      const data = `${transaction.id}${transaction.status}${transaction.amount_in_cents}${timestamp}${eventsSecret}`;
      const calculatedChecksum = createHash('sha256')
        .update(data)
        .digest('hex');

      const isValid = calculatedChecksum === signature.checksum;

      if (!isValid) {
        this.logger.warn('Invalid webhook signature');
      }

      return isValid;
    } catch (error) {
      this.logger.error('Error validating webhook signature', error);
      return false;
    }
  }

  /**
   * Procesa el webhook de Wompi
   */
  async processWebhook(
    webhookData: WompiWebhookDto,
  ): Promise<{ success: boolean; status?: string }> {
    try {
      // Validar la firma
      if (!this.validateSignature(webhookData)) {
        throw new BadRequestException('Invalid webhook signature');
      }

      // Solo procesar eventos de actualización soportados
      const supportedEvents = [
        'transaction.updated',
        'nequi_token.updated',
        'bancolombia_transfer_token.updated',
      ];

      if (!supportedEvents.includes(webhookData.event)) {
        this.logger.log(
          `Ignoring unsupported event type: ${webhookData.event}`,
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
        this.logger.warn(`Payment not found for reference: ${reference}`);
        throw new BadRequestException('Payment not found');
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
        `Payment updated successfully: ${reference} -> ${status} (event: ${webhookData.event})`,
      );

      return {
        success: true,
        status,
      };
    } catch (error) {
      this.logger.error('Error processing webhook', error);
      throw error;
    }
  }
}
