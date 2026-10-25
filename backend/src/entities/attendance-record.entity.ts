import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { SchoolClass } from './school-class.entity';
import { Student } from './student.entity';
import { User } from './user.entity';

export const ATTENDANCE_STATUSES = ['present', 'absent', 'late'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

@Entity('attendance_records')
@Unique(['studentId', 'date'])
@Index(['classId', 'date'])
export class AttendanceRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'student_id', type: 'int' })
  studentId: number;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  // Class at the time of marking, so history stays correct if a student is promoted.
  @Column({ name: 'class_id', type: 'int' })
  classId: number;

  @ManyToOne(() => SchoolClass, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'class_id' })
  schoolClass: SchoolClass;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 10 })
  status: AttendanceStatus;

  @Column({ name: 'check_in_time', type: 'time', nullable: true })
  checkInTime: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remarks: string | null;

  @Column({ name: 'marked_by_id', type: 'int', nullable: true })
  markedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'marked_by_id' })
  markedBy: User | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
