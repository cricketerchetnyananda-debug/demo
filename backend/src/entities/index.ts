import { AbsenceCorrection } from './absence-correction.entity';
import { AttendanceRecord } from './attendance-record.entity';
import { SchoolClass } from './school-class.entity';
import { Student } from './student.entity';
import { User } from './user.entity';

export * from './absence-correction.entity';
export * from './attendance-record.entity';
export * from './school-class.entity';
export * from './student.entity';
export * from './user.entity';

export const ENTITIES = [User, SchoolClass, Student, AttendanceRecord, AbsenceCorrection];
