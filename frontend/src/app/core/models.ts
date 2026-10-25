export type Role = 'admin' | 'teacher';
export type AttendanceStatus = 'present' | 'absent' | 'late';
export type CorrectionState = 'pending' | 'approved' | 'rejected';

export interface User {
  id: number;
  email: string;
  fullName: string;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface ClassRef {
  id: number;
  grade: number;
  section: string;
}

export interface SchoolClass extends ClassRef {
  teacher: { id: number; fullName: string; email: string } | null;
  studentCount: number;
}

export interface Student {
  id: number;
  rollNumber: number;
  fullName: string;
  classId: number;
  active: boolean;
}

export interface RegisterEntry {
  studentId: number;
  rollNumber: number;
  fullName: string;
  recordId: number | null;
  status: AttendanceStatus | null;
  checkInTime: string | null;
  remarks: string | null;
}

export interface ClassRegister {
  classId: number;
  date: string;
  entries: RegisterEntry[];
}

export interface AttendanceRecordView {
  id: number;
  date: string;
  status: AttendanceStatus;
  checkInTime: string | null;
  remarks: string | null;
  student: { id: number; rollNumber: number; fullName: string };
  class: ClassRef;
  pendingCorrection: boolean;
}

export interface StudentSummary {
  studentId: number;
  rollNumber: number;
  fullName: string;
  present: number;
  late: number;
  absent: number;
  markedDays: number;
  percentage: number | null;
}

export interface ClassOverview {
  classId: number;
  grade: number;
  section: string;
  teacherName: string | null;
  total: number;
  present: number;
  late: number;
  absent: number;
  unmarked: number;
}

export interface Correction {
  id: number;
  status: CorrectionState;
  originalStatus: AttendanceStatus;
  requestedStatus: AttendanceStatus;
  requestedCheckInTime: string | null;
  reason: string;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  date: string;
  student: { id: number; rollNumber: number; fullName: string };
  class: ClassRef;
  requestedBy: string;
  reviewedBy: string | null;
}

export function classLabel(c: ClassRef): string {
  return `Grade ${c.grade}-${c.section}`;
}

/** Local date as YYYY-MM-DD. */
export function isoDate(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return isoDate(d);
}

export function currentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/** Turns an API error into a readable message. */
export function errorMessage(err: unknown): string {
  const e = err as { status?: number; error?: { message?: string | string[] } };
  if (e?.status === 0) return 'Cannot reach the server. Is the API running?';
  const message = e?.error?.message;
  if (Array.isArray(message)) return message.join('. ');
  return message || 'Something went wrong. Please try again.';
}
