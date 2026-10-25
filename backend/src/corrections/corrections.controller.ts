import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, JwtPayload, Roles } from '../auth/auth.decorators';
import { CreateCorrectionDto, ListCorrectionsQueryDto, ReviewCorrectionDto } from './corrections.dto';
import { CorrectionsService } from './corrections.service';

@Controller('corrections')
export class CorrectionsController {
  constructor(private readonly corrections: CorrectionsService) {}

  @Post()
  create(@Body() dto: CreateCorrectionDto, @CurrentUser() user: JwtPayload) {
    return this.corrections.create(user, dto);
  }

  @Get()
  list(@Query() query: ListCorrectionsQueryDto, @CurrentUser() user: JwtPayload) {
    return this.corrections.list(user, query);
  }

  @Patch(':id/review')
  @Roles('admin')
  review(@Param('id', ParseIntPipe) id: number, @Body() dto: ReviewCorrectionDto, @CurrentUser() user: JwtPayload) {
    return this.corrections.review(user, id, dto);
  }
}
