import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ClassOverview, errorMessage, isoDate } from '../core/models';

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, RouterLink],
  template: `
    <h1>Welcome, {{ auth.user()?.fullName }}</h1>
    <p class="subtitle">Attendance overview for {{ auth.isAdmin() ? 'all classes' : 'your classes' }}</p>

    <div class="toolbar">
      <div class="field">
        <label for="date">Date</label>
        <input id="date" type="date" [max]="today" [ngModel]="date()" (ngModelChange)="date.set($event); load()" />
      </div>
    </div>

    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }

    <div class="stats">
      <div class="stat"><div class="label">Students</div><div class="value">{{ totals().total }}</div></div>
      <div class="stat present"><div class="label">Present</div><div class="value">{{ totals().present }}</div></div>
      <div class="stat late"><div class="label">Late</div><div class="value">{{ totals().late }}</div></div>
      <div class="stat absent"><div class="label">Absent</div><div class="value">{{ totals().absent }}</div></div>
      <div class="stat"><div class="label">Not marked</div><div class="value">{{ totals().unmarked }}</div></div>
    </div>

    <div class="card">
      <h2>Classes</h2>
      @if (!rows().length && !loading()) {
        <div class="empty">
          @if (auth.isAdmin()) {
            No classes yet.
          } @else {
            No class is assigned to you yet. Ask the admin to assign you as class teacher.
          }
        </div>
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Class teacher</th>
                <th class="num">Students</th>
                <th class="num">Present</th>
                <th class="num">Late</th>
                <th class="num">Absent</th>
                <th class="num">Not marked</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (c of rows(); track c.classId) {
                <tr>
                  <td><strong>Grade {{ c.grade }}-{{ c.section }}</strong></td>
                  <td>{{ c.teacherName ?? '—' }}</td>
                  <td class="num">{{ c.total }}</td>
                  <td class="num">{{ c.present }}</td>
                  <td class="num">{{ c.late }}</td>
                  <td class="num">{{ c.absent }}</td>
                  <td class="num">
                    @if (c.unmarked > 0) {
                      <span class="badge unmarked">{{ c.unmarked }}</span>
                    } @else {
                      0
                    }
                  </td>
                  <td>
                    <a class="btn small" routerLink="/attendance" [queryParams]="{ classId: c.classId, date: date() }">
                      Mark
                    </a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class DashboardPage implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);

  protected readonly today = isoDate();
  protected readonly date = signal(this.today);
  protected readonly rows = signal<ClassOverview[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly totals = computed(() =>
    this.rows().reduce(
      (t, c) => ({
        total: t.total + c.total,
        present: t.present + c.present,
        late: t.late + c.late,
        absent: t.absent + c.absent,
        unmarked: t.unmarked + c.unmarked,
      }),
      { total: 0, present: 0, late: 0, absent: 0, unmarked: 0 },
    ),
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.overview(this.date()).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
