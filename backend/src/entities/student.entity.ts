import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { SchoolClass } from './school-class.entity';

@Entity('students')
@Unique(['classId', 'rollNumber'])
export class Student {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'roll_number', type: 'int' })
  rollNumber: number;

  @Column({ name: 'full_name', type: 'varchar', length: 120 })
  fullName: string;

  @Column({ name: 'class_id', type: 'int' })
  classId: number;

  @ManyToOne(() => SchoolClass, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'class_id' })
  schoolClass: SchoolClass;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
