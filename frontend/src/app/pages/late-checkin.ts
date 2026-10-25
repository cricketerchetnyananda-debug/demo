import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import {
  AttendanceRecordView,
  classLabel,
  currentTime,
  errorMessage,
  isoDate,
  RegisterEntry,
  SchoolClass,
} from '../core/models';

@Component({
  selector: 'app-late-checkin',
  imports: [ReactiveFormsModule, FormsModule],
  template: `
    <h1>Late Check-in</h1>
    <p class="subtitle">Record the arrival time of a student who came in late. The student is marked "late" for that day.</p>

    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }
    @if (message()) {
      <div class="alert success">{{ message() }}</div>
    }

    <div class="card">
      <h2>New late check-in</h2>
      <form [formGroup]="form" (ngSubmit)="submit()" class="grid">
        <div class="field">
          <label for="cls">Class</label>
          <select id="cls" formControlName="classId" (change)="loadStudents()">
            <option [ngValue]="null" disabled>Select a class</option>
            @for (c of classes(); track c.id) {
              <option [ngValue]="c.id">{{ label(c) }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label for="date">Date</label>
          <input id="date" type="date" formControlName="date" [max]="today" (change)="loadStudents()" />
        </div>
        <div class="field">
          <label for="student">Student</label>
          <select id="student" formControlName="studentId">
            <option [ngValue]="null" disabled>Select a student</option>
            @for (s of students(); track s.studentId) {
              <option [ngValue]="s.studentId">
                {{ s.rollNumber }}. {{ s.fullName }}{{ s.status ? ' (currently ' + s.status + ')' : '' }}
              </option>
            }
          </select>
        </div>
        <div class="field">
          <label for="time">Arrival time</label>
          <input id="time" type="time" formControlName="checkInTime" />
        </div>
        <div class="field wide">
          <label for="remarks">Reason / remarks</label>
          <input id="remarks" formControlName="remarks" placeholder="e.g. School bus delayed" maxlength="255" />
        </div>
        <div class="field">
          <label>&nbsp;</label>
          <button type="submit" [disabled]="form.invalid || saving()">{{ saving() ? 'Saving…' : 'Record late check-in' }}</button>
        </div>
      </form>
    </div>

    <div class="card">
      <h2>Late arrivals on {{ form.controls.date.value }}</h2>
      @if (!late().length) {
        <div class="empty">No late arrivals recorded for this day.</div>
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Class</th><th>Roll</th><th>Student</th><th>Arrived at</th><th>Remarks</th></tr>
            </thead>
            <tbody>
              @for (r of late(); track r.id) {
                <tr>
                  <td>{{ label(r.class) }}</td>
                  <td>{{ r.student.rollNumber }}</td>
                  <td>{{ r.student.fullName }}</td>
                  <td><span class="badge late">{{ r.checkInTime ?? '—' }}</span></td>
                  <td>{{ r.remarks ?? '' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0 16px; align-items: end; }
    .wide { grid-column: span 2; }
    @media (max-width: 640px) { .wide { grid-column: auto; } }
  `,
})
export class LateCheckInPage implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly today = isoDate();
  protected readonly label = classLabel;
  protected readonly classes = signal<SchoolClass[]>([]);
  protected readonly students = signal<RegisterEntry[]>([]);
  protected readonly late = signal<AttendanceRecordView[]>([]);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');

  protected readonly form = inject(FormBuilder).group({
    classId: [null as number | null, Validators.required],
    date: [this.today, Validators.required],
    studentId: [null as number | null, Validators.required],
    checkInTime: [currentTime(), Validators.required],
    remarks: [''],
  });

  ngOnInit(): void {
    this.api.classes().subscribe({
      next: (classes) => {
        this.classes.set(classes);
        if (classes.length === 1) {
          this.form.controls.classId.setValue(classes[0].id);
          this.loadStudents();
        }
      },
      error: (err) => this.error.set(errorMessage(err)),
    });
  }

  loadStudents(): void {
    const { classId, date } = this.form.getRawValue();
    if (!classId || !date) return;
    this.form.controls.studentId.setValue(null);
    this.api.register(classId, date).subscribe({
      next: (reg) => this.students.set(reg.entries),
      error: (err) => this.error.set(errorMessage(err)),
    });
    this.api.records({ classId, from: date, to: date, status: 'late' }).subscribe({
      next: (rows) => this.late.set(rows),
      error: (err) => this.error.set(errorMessage(err)),
    });
  }

  submit(): void {
    const v = this.form.getRawValue();
    if (this.form.invalid || !v.studentId || !v.date || !v.checkInTime) return;
    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.api.lateCheckIn(v.studentId, v.date, v.checkInTime, v.remarks ?? undefined).subscribe({
      next: () => {
        const name = this.students().find((s) => s.studentId === v.studentId)?.fullName ?? 'Student';
        this.message.set(`${name} checked in late at ${v.checkInTime}.`);
        this.saving.set(false);
        this.form.patchValue({ remarks: '', checkInTime: currentTime() });
        this.loadStudents();
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.saving.set(false);
      },
    });
  }
}
