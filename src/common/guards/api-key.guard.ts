import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers["x-api-key"];

    const validApiKey = this.configService.get<string>("API_KEY");

    if (!apiKey || apiKey !== validApiKey) {
      throw new UnauthorizedException("Invalid or missing API key");
    }

    return true;
  }
}
