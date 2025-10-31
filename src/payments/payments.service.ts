/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { createHash } from "node:crypto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { PaymentResponseDto } from "./dto/payment-response.dto";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generate a unique payment reference
   * Format: <Timestamp><Random>
   */
  private generateReference(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 10).toUpperCase();
    return `${timestamp}-${random}`;
  }

  /**
   * Generate SHA256 hash for integrity signature
   * Format: <Reference><Amount><Currency><IntegritySecret>
   */
  private generateIntegritySignature(
    reference: string,
    amount: number,
    currency: string,
  ): string {
    const integritySecret = this.configService.get<string>(
      "WOMPI_INTEGRITY_SECRET",
    );
    const concatenated = `${reference}${amount}${currency}${integritySecret}`;
    return createHash("sha256").update(concatenated).digest("hex");
  }

  /**
   * Creates a payment reference and signature for Wompi integration
   */
  async processPayment(
    createPaymentDto: CreatePaymentDto,
  ): Promise<PaymentResponseDto> {
    try {
      const { deviceId } = createPaymentDto;

      // Validate deviceId
      if (!deviceId) {
        throw new BadRequestException("deviceId is required");
      }

      // Payment details (fixed amount)
      const AMOUNT_IN_CENTS = 1500000; // $15,000 COP
      const CURRENCY = "COP";

      // Generate unique reference
      const reference = this.generateReference();

      // Generate integrity signature
      const signature = this.generateIntegritySignature(
        reference,
        AMOUNT_IN_CENTS,
        CURRENCY,
      );

      // Create payment record in database (PENDING status)
      await this.prisma.payment.create({
        data: {
          reference,
          status: "PENDING",
          amount: AMOUNT_IN_CENTS,
          deviceId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      this.logger.log(`Payment created: ${reference}, deviceId: ${deviceId}`);

      // Return payment data
      return {
        reference,
        signature,
        amount: AMOUNT_IN_CENTS,
        currency: CURRENCY,
        publicKey: this.configService.get<string>("WOMPI_PUBLIC_KEY") || "",
      };
    } catch (error) {
      this.logger.error("Error in create-wompi-payment:", error);
      throw error;
    }
  }

  /**
   * Obtiene un pago por referencia
   */
  async getPaymentByReference(reference: string) {
    return await this.prisma.payment.findUnique({
      where: { reference },
    });
  }

  /**
   * Actualiza el estado de un pago
   */
  async updatePaymentStatus(
    reference: string,
    status: string,
    wompiTransactionId?: string,
    paymentMethodType?: string,
    additionalData?: Record<string, any>,
  ) {
    return await this.prisma.payment.update({
      where: { reference },
      data: {
        status,
        wompiTransactionId,
        paymentMethodType,
        metadata: additionalData,
        updatedAt: new Date(),
      },
    });
  }
}
