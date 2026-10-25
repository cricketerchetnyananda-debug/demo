import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'fs';
import { join } from 'path';
import { types } from 'pg';
import { AppModule } from './app.module';

// Return DATE columns as plain 'YYYY-MM-DD' strings instead of JS Dates (avoids timezone shifts).
types.setTypeParser(1082, (value: string) => value);

// Built Angular app; when present the API also serves the web pages from the same address.
const WEB_DIR = join(__dirname, '..', '..', 'frontend', 'dist', 'school-attendance-web', 'browser');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableCors({ origin: (process.env.CORS_ORIGIN ?? 'http://localhost:4200').split(',') });

  if (existsSync(WEB_DIR)) {
    app.useStaticAssets(WEB_DIR, { index: false });
    // Single-page app: any non-API page request gets index.html and Angular's router takes over.
    app.use((req: { method: string; path: string }, res: { sendFile(path: string): void }, next: () => void) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) return res.sendFile(join(WEB_DIR, 'index.html'));
      next();
    });
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`School Attendance listening on http://localhost:${port}`);
}
bootstrap();
