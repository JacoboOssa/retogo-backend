import { Module } from '@nestjs/common';
import { PaymentWebsocketGateway } from './payment-websocket.gateway';

@Module({
  providers: [PaymentWebsocketGateway],
  exports: [PaymentWebsocketGateway],
})
export class WebsocketModule {}
