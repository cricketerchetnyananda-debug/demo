import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/models';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  styleUrl: './auth-layout.css',
  template: `
    <div class="auth-card">
      <div class="logo">🏫</div>
      <h1>School Attendance</h1>
      <p class="subtitle">Sign in with your email address</p>

      @if (error()) {
        <div class="alert error">{{ error() }}</div>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="field">
          <label for="email">Email address</label>
          <input id="email" type="email" formControlName="email" autocomplete="username" placeholder="you@school.edu" />
          @if (form.controls.email.touched && form.controls.email.invalid) {
            <span class="hint">Enter a valid email address</span>
          }
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" type="password" formControlName="password" autocomplete="current-password" />
          @if (form.controls.password.touched && form.controls.password.invalid) {
            <span class="hint">Password is required</span>
          }
        </div>
        <button type="submit" [disabled]="loading()">{{ loading() ? 'Signing in…' : 'Log in' }}</button>
      </form>

      <p class="switch">New user? <a routerLink="/register">Register a new account</a></p>
    </div>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.loading.set(true);
    this.error.set('');
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
