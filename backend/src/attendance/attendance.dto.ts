import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DATE_MESSAGE, DATE_PATTERN, TIME_MESSAGE, TIME_PATTERN } from '../common/validation';
import { ATTENDANCE_STATUSES, AttendanceStatus } from '../entities';

export class RegisterQueryDto {
  @Type(() => Number)
  @IsInt()
  classId: number;

  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  date: string;
}

export class AttendanceEntryDto {
  @IsInt()
  studentId: number;

  @IsIn(ATTENDANCE_STATUSES)
  status: AttendanceStatus;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(TIME_PATTERN, { message: TIME_MESSAGE })
  checkInTime?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(255)
  remarks?: string | null;
}

export class SaveRegisterDto {
  @IsInt()
  classId: number;

  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  date: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttendanceEntryDto)
  entries: AttendanceEntryDto[];
}

export class LateCheckInDto {
  @IsInt()
  studentId: number;

  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  date: string;

  @Matches(TIME_PATTERN, { message: TIME_MESSAGE })
  checkInTime: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remarks?: string;
}

export class RangeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  classId?: number;

  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  from: string;

  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  to: string;
}

export class RecordsQueryDto extends RangeQueryDto {
  @IsOptional()
  @IsIn(ATTENDANCE_STATUSES)
  status?: AttendanceStatus;
}

export class SummaryQueryDto {
  @Type(() => Number)
  @IsInt()
  classId: number;

  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  from: string;

  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  to: string;
}

export class OverviewQueryDto {
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  date: string;
}
