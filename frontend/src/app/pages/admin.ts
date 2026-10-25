import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { classLabel, errorMessage, Role, SchoolClass, User } from '../core/models';

@Component({
  selector: 'app-admin',
  imports: [FormsModule],
  template: `
    <h1>Classes &amp; Teachers</h1>
    <p class="subtitle">Assign a class teacher to each grade and manage who is an admin.</p>

    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }
    @if (message()) {
      <div class="alert success">{{ message() }}</div>
    }

    <div class="card">
      <h2>Classes</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Class</th><th class="num">Students</th><th>Class teacher</th></tr></thead>
          <tbody>
            @for (c of classes(); track c.id) {
              <tr>
                <td><strong>{{ label(c) }}</strong></td>
                <td class="num">{{ c.studentCount }}</td>
                <td>
                  <select [ngModel]="c.teacher?.id ?? null" (ngModelChange)="assign(c, $event)">
                    <option [ngValue]="null">— Not assigned —</option>
                    @for (u of users(); track u.id) {
                      <option [ngValue]="u.id">{{ u.fullName }} ({{ u.email }})</option>
                    }
                  </select>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <h2 class="spaced">Add a section</h2>
      <div class="toolbar">
        <div class="field">
          <label for="grade">Grade</label>
          <select id="grade" [(ngModel)]="newGrade">
            @for (g of grades; track g) {
              <option [ngValue]="g">Grade {{ g }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label for="section">Section</label>
          <input id="section" [(ngModel)]="newSection" maxlength="5" placeholder="B" class="section" />
        </div>
        <button (click)="addClass()" [disabled]="!newSection.trim()">Add class</button>
      </div>
    </div>

    <div class="card">
      <h2>Users</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email (username)</th><th>Role</th><th>Classes</th></tr></thead>
          <tbody>
            @for (u of users(); track u.id) {
              <tr>
                <td>{{ u.fullName }}</td>
                <td>{{ u.email }}</td>
                <td>
                  <select [ngModel]="u.role" (ngModelChange)="changeRole(u, $event)" [disabled]="u.id === auth.user()?.id">
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td>{{ classesOf(u.id) || '—' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p class="muted">New users register themselves from the login page and start as teachers.</p>
    </div>
  `,
  styles: `
    .spaced { margin-top: 24px; }
    .section { width: 90px; text-transform: uppercase; }
  `,
})
export class AdminPage implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);

  protected readonly label = classLabel;
  protected readonly grades = Array.from({ length: 10 }, (_, i) => i + 1);
  protected readonly classes = signal<SchoolClass[]>([]);
  protected readonly users = signal<User[]>([]);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected newGrade = 1;
  protected newSection = '';

  private readonly classesByTeacher = computed(() => {
    const map = new Map<number, string[]>();
    for (const c of this.classes()) {
      if (c.teacher) map.set(c.teacher.id, [...(map.get(c.teacher.id) ?? []), classLabel(c)]);
    }
    return map;
  });

  ngOnInit(): void {
    this.loadClasses();
    this.api.users().subscribe({
      next: (users) => this.users.set(users),
      error: (err) => this.error.set(errorMessage(err)),
    });
  }

  classesOf(userId: number): string {
    return (this.classesByTeacher().get(userId) ?? []).join(', ');
  }

  loadClasses(): void {
    this.api.classes().subscribe({
      next: (classes) => this.classes.set(classes),
      error: (err) => this.error.set(errorMessage(err)),
    });
  }

  assign(c: SchoolClass, teacherId: number | null): void {
    this.clear();
    this.api.assignTeacher(c.id, teacherId).subscribe({
      next: () => {
        const name = this.users().find((u) => u.id === teacherId)?.fullName;
        this.message.set(name ? `${name} is now class teacher of ${classLabel(c)}.` : `${classLabel(c)} has no class teacher.`);
        this.loadClasses();
      },
      error: (err) => this.error.set(errorMessage(err)),
    });
  }

  addClass(): void {
    this.clear();
    const section = this.newSection.trim().toUpperCase();
    this.api.createClass(this.newGrade, section).subscribe({
      next: () => {
        this.message.set(`Added Grade ${this.newGrade}-${section}.`);
        this.newSection = '';
        this.loadClasses();
      },
      error: (err) => this.error.set(errorMessage(err)),
    });
  }

  changeRole(user: User, role: Role): void {
    this.clear();
    this.api.updateRole(user.id, role).subscribe({
      next: (updated) => {
        this.users.update((list) => list.map((u) => (u.id === updated.id ? updated : u)));
        this.message.set(`${updated.fullName} is now ${updated.role === 'admin' ? 'an admin' : 'a teacher'} (applies at their next login).`);
      },
      error: (err) => this.error.set(errorMessage(err)),
    });
  }

  private clear(): void {
    this.error.set('');
    this.message.set('');
  }
}
