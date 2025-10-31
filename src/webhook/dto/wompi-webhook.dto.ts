export class WompiWebhookDto {
  event: string;
  data: {
    transaction: {
      id: string;
      amount_in_cents: number;
      reference: string;
      customer_email: string;
      currency: string;
      payment_method_type: string;
      redirect_url: string;
      status: string;
      shipping_address: any;
      payment_link_id: string;
      payment_source_id: any;
    };
  };
  environment: string;

  signature: {
    checksum: string;
    properties: string[];
  };
  timestamp: number;
  sent_at: string;
}
