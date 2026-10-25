import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  AttendanceRecordView,
  AttendanceStatus,
  ClassOverview,
  ClassRegister,
  Correction,
  CorrectionState,
  Role,
  SchoolClass,
  Student,
  StudentSummary,
  User,
} from './models';

function params(values: Record<string, string | number | null | undefined>): HttpParams {
  let p = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && value !== '') p = p.set(key, String(value));
  }
  return p;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  // Classes & students
  classes() {
    return this.http.get<SchoolClass[]>('/api/classes');
  }
  createClass(grade: number, section: string) {
    return this.http.post<SchoolClass>('/api/classes', { grade, section });
  }
  assignTeacher(classId: number, teacherId: number | null) {
    return this.http.patch(`/api/classes/${classId}/teacher`, { teacherId });
  }
  students(classId: number) {
    return this.http.get<Student[]>(`/api/classes/${classId}/students`);
  }
  addStudent(classId: number, rollNumber: number, fullName: string) {
    return this.http.post<Student>(`/api/classes/${classId}/students`, { rollNumber, fullName });
  }
  updateStudent(id: number, changes: Partial<Pick<Student, 'rollNumber' | 'fullName' | 'active'>>) {
    return this.http.patch<Student>(`/api/students/${id}`, changes);
  }

  // Users (admin)
  users() {
    return this.http.get<User[]>('/api/users');
  }
  updateRole(userId: number, role: Role) {
    return this.http.patch<User>(`/api/users/${userId}/role`, { role });
  }

  // Attendance
  register(classId: number, date: string) {
    return this.http.get<ClassRegister>('/api/attendance/register', { params: params({ classId, date }) });
  }
  saveRegister(
    classId: number,
    date: string,
    entries: { studentId: number; status: AttendanceStatus; checkInTime: string | null; remarks: string | null }[],
  ) {
    return this.http.put<ClassRegister>('/api/attendance/register', { classId, date, entries });
  }
  lateCheckIn(studentId: number, date: string, checkInTime: string, remarks?: string) {
    return this.http.post('/api/attendance/late-checkin', { studentId, date, checkInTime, remarks: remarks || undefined });
  }
  records(query: { classId?: number | null; from: string; to: string; status?: AttendanceStatus }) {
    return this.http.get<AttendanceRecordView[]>('/api/attendance/records', { params: params(query) });
  }
  summary(classId: number, from: string, to: string) {
    return this.http.get<StudentSummary[]>('/api/attendance/summary', { params: params({ classId, from, to }) });
  }
  overview(date: string) {
    return this.http.get<ClassOverview[]>('/api/attendance/overview', { params: params({ date }) });
  }

  // Absent corrections
  corrections(status?: CorrectionState | '') {
    return this.http.get<Correction[]>('/api/corrections', { params: params({ status }) });
  }
  requestCorrection(body: {
    attendanceRecordId: number;
    requestedStatus: 'present' | 'late';
    requestedCheckInTime?: string;
    reason: string;
  }) {
    return this.http.post<Correction>('/api/corrections', body);
  }
  reviewCorrection(id: number, decision: 'approved' | 'rejected', note?: string) {
    return this.http.patch<Correction>(`/api/corrections/${id}/review`, { decision, note: note || undefined });
  }
}
