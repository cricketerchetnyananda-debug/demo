import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { CurrentUser, JwtPayload } from '../auth/auth.decorators';
import {
  LateCheckInDto,
  OverviewQueryDto,
  RecordsQueryDto,
  RegisterQueryDto,
  SaveRegisterDto,
  SummaryQueryDto,
} from './attendance.dto';
import { AttendanceService } from './attendance.service';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('register')
  getRegister(@Query() query: RegisterQueryDto, @CurrentUser() user: JwtPayload) {
    return this.attendance.getRegister(user, query.classId, query.date);
  }

  @Put('register')
  saveRegister(@Body() dto: SaveRegisterDto, @CurrentUser() user: JwtPayload) {
    return this.attendance.saveRegister(user, dto);
  }

  @Post('late-checkin')
  lateCheckIn(@Body() dto: LateCheckInDto, @CurrentUser() user: JwtPayload) {
    return this.attendance.lateCheckIn(user, dto);
  }

  @Get('records')
  records(@Query() query: RecordsQueryDto, @CurrentUser() user: JwtPayload) {
    return this.attendance.listRecords(user, query);
  }

  @Get('summary')
  summary(@Query() query: SummaryQueryDto, @CurrentUser() user: JwtPayload) {
    return this.attendance.summary(user, query);
  }

  @Get('overview')
  overview(@Query() query: OverviewQueryDto, @CurrentUser() user: JwtPayload) {
    return this.attendance.overview(user, query);
  }
}
