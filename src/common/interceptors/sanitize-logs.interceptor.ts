/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

@Injectable()
export class SanitizeLogsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SanitizeLogsInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, headers } = request;

    // Sanitizar headers sensibles
    const sanitizedHeaders = this.sanitizeHeaders(headers);

    this.logger.log(
      `Request: ${method} ${url} - Headers: ${JSON.stringify(sanitizedHeaders)}`,
    );

    return next.handle().pipe(
      tap(() => {
        this.logger.log(`Response: ${method} ${url} - Success`);
      }),
    );
  }

  private sanitizeHeaders(headers: any): any {
    const sensitiveHeaders = new Set([
      "authorization",
      "x-api-key",
      "cookie",
      "x-auth-token",
    ]);

    const sanitized = { ...headers };
    for (const key of Object.keys(sanitized)) {
      if (sensitiveHeaders.has(key.toLowerCase())) {
        sanitized[key] = "[REDACTED]";
      }
    }
    return sanitized;
  }

  private sanitizeObject(obj: any): any {
    if (!obj || typeof obj !== "object") {
      return obj;
    }

    const sensitiveFields = [
      "password",
      "secret",
      "token",
      "apiKey",
      "api_key",
      "creditCard",
      "credit_card",
      "ssn",
    ];

    const sanitized = { ...obj };
    for (const key of Object.keys(sanitized)) {
      if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
        sanitized[key] = "[REDACTED]";
      }
    }
    return sanitized;
  }
}
