import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CurrentUser, JwtPayload, Roles } from '../auth/auth.decorators';
import { ClassAccessService } from '../common/class-access.service';
import { SchoolClass, Student, User } from '../entities';
import { AssignTeacherDto, CreateClassDto, CreateStudentDto, UpdateStudentDto } from './classes.dto';

@Controller()
export class ClassesController {
  constructor(
    @InjectRepository(SchoolClass) private readonly classes: Repository<SchoolClass>,
    @InjectRepository(Student) private readonly students: Repository<Student>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly access: ClassAccessService,
  ) {}

  @Get('classes')
  async list(@CurrentUser() user: JwtPayload) {
    const ids = await this.access.accessibleClassIds(user);
    const classes = await this.classes.find({
      where: ids ? { id: In(ids) } : {},
      relations: { teacher: true },
      order: { grade: 'ASC', section: 'ASC' },
    });
    const counts: { classId: number; count: string }[] = await this.students
      .createQueryBuilder('s')
      .select('s.classId', 'classId')
      .addSelect('COUNT(*)', 'count')
      .where('s.active = true')
      .groupBy('s.classId')
      .getRawMany();
    const countByClass = new Map(counts.map((c) => [Number(c.classId), Number(c.count)]));
    return classes.map((c) => ({
      id: c.id,
      grade: c.grade,
      section: c.section,
      teacher: c.teacher ? { id: c.teacher.id, fullName: c.teacher.fullName, email: c.teacher.email } : null,
      studentCount: countByClass.get(c.id) ?? 0,
    }));
  }

  @Post('classes')
  @Roles('admin')
  async create(@Body() dto: CreateClassDto) {
    if (await this.classes.existsBy({ grade: dto.grade, section: dto.section })) {
      throw new ConflictException(`Grade ${dto.grade}-${dto.section} already exists`);
    }
    return this.classes.save(this.classes.create(dto));
  }

  @Patch('classes/:id/teacher')
  @Roles('admin')
  async assignTeacher(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignTeacherDto) {
    const schoolClass = await this.classes.findOneBy({ id });
    if (!schoolClass) throw new NotFoundException('Class not found');
    if (dto.teacherId !== null && !(await this.users.existsBy({ id: dto.teacherId }))) {
      throw new BadRequestException('Teacher not found');
    }
    schoolClass.teacherId = dto.teacherId;
    await this.classes.save(schoolClass);
    return { id: schoolClass.id, teacherId: schoolClass.teacherId };
  }

  @Get('classes/:id/students')
  async listStudents(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    await this.access.assertClass(user, id);
    return this.students.find({ where: { classId: id }, order: { rollNumber: 'ASC' } });
  }

  @Post('classes/:id/students')
  async addStudent(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateStudentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.access.assertClass(user, id);
    await this.assertRollNumberFree(id, dto.rollNumber);
    return this.students.save(this.students.create({ ...dto, fullName: dto.fullName.trim(), classId: id }));
  }

  @Patch('students/:id')
  async updateStudent(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStudentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const student = await this.access.assertStudent(user, id);
    if (dto.rollNumber !== undefined && dto.rollNumber !== student.rollNumber) {
      await this.assertRollNumberFree(student.classId, dto.rollNumber);
    }
    Object.assign(student, dto);
    if (dto.fullName) student.fullName = dto.fullName.trim();
    return this.students.save(student);
  }

  private async assertRollNumberFree(classId: number, rollNumber: number) {
    if (await this.students.existsBy({ classId, rollNumber })) {
      throw new ConflictException(`Roll number ${rollNumber} is already used in this class`);
    }
  }
}
