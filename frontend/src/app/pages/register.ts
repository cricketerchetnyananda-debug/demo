import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/models';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  return group.get('password')?.value === group.get('confirmPassword')?.value ? null : { mismatch: true };
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  styleUrl: './auth-layout.css',
  template: `
    <div class="auth-card">
      <div class="logo">🏫</div>
      <h1>Create account</h1>
      <p class="subtitle">Register to manage class attendance</p>

      @if (error()) {
        <div class="alert error">{{ error() }}</div>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="field">
          <label for="fullName">Full name</label>
          <input id="fullName" formControlName="fullName" autocomplete="name" />
          @if (form.controls.fullName.touched && form.controls.fullName.invalid) {
            <span class="hint">Full name is required</span>
          }
        </div>
        <div class="field">
          <label for="email">Email address (this is your username)</label>
          <input id="email" type="email" formControlName="email" autocomplete="username" placeholder="you@school.edu" />
          @if (form.controls.email.touched && form.controls.email.invalid) {
            <span class="hint">Enter a valid email address</span>
          }
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" type="password" formControlName="password" autocomplete="new-password" />
          @if (form.controls.password.touched && form.controls.password.invalid) {
            <span class="hint">Use at least 8 characters</span>
          }
        </div>
        <div class="field">
          <label for="confirmPassword">Confirm password</label>
          <input id="confirmPassword" type="password" formControlName="confirmPassword" autocomplete="new-password" />
          @if (form.controls.confirmPassword.touched && form.hasError('mismatch')) {
            <span class="hint">Passwords do not match</span>
          }
        </div>
        <button type="submit" [disabled]="loading()">{{ loading() ? 'Creating account…' : 'Register' }}</button>
      </form>

      <p class="switch">Already have an account? <a routerLink="/login">Log in</a></p>
    </div>
  `,
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      fullName: ['', [Validators.required, Validators.maxLength(120)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { fullName, email, password } = this.form.getRawValue();
    this.loading.set(true);
    this.error.set('');
    this.auth.register(fullName, email, password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
