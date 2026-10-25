import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="topbar">
      <button class="menu secondary small" (click)="menuOpen.set(!menuOpen())" aria-label="Toggle menu">☰</button>
      <span class="brand">🏫 School Attendance</span>
      <span class="spacer"></span>
      <span class="who">
        {{ auth.user()?.fullName }}
        <span class="badge" [class.pending]="auth.isAdmin()" [class.unmarked]="!auth.isAdmin()">{{ auth.user()?.role }}</span>
      </span>
      <button class="secondary small" (click)="auth.logout()">Log out</button>
    </header>

    <div class="layout">
      <nav [class.open]="menuOpen()" (click)="menuOpen.set(false)">
        <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
        <a routerLink="/attendance" routerLinkActive="active">Mark Attendance</a>
        <a routerLink="/late" routerLinkActive="active">Late Check-in</a>
        <a routerLink="/absences" routerLinkActive="active">Absent Tracking</a>
        <a routerLink="/corrections" routerLinkActive="active">Absent Corrections</a>
        <a routerLink="/students" routerLinkActive="active">Students</a>
        @if (auth.isAdmin()) {
          <a routerLink="/admin" routerLinkActive="active">Classes &amp; Teachers</a>
        }
      </nav>
      <main>
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    .topbar {
      display: flex; align-items: center; gap: 12px; padding: 10px 20px;
      background: var(--surface); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 10;
    }
    .brand { font-weight: 700; font-size: 1.05rem; }
    .spacer { flex: 1; }
    .who { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; }
    .menu { display: none; }
    .layout { display: flex; min-height: calc(100vh - 53px); }
    nav { width: 220px; flex-shrink: 0; padding: 16px 10px; background: var(--surface); border-right: 1px solid var(--border); }
    nav a {
      display: block; padding: 10px 14px; border-radius: 8px; color: var(--text);
      text-decoration: none; font-weight: 500; margin-bottom: 2px;
    }
    nav a:hover { background: #f0f2f7; }
    nav a.active { background: #eaf0fd; color: var(--primary); font-weight: 700; }
    main { flex: 1; padding: 24px; min-width: 0; max-width: 1200px; }
    @media (max-width: 800px) {
      .menu { display: inline-flex; }
      .who { display: none; }
      nav { display: none; position: fixed; top: 53px; left: 0; bottom: 0; z-index: 9; box-shadow: var(--shadow); }
      nav.open { display: block; }
      main { padding: 16px; }
    }
  `,
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly menuOpen = signal(false);
}
