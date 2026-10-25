import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './core/guards';
import { Shell } from './layout/shell';

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./pages/login').then((m) => m.LoginPage) },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/register').then((m) => m.RegisterPage),
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard').then((m) => m.DashboardPage) },
      { path: 'attendance', loadComponent: () => import('./pages/mark-attendance').then((m) => m.MarkAttendancePage) },
      { path: 'late', loadComponent: () => import('./pages/late-checkin').then((m) => m.LateCheckInPage) },
      { path: 'absences', loadComponent: () => import('./pages/absences').then((m) => m.AbsencesPage) },
      { path: 'corrections', loadComponent: () => import('./pages/corrections').then((m) => m.CorrectionsPage) },
      { path: 'students', loadComponent: () => import('./pages/students').then((m) => m.StudentsPage) },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/admin').then((m) => m.AdminPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
