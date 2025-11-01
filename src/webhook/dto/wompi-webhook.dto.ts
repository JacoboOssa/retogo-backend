// DTO flexible para webhooks de Wompi
// No valida campos estrictos, solo define la estructura esperada
export class WompiWebhookDto {
  event: string;

  data: {
    transaction: {
      id: string;
      status: string;
      amount_in_cents: number;
      reference: string;
      payment_method_type?: string;
      customer_email?: string;
      currency?: string;
      redirect_url?: string;
      shipping_address?: any;
      payment_link_id?: any;
      payment_source_id?: any;
      [key: string]: any; // Permite cualquier campo adicional
    };
  };

  environment?: string;

  signature: {
    checksum: string;
    properties?: string[];
  };

  timestamp: number;
  sent_at?: string;
}
