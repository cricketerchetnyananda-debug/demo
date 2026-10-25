import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import {
  AttendanceRecordView,
  classLabel,
  currentTime,
  daysAgo,
  errorMessage,
  isoDate,
  SchoolClass,
  StudentSummary,
} from '../core/models';

interface CorrectionDraft {
  requestedStatus: 'present' | 'late';
  requestedCheckInTime: string;
  reason: string;
}

@Component({
  selector: 'app-absences',
  imports: [FormsModule, RouterLink],
  template: `
    <h1>Absent Tracking</h1>
    <p class="subtitle">See who was absent, how often, and request a correction if an absence was marked by mistake.</p>

    <div class="toolbar">
      <div class="field">
        <label for="cls">Class</label>
        <select id="cls" [(ngModel)]="classId" (ngModelChange)="load()">
          <option [ngValue]="null">All my classes</option>
          @for (c of classes(); track c.id) {
            <option [ngValue]="c.id">{{ label(c) }}</option>
          }
        </select>
      </div>
      <div class="field">
        <label for="from">From</label>
        <input id="from" type="date" [(ngModel)]="from" [max]="to" (ngModelChange)="load()" />
      </div>
      <div class="field">
        <label for="to">To</label>
        <input id="to" type="date" [(ngModel)]="to" [min]="from" [max]="today" (ngModelChange)="load()" />
      </div>
    </div>

    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }
    @if (message()) {
      <div class="alert success">{{ message() }} <a routerLink="/corrections">View corrections</a></div>
    }

    <div class="stats">
      <div class="stat absent"><div class="label">Absences in period</div><div class="value">{{ absences().length }}</div></div>
      <div class="stat"><div class="label">Students absent</div><div class="value">{{ distinctStudents() }}</div></div>
      <div class="stat late"><div class="label">Absent 3+ times</div><div class="value">{{ frequent() }}</div></div>
    </div>

    @if (classId !== null) {
      <div class="card">
        <h2>Student attendance summary — {{ selectedLabel() }}</h2>
        @if (!summary().length) {
          <div class="empty">No students in this class.</div>
        } @else {
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Roll</th><th>Student</th><th class="num">Present</th><th class="num">Late</th>
                  <th class="num">Absent</th><th class="num">Days marked</th><th class="num">Attendance %</th>
                </tr>
              </thead>
              <tbody>
                @for (s of summary(); track s.studentId) {
                  <tr>
                    <td>{{ s.rollNumber }}</td>
                    <td>{{ s.fullName }}</td>
                    <td class="num">{{ s.present }}</td>
                    <td class="num">{{ s.late }}</td>
                    <td class="num" [class.low]="s.absent >= 3">{{ s.absent }}</td>
                    <td class="num">{{ s.markedDays }}</td>
                    <td class="num" [class.low]="s.percentage !== null && s.percentage < 75">
                      {{ s.percentage === null ? '—' : s.percentage + '%' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="muted">Attendance below 75% or 3+ absences is highlighted in red. Late counts as attended.</p>
        }
      </div>
    }

    <div class="card">
      <h2>Absence list</h2>
      @if (!absences().length) {
        <div class="empty">No absences in this period. 🎉</div>
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th>Class</th><th>Roll</th><th>Student</th><th>Remarks</th><th>Correction</th></tr>
            </thead>
            <tbody>
              @for (r of absences(); track r.id) {
                <tr>
                  <td>{{ r.date }}</td>
                  <td>{{ label(r.class) }}</td>
                  <td>{{ r.student.rollNumber }}</td>
                  <td>{{ r.student.fullName }}</td>
                  <td>{{ r.remarks ?? '' }}</td>
                  <td>
                    @if (r.pendingCorrection) {
                      <span class="badge pending">Pending review</span>
                    } @else if (editingId() === r.id) {
                      <button class="small secondary" (click)="editingId.set(null)">Cancel</button>
                    } @else {
                      <button class="small secondary" (click)="startCorrection(r)">Request correction</button>
                    }
                  </td>
                </tr>
                @if (editingId() === r.id) {
                  <tr class="correction-row">
                    <td colspan="6">
                      <div class="correction-form">
                        <div class="field">
                          <label>Change absent to</label>
                          <select [(ngModel)]="draft.requestedStatus">
                            <option value="present">Present</option>
                            <option value="late">Late</option>
                          </select>
                        </div>
                        @if (draft.requestedStatus === 'late') {
                          <div class="field">
                            <label>Check-in time</label>
                            <input type="time" [(ngModel)]="draft.requestedCheckInTime" />
                          </div>
                        }
                        <div class="field reason">
                          <label>Reason for correction</label>
                          <input [(ngModel)]="draft.reason" maxlength="500" placeholder="e.g. Student was in the library during roll call" />
                        </div>
                        <button (click)="submitCorrection(r)" [disabled]="!draft.reason.trim() || submitting()">
                          {{ submitting() ? 'Sending…' : 'Submit request' }}
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: `
    .correction-row td { background: #f8f9fc; }
    .correction-form { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
    .correction-form .field { margin-bottom: 0; }
    .correction-form .reason { flex: 1; min-width: 220px; }
  `,
})
export class AbsencesPage implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly today = isoDate();
  protected readonly label = classLabel;
  protected readonly classes = signal<SchoolClass[]>([]);
  protected classId: number | null = null;
  protected from = daysAgo(30);
  protected to = this.today;

  protected readonly absences = signal<AttendanceRecordView[]>([]);
  protected readonly summary = signal<StudentSummary[]>([]);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly editingId = signal<number | null>(null);
  protected readonly submitting = signal(false);
  protected draft: CorrectionDraft = { requestedStatus: 'present', requestedCheckInTime: '', reason: '' };

  protected readonly distinctStudents = computed(() => new Set(this.absences().map((a) => a.student.id)).size);
  protected readonly frequent = computed(() => {
    const counts = new Map<number, number>();
    for (const a of this.absences()) counts.set(a.student.id, (counts.get(a.student.id) ?? 0) + 1);
    return [...counts.values()].filter((n) => n >= 3).length;
  });

  ngOnInit(): void {
    this.api.classes().subscribe({
      next: (classes) => this.classes.set(classes),
      error: (err) => this.error.set(errorMessage(err)),
    });
    this.load();
  }

  selectedLabel(): string {
    const c = this.classes().find((x) => x.id === this.classId);
    return c ? classLabel(c) : '';
  }

  load(): void {
    if (!this.from || !this.to) return;
    this.error.set('');
    this.editingId.set(null);
    this.api.records({ classId: this.classId, from: this.from, to: this.to, status: 'absent' }).subscribe({
      next: (rows) => this.absences.set(rows),
      error: (err) => this.error.set(errorMessage(err)),
    });
    if (this.classId !== null) {
      this.api.summary(this.classId, this.from, this.to).subscribe({
        next: (rows) => this.summary.set(rows),
        error: (err) => this.error.set(errorMessage(err)),
      });
    } else {
      this.summary.set([]);
    }
  }

  startCorrection(record: AttendanceRecordView): void {
    this.message.set('');
    this.draft = { requestedStatus: 'present', requestedCheckInTime: currentTime(), reason: '' };
    this.editingId.set(record.id);
  }

  submitCorrection(record: AttendanceRecordView): void {
    if (this.draft.requestedStatus === 'late' && !this.draft.requestedCheckInTime) {
      this.error.set('Enter the check-in time when correcting to late.');
      return;
    }
    this.submitting.set(true);
    this.error.set('');
    this.api
      .requestCorrection({
        attendanceRecordId: record.id,
        requestedStatus: this.draft.requestedStatus,
        requestedCheckInTime: this.draft.requestedStatus === 'late' ? this.draft.requestedCheckInTime : undefined,
        reason: this.draft.reason.trim(),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.message.set(`Correction requested for ${record.student.fullName} on ${record.date}.`);
          this.load();
        },
        error: (err) => {
          this.submitting.set(false);
          this.error.set(errorMessage(err));
        },
      });
  }
}
