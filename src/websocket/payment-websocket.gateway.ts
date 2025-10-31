/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { Server, Socket } from "socket.io";

interface PaymentUpdatePayload {
  reference: string;
  status: string;
  timestamp: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000",
      "http://localhost:4200",
    ],
    credentials: true,
  },
  namespace: "/payments",
})
export class PaymentWebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PaymentWebsocketGateway.name);
  private readonly clients: Map<string, Socket> = new Map();

  afterInit(server: Server) {
    this.logger.log("WebSocket Gateway initialized");
  }

  handleConnection(client: Socket) {
    // Validar API key en handshake
    const apiKey = client.handshake.headers["x-api-key"] as string;
    const validApiKey = process.env.API_KEY;

    if (!apiKey || apiKey !== validApiKey) {
      this.logger.warn(
        `Unauthorized WebSocket connection attempt: ${client.id}`,
      );
      client.disconnect();
      return;
    }

    this.logger.log(`Client connected: ${client.id}`);
    this.clients.set(client.id, client);

    // El cliente puede enviar su referencia de pago para suscribirse
    client.on("subscribe", async (data: { reference: string }) => {
      // Validar formato de referencia
      if (!data.reference || typeof data.reference !== "string") {
        this.logger.warn(`Invalid reference format from ${client.id}`);
        return;
      }

      this.logger.log(
        `Client ${client.id} subscribed to reference: ${data.reference}`,
      );
      await client.join(`payment:${data.reference}`);
    });

    // El cliente puede desuscribirse de una referencia
    client.on("unsubscribe", async (data: { reference: string }) => {
      this.logger.log(
        `Client ${client.id} unsubscribed from reference: ${data.reference}`,
      );
      await client.leave(`payment:${data.reference}`);
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.clients.delete(client.id);
  }

  /**
   * Notifica a los clientes sobre la actualización de un pago
   */
  notifyPaymentUpdate(payload: PaymentUpdatePayload) {
    const { reference, status, timestamp } = payload;

    this.logger.log(`Broadcasting payment update: ${reference} -> ${status}`);

    // Emitir a todos los clientes suscritos a esta referencia
    this.server.to(`payment:${reference}`).emit("payment_update", {
      reference,
      status,
      timestamp,
    });

    // También emitir a todos los clientes conectados (broadcast general)
    this.server.emit("payment_status_changed", {
      reference,
      status,
      timestamp,
    });
  }

  /**
   * Obtener el número de clientes conectados
   */
  getConnectedClientsCount(): number {
    return this.clients.size;
  }
}
