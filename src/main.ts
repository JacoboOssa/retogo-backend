import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger } from "@nestjs/common";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule);

  // Configurar CORS
  app.enableCors({
    //TODO: ajustar en producción
    origin: "*", // Configurar según tus necesidades de seguridad
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(
    `🔌 WebSocket server is running on: ws://localhost:${port}/payments`,
  );
}
bootstrap();
