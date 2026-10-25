import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceController } from './attendance/attendance.controller';
import { AttendanceService } from './attendance/attendance.service';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { ClassesController } from './classes/classes.controller';
import { ClassAccessService } from './common/class-access.service';
import { SeedService } from './common/seed.service';
import { CorrectionsController } from './corrections/corrections.controller';
import { CorrectionsService } from './corrections/corrections.service';
import { ENTITIES } from './entities';
import { HealthController } from './health.controller';
import { UsersController } from './users/users.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Hosting platforms provide one DATABASE_URL; local development uses the separate DB_* settings.
        const url = config.get<string>('DATABASE_URL');
        const connection = url
          ? { url }
          : {
              host: config.get('DB_HOST', 'localhost'),
              port: Number(config.get('DB_PORT', 5432)),
              username: config.getOrThrow<string>('DB_USER'),
              password: config.getOrThrow<string>('DB_PASSWORD'),
              database: config.getOrThrow<string>('DB_NAME'),
            };
        return {
          type: 'postgres' as const,
          ...connection,
          ssl: config.get('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
          entities: ENTITIES,
          synchronize: config.get('DB_SYNC', 'true') === 'true',
        };
      },
    }),
    TypeOrmModule.forFeature(ENTITIES),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: Number(config.get('JWT_EXPIRES_IN_SECONDS', 28800)) },
      }),
    }),
  ],
  controllers: [HealthController, AuthController, UsersController, ClassesController, AttendanceController, CorrectionsController],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    AuthService,
    ClassAccessService,
    AttendanceService,
    CorrectionsService,
    SeedService,
  ],
})
export class AppModule {}
