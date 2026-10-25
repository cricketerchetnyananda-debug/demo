import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { TIME_MESSAGE, TIME_PATTERN } from '../common/validation';
import { CorrectionState } from '../entities';

export class CreateCorrectionDto {
  @IsInt()
  attendanceRecordId: number;

  @IsIn(['present', 'late'], { message: 'An absence can be corrected to present or late' })
  requestedStatus: 'present' | 'late';

  @ValidateIf((o: CreateCorrectionDto) => o.requestedStatus === 'late')
  @Matches(TIME_PATTERN, { message: 'Check-in time is required when correcting to late (HH:MM)' })
  requestedCheckInTime?: string;

  @IsString()
  @IsNotEmpty({ message: 'Please give a reason for the correction' })
  @MaxLength(500)
  reason: string;
}

export class ReviewCorrectionDto {
  @IsIn(['approved', 'rejected'])
  decision: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ListCorrectionsQueryDto {
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  status?: CorrectionState;
}
