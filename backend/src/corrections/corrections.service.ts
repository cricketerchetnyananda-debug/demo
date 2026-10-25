import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtPayload } from '../auth/auth.decorators';
import { ClassAccessService } from '../common/class-access.service';
import { AbsenceCorrection, AttendanceRecord } from '../entities';
import { CreateCorrectionDto, ListCorrectionsQueryDto, ReviewCorrectionDto } from './corrections.dto';

/**
 * Absent correction workflow: a teacher asks to change a wrongly marked absence to present/late,
 * and an admin approves (the attendance record is updated) or rejects it.
 */
@Injectable()
export class CorrectionsService {
  constructor(
    @InjectRepository(AbsenceCorrection) private readonly corrections: Repository<AbsenceCorrection>,
    @InjectRepository(AttendanceRecord) private readonly records: Repository<AttendanceRecord>,
    private readonly access: ClassAccessService,
    private readonly dataSource: DataSource,
  ) {}

  async create(user: JwtPayload, dto: CreateCorrectionDto) {
    const record = await this.records.findOneBy({ id: dto.attendanceRecordId });
    if (!record) throw new NotFoundException('Attendance record not found');
    await this.access.assertClass(user, record.classId);
    if (record.status !== 'absent') throw new BadRequestException('Only absences can be corrected');
    if (await this.corrections.existsBy({ attendanceRecordId: record.id, status: 'pending' })) {
      throw new ConflictException('A correction request for this absence is already pending');
    }

    const saved = await this.corrections.save(
      this.corrections.create({
        attendanceRecordId: record.id,
        originalStatus: record.status,
        requestedStatus: dto.requestedStatus,
        requestedCheckInTime: dto.requestedStatus === 'late' ? dto.requestedCheckInTime : null,
        reason: dto.reason.trim(),
        requestedById: user.sub,
      }),
    );
    return this.findOne(saved.id);
  }

  async list(user: JwtPayload, query: ListCorrectionsQueryDto) {
    const qb = this.baseQuery().orderBy('k.createdAt', 'DESC');
    if (query.status) qb.andWhere('k.status = :status', { status: query.status });
    const ids = await this.access.accessibleClassIds(user);
    if (ids) {
      if (ids.length === 0) return [];
      qb.andWhere('(r.classId IN (:...ids) OR k.requestedById = :me)', { ids, me: user.sub });
    }
    return (await qb.getMany()).map(toView);
  }

  async review(user: JwtPayload, id: number, dto: ReviewCorrectionDto) {
    await this.dataSource.transaction(async (manager) => {
      const correction = await manager.findOne(AbsenceCorrection, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!correction) throw new NotFoundException('Correction request not found');
      if (correction.status !== 'pending') throw new BadRequestException('This request has already been reviewed');

      correction.status = dto.decision;
      correction.reviewedById = user.sub;
      correction.reviewNote = dto.note?.trim() || null;
      correction.reviewedAt = new Date();
      await manager.save(correction);

      if (dto.decision === 'approved') {
        await manager.update(AttendanceRecord, correction.attendanceRecordId, {
          status: correction.requestedStatus,
          checkInTime: correction.requestedCheckInTime,
          remarks: `Corrected from absent: ${correction.reason}`.slice(0, 255),
          markedById: user.sub,
        });
      }
    });
    return this.findOne(id);
  }

  private async findOne(id: number) {
    const correction = await this.baseQuery().where('k.id = :id', { id }).getOneOrFail();
    return toView(correction);
  }

  private baseQuery() {
    return this.corrections
      .createQueryBuilder('k')
      .innerJoinAndSelect('k.record', 'r')
      .innerJoinAndSelect('r.student', 's')
      .innerJoinAndSelect('r.schoolClass', 'c')
      .innerJoinAndSelect('k.requestedBy', 'rq')
      .leftJoinAndSelect('k.reviewedBy', 'rv');
  }
}

function toView(k: AbsenceCorrection) {
  return {
    id: k.id,
    status: k.status,
    originalStatus: k.originalStatus,
    requestedStatus: k.requestedStatus,
    requestedCheckInTime: k.requestedCheckInTime?.slice(0, 5) ?? null,
    reason: k.reason,
    reviewNote: k.reviewNote,
    createdAt: k.createdAt,
    reviewedAt: k.reviewedAt,
    date: k.record.date,
    student: { id: k.record.student.id, rollNumber: k.record.student.rollNumber, fullName: k.record.student.fullName },
    class: { id: k.record.schoolClass.id, grade: k.record.schoolClass.grade, section: k.record.schoolClass.section },
    requestedBy: k.requestedBy.fullName,
    reviewedBy: k.reviewedBy?.fullName ?? null,
  };
}
