import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { classLabel, errorMessage, SchoolClass, Student } from '../core/models';

@Component({
  selector: 'app-students',
  imports: [FormsModule, ReactiveFormsModule],
  template: `
    <h1>Students</h1>
    <p class="subtitle">Add students to a class and keep the class list up to date.</p>

    <div class="toolbar">
      <div class="field">
        <label for="cls">Class</label>
        <select id="cls" [ngModel]="classId()" (ngModelChange)="classId.set($event); load()">
          <option [ngValue]="null" disabled>Select a class</option>
          @for (c of classes(); track c.id) {
            <option [ngValue]="c.id">{{ label(c) }}</option>
          }
        </select>
      </div>
    </div>

    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }

    @if (classId() !== null) {
      <div class="card">
        <h2>Add student</h2>
        <form [formGroup]="form" (ngSubmit)="add()" class="add-form">
          <div class="field">
            <label for="roll">Roll no.</label>
            <input id="roll" type="number" min="1" formControlName="rollNumber" />
          </div>
          <div class="field name">
            <label for="name">Full name</label>
            <input id="name" formControlName="fullName" maxlength="120" />
          </div>
          <button type="submit" [disabled]="form.invalid || saving()">Add student</button>
        </form>
      </div>

      <div class="card">
        <h2>Class list ({{ activeCount() }} active)</h2>
        @if (!students().length) {
          <div class="empty">No students yet.</div>
        } @else {
          <div class="table-wrap">
            <table>
              <thead><tr><th>Roll</th><th>Name</th><th>Status</th><th></th></tr></thead>
              <tbody>
                @for (s of students(); track s.id) {
                  <tr [class.inactive]="!s.active">
                    <td>{{ s.rollNumber }}</td>
                    <td>{{ s.fullName }}</td>
                    <td>
                      <span class="badge" [class.present]="s.active" [class.unmarked]="!s.active">
                        {{ s.active ? 'Active' : 'Left school' }}
                      </span>
                    </td>
                    <td>
                      <button class="small secondary" (click)="toggleActive(s)">
                        {{ s.active ? 'Mark as left' : 'Re-activate' }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    }
  `,
  styles: `
    .add-form { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
    .add-form .field { margin-bottom: 0; }
    .add-form .field:first-child input { width: 100px; }
    .add-form .name { flex: 1; min-width: 200px; }
    tr.inactive td { color: var(--muted); }
  `,
})
export class StudentsPage implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly label = classLabel;
  protected readonly classes = signal<SchoolClass[]>([]);
  protected readonly classId = signal<number | null>(null);
  protected readonly students = signal<Student[]>([]);
  protected readonly saving = signal(false);
  protected readonly error = signal('');

  protected readonly form = inject(FormBuilder).group({
    rollNumber: [null as number | null, [Validators.required, Validators.min(1)]],
    fullName: ['', [Validators.required, Validators.maxLength(120)]],
  });

  ngOnInit(): void {
    this.api.classes().subscribe({
      next: (classes) => {
        this.classes.set(classes);
        if (classes.length === 1) {
          this.classId.set(classes[0].id);
          this.load();
        }
      },
      error: (err) => this.error.set(errorMessage(err)),
    });
  }

  activeCount(): number {
    return this.students().filter((s) => s.active).length;
  }

  load(): void {
    const id = this.classId();
    if (id === null) return;
    this.error.set('');
    this.api.students(id).subscribe({
      next: (students) => {
        this.students.set(students);
        const nextRoll = Math.max(0, ...students.map((s) => s.rollNumber)) + 1;
        this.form.reset({ rollNumber: nextRoll, fullName: '' });
      },
      error: (err) => this.error.set(errorMessage(err)),
    });
  }

  add(): void {
    const id = this.classId();
    const { rollNumber, fullName } = this.form.getRawValue();
    if (id === null || !rollNumber || !fullName) return;
    this.saving.set(true);
    this.error.set('');
    this.api.addStudent(id, rollNumber, fullName).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  toggleActive(student: Student): void {
    this.api.updateStudent(student.id, { active: !student.active }).subscribe({
      next: () => this.load(),
      error: (err) => this.error.set(errorMessage(err)),
    });
  }
}
