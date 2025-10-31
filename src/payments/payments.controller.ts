import { Controller, Post, Body, Logger, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { PaymentsService } from "./payments.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { PaymentResponseDto } from "./dto/payment-response.dto";
import { ApiKeyGuard } from "../common/guards/api-key.guard";

@Controller("payments")
@UseGuards(ApiKeyGuard)
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("process")
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests por minuto
  async processPayment(
    @Body() createPaymentDto: CreatePaymentDto,
  ): Promise<PaymentResponseDto> {
    this.logger.log(`Processing payment`);
    return this.paymentsService.processPayment(createPaymentDto);
  }
}
