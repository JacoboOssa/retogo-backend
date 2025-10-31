import { IsString, IsNotEmpty, Length, Matches } from "class-validator";

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty({ message: "deviceId is required" })
  @Length(1, 255, { message: "deviceId must be between 1 and 255 characters" })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      "deviceId can only contain alphanumeric characters, hyphens and underscores",
  })
  deviceId: string;
}
