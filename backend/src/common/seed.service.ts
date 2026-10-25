import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchoolClass } from '../entities';

/** Makes sure Grade 1 to Grade 10 (section A) exist so the school can start immediately. */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(@InjectRepository(SchoolClass) private readonly classes: Repository<SchoolClass>) {}

  async onApplicationBootstrap() {
    if ((await this.classes.count()) > 0) return;
    const grades = Array.from({ length: 10 }, (_, i) => this.classes.create({ grade: i + 1, section: 'A' }));
    await this.classes.save(grades);
    this.logger.log('Created classes Grade 1-A to Grade 10-A');
  }
}
