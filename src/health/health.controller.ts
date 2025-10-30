import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  PrismaHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Verificar conexión a la base de datos
      () => this.prismaHealth.pingCheck('database', this.prisma),

      // Verificar que la memoria heap no exceda 150MB
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),

      // Verificar que la memoria RSS no exceda 150MB
      () => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024),

      // Verificar espacio en disco (80% de umbral)
      () =>
        this.disk.checkStorage('storage', {
          path: '/',
          thresholdPercent: 0.8,
        }),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    // Verifica si la aplicación está lista para recibir tráfico
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
    ]);
  }

  @Get('live')
  @HealthCheck()
  live() {
    // Verifica si la aplicación está viva (sin verificaciones de dependencias)
    return {
      status: 'ok',
      info: {
        application: {
          status: 'up',
        },
      },
      error: {},
      details: {
        application: {
          status: 'up',
        },
      },
    };
  }
}
