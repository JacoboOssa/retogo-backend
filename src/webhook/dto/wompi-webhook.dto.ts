import {
  IsString,
  IsNotEmpty,
  IsNumber,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class TransactionDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsNumber()
  amount_in_cents: number;

  @IsString()
  @IsNotEmpty()
  reference: string;

  @IsString()
  customer_email: string;

  @IsString()
  currency: string;

  @IsString()
  payment_method_type: string;

  @IsString()
  redirect_url: string;

  @IsString()
  @IsNotEmpty()
  status: string;

  shipping_address: any;

  @IsString()
  payment_link_id: string;

  payment_source_id: any;
}

class SignatureDto {
  @IsString()
  @IsNotEmpty()
  checksum: string;

  properties: string[];
}

class WebhookDataDto {
  @ValidateNested()
  @Type(() => TransactionDto)
  transaction: TransactionDto;
}

export class WompiWebhookDto {
  @IsString()
  @IsNotEmpty()
  event: string;

  @ValidateNested()
  @Type(() => WebhookDataDto)
  data: WebhookDataDto;

  @IsString()
  environment: string;

  @ValidateNested()
  @Type(() => SignatureDto)
  signature: SignatureDto;

  @IsNumber()
  timestamp: number;

  @IsString()
  sent_at: string;
}
