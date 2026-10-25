import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from './user.entity';

@Entity('classes')
@Unique(['grade', 'section'])
@Check('"grade" BETWEEN 1 AND 10')
export class SchoolClass {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'smallint' })
  grade: number;

  @Column({ type: 'varchar', length: 5, default: 'A' })
  section: string;

  @Column({ name: 'teacher_id', type: 'int', nullable: true })
  teacherId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: User | null;
}
