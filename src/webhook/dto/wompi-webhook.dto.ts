import { IsString, IsNumber, IsNotEmpty } from "class-validator";

// DTO minimalista: solo valida lo esencial para el checksum
// y deja todo lo demás flexible para evitar rechazos innecesarios
export class WompiWebhookDto {
  @IsString()
  @IsNotEmpty()
  event: string;

  // Solo validamos que exista la estructura mínima necesaria
  data: {
    transaction: {
      id: string; // Necesario para checksum
      status: string; // Necesario para checksum
      amount_in_cents: number; // Necesario para checksum
      reference: string; // Necesario para nuestro negocio
      payment_method_type?: string;
      customer_email?: string;
      currency?: string;
      redirect_url?: string;
      [key: string]: any; // Permite cualquier otro campo
    };
  };

  environment?: string;

  signature: {
    checksum: string; // Necesario para validación
    properties?: string[];
  };

  @IsNumber()
  timestamp: number; // Necesario para checksum

  sent_at?: string;
}
