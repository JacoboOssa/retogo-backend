export class PaymentResponseDto {
  reference: string;
  signature: string;
  amount: number;
  currency: string;
  publicKey: string;
}
