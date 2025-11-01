import {
  IsString,
  IsNumber,
  IsObject,
  IsArray,
  ValidateNested,
  IsNotEmpty,
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

class DataDto {
  @ValidateNested()
  @Type(() => TransactionDto)
  transaction: TransactionDto;
}

class SignatureDto {
  @IsString()
  @IsNotEmpty()
  checksum: string;

  @IsArray()
  @IsString({ each: true })
  properties: string[];
}

export class WompiWebhookDto {
  @IsString()
  @IsNotEmpty()
  event: string;

  @ValidateNested()
  @Type(() => DataDto)
  @IsObject()
  data: DataDto;

  @IsString()
  @IsNotEmpty()
  environment: string;

  @ValidateNested()
  @Type(() => SignatureDto)
  @IsObject()
  signature: SignatureDto;

  @IsNumber()
  timestamp: number;

  @IsString()
  @IsNotEmpty()
  sent_at: string;
}
