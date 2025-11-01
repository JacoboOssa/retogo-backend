import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger, ValidationPipe } from "@nestjs/common";
import helmet from "helmet";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule);

  // Configurar Helmet para headers de seguridad
  app.use(helmet());

  // Configurar CORS
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
    "https://night-dare-go-five.vercel.app",
    "http://localhost:3000",
    "http://localhost:4200",
    "http://localhost:8080",
  ];

  logger.log(`🔒 CORS enabled for origins: ${allowedOrigins.join(", ")}`);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Permitir requests sin origin (como webhooks de Wompi, Postman, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`🚫 CORS blocked origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  });

  // Validación global de DTOs (pero respetando el decorador @SkipValidation)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      // Permitir saltar validación para endpoints específicos
      skipMissingProperties: false,
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port, "0.0.0.0");
  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(
    `🔌 WebSocket server is running on: ws://localhost:${port}/payments`,
  );
}

void bootstrap();
