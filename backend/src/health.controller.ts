import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Public } from './auth/auth.decorators';

/** Used by the hosting platform to check the app and database are up. */
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  async check() {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok' };
  }
}
