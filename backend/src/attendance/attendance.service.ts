import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JwtPayload } from '../auth/auth.decorators';
import { ClassAccessService } from '../common/class-access.service';
import { assertNotFuture, assertRange } from '../common/dates';
import { AbsenceCorrection, AttendanceRecord, SchoolClass, Student } from '../entities';
import { LateCheckInDto, OverviewQueryDto, RecordsQueryDto, SaveRegisterDto, SummaryQueryDto } from './attendance.dto';

const shortTime = (time: string | null) => (time ? time.slice(0, 5) : null);

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceRecord) private readonly records: Repository<AttendanceRecord>,
    @InjectRepository(Student) private readonly students: Repository<Student>,
    @InjectRepository(SchoolClass) private readonly classes: Repository<SchoolClass>,
    @InjectRepository(AbsenceCorrection) private readonly corrections: Repository<AbsenceCorrection>,
    private readonly access: ClassAccessService,
  ) {}

  /** Class register for one day: every active student with today's mark (status null = not marked yet). */
  async getRegister(user: JwtPayload, classId: number, date: string) {
    await this.access.assertClass(user, classId);
    const students = await this.students.find({ where: { classId, active: true }, order: { rollNumber: 'ASC' } });
    const records = students.length
      ? await this.records.findBy({ date, studentId: In(students.map((s) => s.id)) })
      : [];
    const byStudent = new Map(records.map((r) => [r.studentId, r]));
    return {
      classId,
      date,
      entries: students.map((s) => {
        const record = byStudent.get(s.id);
        return {
          studentId: s.id,
          rollNumber: s.rollNumber,
          fullName: s.fullName,
          recordId: record?.id ?? null,
          status: record?.status ?? null,
          checkInTime: shortTime(record?.checkInTime ?? null),
          remarks: record?.remarks ?? null,
        };
      }),
    };
  }

  /** Attendance tracking: save the whole class register for a day (insert or update). */
  async saveRegister(user: JwtPayload, dto: SaveRegisterDto) {
    await this.access.assertClass(user, dto.classId);
    assertNotFuture(dto.date);

    const ids = dto.entries.map((e) => e.studentId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('A student appears more than once');
    const found = await this.students.countBy({ id: In(ids), classId: dto.classId });
    if (found !== ids.length) throw new BadRequestException('Some students do not belong to this class');

    await this.records.upsert(
      dto.entries.map((e) => ({
        studentId: e.studentId,
        classId: dto.classId,
        date: dto.date,
        status: e.status,
        checkInTime: e.status === 'absent' ? null : (e.checkInTime ?? null),
        remarks: e.remarks?.trim() || null,
        markedById: user.sub,
      })),
      ['studentId', 'date'],
    );
    return this.getRegister(user, dto.classId, dto.date);
  }

  /** Late check-in: record the arrival time for one student and mark them late. */
  async lateCheckIn(user: JwtPayload, dto: LateCheckInDto) {
    const student = await this.access.assertStudent(user, dto.studentId);
    if (!student.active) throw new BadRequestException('This student is no longer active');
    assertNotFuture(dto.date);

    await this.records.upsert(
      {
        studentId: student.id,
        classId: student.classId,
        date: dto.date,
        status: 'late',
        checkInTime: dto.checkInTime,
        remarks: dto.remarks?.trim() || null,
        markedById: user.sub,
      },
      ['studentId', 'date'],
    );
    const record = await this.records.findOneByOrFail({ studentId: student.id, date: dto.date });
    return { ...record, checkInTime: shortTime(record.checkInTime) };
  }

  /** Absent / late tracking: individual records in a date range. */
  async listRecords(user: JwtPayload, query: RecordsQueryDto) {
    assertRange(query.from, query.to);
    const qb = this.records
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.student', 's')
      .innerJoinAndSelect('r.schoolClass', 'c')
      .where('r.date BETWEEN :from AND :to', { from: query.from, to: query.to })
      .orderBy('r.date', 'DESC')
      .addOrderBy('c.grade', 'ASC')
      .addOrderBy('c.section', 'ASC')
      .addOrderBy('s.rollNumber', 'ASC');

    if (query.classId) {
      await this.access.assertClass(user, query.classId);
      qb.andWhere('r.classId = :classId', { classId: query.classId });
    } else {
      const ids = await this.access.accessibleClassIds(user);
      if (ids && ids.length === 0) return [];
      if (ids) qb.andWhere('r.classId IN (:...ids)', { ids });
    }
    if (query.status) qb.andWhere('r.status = :status', { status: query.status });

    const records = await qb.getMany();
    const pending = records.length
      ? await this.corrections.findBy({ status: 'pending', attendanceRecordId: In(records.map((r) => r.id)) })
      : [];
    const pendingIds = new Set(pending.map((p) => p.attendanceRecordId));

    return records.map((r) => ({
      id: r.id,
      date: r.date,
      status: r.status,
      checkInTime: shortTime(r.checkInTime),
      remarks: r.remarks,
      student: { id: r.student.id, rollNumber: r.student.rollNumber, fullName: r.student.fullName },
      class: { id: r.schoolClass.id, grade: r.schoolClass.grade, section: r.schoolClass.section },
      pendingCorrection: pendingIds.has(r.id),
    }));
  }

  /** Per-student totals and attendance percentage for a class over a date range. */
  async summary(user: JwtPayload, query: SummaryQueryDto) {
    await this.access.assertClass(user, query.classId);
    assertRange(query.from, query.to);
    const rows: Record<string, string>[] = await this.students
      .createQueryBuilder('s')
      .leftJoin(AttendanceRecord, 'r', 'r.studentId = s.id AND r.date BETWEEN :from AND :to', {
        from: query.from,
        to: query.to,
      })
      .select('s.id', 'studentId')
      .addSelect('s.rollNumber', 'rollNumber')
      .addSelect('s.fullName', 'fullName')
      .addSelect(`COUNT(r.id) FILTER (WHERE r.status = 'present')`, 'present')
      .addSelect(`COUNT(r.id) FILTER (WHERE r.status = 'late')`, 'late')
      .addSelect(`COUNT(r.id) FILTER (WHERE r.status = 'absent')`, 'absent')
      .where('s.classId = :classId AND s.active = true', { classId: query.classId })
      .groupBy('s.id')
      .orderBy('s.rollNumber', 'ASC')
      .getRawMany();

    return rows.map((row) => {
      const present = Number(row.present);
      const late = Number(row.late);
      const absent = Number(row.absent);
      const marked = present + late + absent;
      return {
        studentId: Number(row.studentId),
        rollNumber: Number(row.rollNumber),
        fullName: row.fullName,
        present,
        late,
        absent,
        markedDays: marked,
        percentage: marked ? Math.round(((present + late) / marked) * 1000) / 10 : null,
      };
    });
  }

  /** Dashboard: per-class counts for one day. */
  async overview(user: JwtPayload, query: OverviewQueryDto) {
    const ids = await this.access.accessibleClassIds(user);
    const classes = await this.classes.find({
      where: ids ? { id: In(ids) } : {},
      relations: { teacher: true },
      order: { grade: 'ASC', section: 'ASC' },
    });
    if (!classes.length) return [];
    const classIds = classes.map((c) => c.id);

    const totals: { classId: string; total: string }[] = await this.students
      .createQueryBuilder('s')
      .select('s.classId', 'classId')
      .addSelect('COUNT(*)', 'total')
      .where('s.active = true AND s.classId IN (:...classIds)', { classIds })
      .groupBy('s.classId')
      .getRawMany();
    const marks: { classId: string; status: string; count: string }[] = await this.records
      .createQueryBuilder('r')
      .select('r.classId', 'classId')
      .addSelect('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('r.date = :date AND r.classId IN (:...classIds)', { date: query.date, classIds })
      .groupBy('r.classId')
      .addGroupBy('r.status')
      .getRawMany();

    return classes.map((c) => {
      const total = Number(totals.find((t) => Number(t.classId) === c.id)?.total ?? 0);
      const count = (status: string) =>
        Number(marks.find((m) => Number(m.classId) === c.id && m.status === status)?.count ?? 0);
      const present = count('present');
      const late = count('late');
      const absent = count('absent');
      return {
        classId: c.id,
        grade: c.grade,
        section: c.section,
        teacherName: c.teacher?.fullName ?? null,
        total,
        present,
        late,
        absent,
        unmarked: Math.max(0, total - present - late - absent),
      };
    });
  }
}
