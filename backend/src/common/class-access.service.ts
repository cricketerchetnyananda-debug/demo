import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayload } from '../auth/auth.decorators';
import { SchoolClass, Student } from '../entities';

/** Decides which classes a user may work with: admins see all, teachers only the classes assigned to them. */
@Injectable()
export class ClassAccessService {
  constructor(
    @InjectRepository(SchoolClass) private readonly classes: Repository<SchoolClass>,
    @InjectRepository(Student) private readonly students: Repository<Student>,
  ) {}

  async assertClass(user: JwtPayload, classId: number): Promise<SchoolClass> {
    const schoolClass = await this.classes.findOneBy({ id: classId });
    if (!schoolClass) throw new NotFoundException('Class not found');
    if (user.role !== 'admin' && schoolClass.teacherId !== user.sub) {
      throw new ForbiddenException('You are not the class teacher of this class');
    }
    return schoolClass;
  }

  async assertStudent(user: JwtPayload, studentId: number): Promise<Student> {
    const student = await this.students.findOneBy({ id: studentId });
    if (!student) throw new NotFoundException('Student not found');
    await this.assertClass(user, student.classId);
    return student;
  }

  /** Class ids the user may see, or null meaning "all classes" (admin). */
  async accessibleClassIds(user: JwtPayload): Promise<number[] | null> {
    if (user.role === 'admin') return null;
    const own = await this.classes.findBy({ teacherId: user.sub });
    return own.map((c) => c.id);
  }
}
