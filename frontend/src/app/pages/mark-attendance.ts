import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AttendanceStatus, classLabel, currentTime, errorMessage, isoDate, SchoolClass } from '../core/models';

interface Row {
  studentId: number;
  rollNumber: number;
  fullName: string;
  status: AttendanceStatus | null;
  checkInTime: string | null;
  remarks: string | null;
}

@Component({
  selector: 'app-mark-attendance',
  imports: [FormsModule],
  template: `
    <h1>Mark Attendance</h1>
    <p class="subtitle">Take the daily register for a class. Click P (present), L (late) or A (absent) for each student.</p>

    <div class="toolbar">
      <div class="field">
        <label for="cls">Class</label>
        <select id="cls" [ngModel]="classId()" (ngModelChange)="classId.set($event); load()">
          <option [ngValue]="null" disabled>Select a class</option>
          @for (c of classes(); track c.id) {
            <option [ngValue]="c.id">{{ label(c) }} ({{ c.studentCount }} students)</option>
          }
        </select>
      </div>
      <div class="field">
        <label for="date">Date</label>
        <input id="date" type="date" [max]="today" [ngModel]="date()" (ngModelChange)="date.set($event); load()" />
      </div>
      @if (rows.length) {
        <button class="secondary" (click)="markAll('present')">Mark all present</button>
      }
    </div>

    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }
    @if (message()) {
      <div class="alert success">{{ message() }}</div>
    }

    @if (classId() !== null) {
      <div class="card">
        @if (loading()) {
          <div class="empty">Loading…</div>
        } @else if (!rows.length) {
          <div class="empty">No active students in this class. Add students on the Students page.</div>
        } @else {
          <div class="stats">
            <div class="stat present"><div class="label">Present</div><div class="value">{{ count('present') }}</div></div>
            <div class="stat late"><div class="label">Late</div><div class="value">{{ count('late') }}</div></div>
            <div class="stat absent"><div class="label">Absent</div><div class="value">{{ count('absent') }}</div></div>
            <div class="stat"><div class="label">Not marked</div><div class="value">{{ count(null) }}</div></div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Roll</th>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Check-in time</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                @for (r of rows; track r.studentId) {
                  <tr>
                    <td>{{ r.rollNumber }}</td>
                    <td>{{ r.fullName }}</td>
                    <td>
                      <div class="status-group">
                        <button class="small" [class.on]="r.status === 'present'" data-s="present" (click)="setStatus(r, 'present')" title="Present">P</button>
                        <button class="small" [class.on]="r.status === 'late'" data-s="late" (click)="setStatus(r, 'late')" title="Late">L</button>
                        <button class="small" [class.on]="r.status === 'absent'" data-s="absent" (click)="setStatus(r, 'absent')" title="Absent">A</button>
                      </div>
                    </td>
                    <td>
                      @if (r.status === 'late' || r.status === 'present') {
                        <input type="time" [(ngModel)]="r.checkInTime" [required]="r.status === 'late'" />
                      } @else {
                        <span class="muted">—</span>
                      }
                    </td>
                    <td><input [(ngModel)]="r.remarks" placeholder="Optional" maxlength="255" /></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="save-bar">
            @if (count(null) > 0) {
              <span class="muted">{{ count(null) }} student(s) not marked yet — they will be skipped.</span>
            }
            <button (click)="save()" [disabled]="saving() || count(null) === rows.length">
              {{ saving() ? 'Saving…' : 'Save attendance' }}
            </button>
          </div>
        }
      </div>
    }
  `,
  styles: `
    .status-group { display: inline-flex; gap: 4px; }
    .status-group button { background: #fff; color: var(--muted); border-color: var(--border); min-width: 34px; justify-content: center; }
    .status-group button:hover { background: #f0f2f7; }
    .status-group button.on[data-s='present'] { background: var(--present); border-color: var(--present); color: #fff; }
    .status-group button.on[data-s='late'] { background: var(--late); border-color: var(--late); color: #fff; }
    .status-group button.on[data-s='absent'] { background: var(--absent); border-color: var(--absent); color: #fff; }
    .save-bar { display: flex; justify-content: flex-end; align-items: center; gap: 14px; margin-top: 16px; flex-wrap: wrap; }
    td input { width: 100%; max-width: 220px; }
  `,
})
export class MarkAttendancePage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  protected readonly today = isoDate();
  protected readonly classes = signal<SchoolClass[]>([]);
  protected readonly classId = signal<number | null>(null);
  protected readonly date = signal(this.today);
  protected rows: Row[] = [];
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly label = classLabel;

  ngOnInit(): void {
    const query = this.route.snapshot.queryParamMap;
    if (query.get('date')) this.date.set(query.get('date')!);
    this.api.classes().subscribe({
      next: (classes) => {
        this.classes.set(classes);
        const wanted = Number(query.get('classId'));
        const initial = classes.find((c) => c.id === wanted) ?? (classes.length === 1 ? classes[0] : undefined);
        if (initial) {
          this.classId.set(initial.id);
          this.load();
        }
      },
      error: (err) => this.error.set(errorMessage(err)),
    });
  }

  load(): void {
    const classId = this.classId();
    if (classId === null || !this.date()) return;
    this.loading.set(true);
    this.error.set('');
    this.message.set('');
    this.api.register(classId, this.date()).subscribe({
      next: (register) => {
        this.rows = register.entries.map((e) => ({ ...e }));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.rows = [];
        this.loading.set(false);
      },
    });
  }

  count(status: AttendanceStatus | null): number {
    return this.rows.filter((r) => r.status === status).length;
  }

  setStatus(row: Row, status: AttendanceStatus): void {
    row.status = status;
    if (status === 'absent') row.checkInTime = null;
    if (status === 'late' && !row.checkInTime) row.checkInTime = currentTime();
    this.message.set('');
  }

  markAll(status: AttendanceStatus): void {
    this.rows.forEach((r) => this.setStatus(r, status));
  }

  save(): void {
    const classId = this.classId();
    if (classId === null) return;
    const missingTime = this.rows.find((r) => r.status === 'late' && !r.checkInTime);
    if (missingTime) {
      this.error.set(`Enter a check-in time for ${missingTime.fullName} (marked late).`);
      return;
    }
    const entries = this.rows
      .filter((r) => r.status !== null)
      .map((r) => ({
        studentId: r.studentId,
        status: r.status as AttendanceStatus,
        checkInTime: r.checkInTime || null,
        remarks: r.remarks || null,
      }));

    this.saving.set(true);
    this.error.set('');
    this.api.saveRegister(classId, this.date(), entries).subscribe({
      next: (register) => {
        this.rows = register.entries.map((e) => ({ ...e }));
        this.message.set(`Attendance saved for ${entries.length} student(s).`);
        this.saving.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.saving.set(false);
      },
    });
  }
}
