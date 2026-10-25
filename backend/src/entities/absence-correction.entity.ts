import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AttendanceRecord, AttendanceStatus } from './attendance-record.entity';
import { User } from './user.entity';

export type CorrectionState = 'pending' | 'approved' | 'rejected';

@Entity('absence_corrections')
export class AbsenceCorrection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'attendance_record_id', type: 'int' })
  attendanceRecordId: number;

  @ManyToOne(() => AttendanceRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attendance_record_id' })
  record: AttendanceRecord;

  @Column({ name: 'original_status', type: 'varchar', length: 10 })
  originalStatus: AttendanceStatus;

  @Column({ name: 'requested_status', type: 'varchar', length: 10 })
  requestedStatus: AttendanceStatus;

  @Column({ name: 'requested_check_in_time', type: 'time', nullable: true })
  requestedCheckInTime: string | null;

  @Column({ type: 'varchar', length: 500 })
  reason: string;

  @Column({ type: 'varchar', length: 10, default: 'pending' })
  status: CorrectionState;

  @Column({ name: 'requested_by_id', type: 'int' })
  requestedById: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requested_by_id' })
  requestedBy: User;

  @Column({ name: 'reviewed_by_id', type: 'int', nullable: true })
  reviewedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by_id' })
  reviewedBy: User | null;

  @Column({ name: 'review_note', type: 'varchar', length: 500, nullable: true })
  reviewNote: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;
}
