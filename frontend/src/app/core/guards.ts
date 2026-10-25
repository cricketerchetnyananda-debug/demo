import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  return inject(AuthService).isLoggedIn() || inject(Router).createUrlTree(['/login']);
};

/** Login and register pages are only for people who are not logged in. */
export const guestGuard: CanActivateFn = () => {
  return !inject(AuthService).isLoggedIn() || inject(Router).createUrlTree(['/dashboard']);
};

export const adminGuard: CanActivateFn = () => {
  return inject(AuthService).isAdmin() || inject(Router).createUrlTree(['/dashboard']);
};
