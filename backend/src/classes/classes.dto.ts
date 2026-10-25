import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class CreateClassDto {
  @IsInt()
  @Min(1)
  @Max(10)
  grade: number;

  @IsString()
  @Matches(/^[A-Z]{1,5}$/, { message: 'Section must be capital letters, e.g. A or B' })
  section: string;
}

export class AssignTeacherDto {
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  teacherId: number | null;
}

export class CreateStudentDto {
  @IsInt()
  @Min(1)
  rollNumber: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName: string;
}

export class UpdateStudentDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  rollNumber?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
