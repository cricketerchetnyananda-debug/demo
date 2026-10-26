# School Attendance — project guide

Angular 20 single-page app + NestJS 11 API + PostgreSQL 17 for daily attendance of classes Grade 1–10.
Users log in with **email + password**. The **first registered user becomes admin**; later users are teachers.
Teachers only see classes where they are the class teacher; admins see everything.

## Layout

| Path | What |
|---|---|
| `backend/src/entities/` | TypeORM entities = the database schema (`users`, `classes`, `students`, `attendance_records`, `absence_corrections`) |
| `backend/src/<feature>/` | `*.controller.ts` (routes), `*.service.ts` (logic), `*.dto.ts` (class-validator input rules) |
| `backend/src/common/` | `ClassAccessService` (who may touch which class), date helpers, validation patterns, startup seed |
| `backend/src/auth/` | JWT login/register, global `AuthGuard`, `@Public()`, `@Roles()`, `@CurrentUser()` |
| `frontend/src/app/core/` | `api.service.ts` (all HTTP calls), `models.ts` (shared types + helpers), auth service, guards, interceptor |
| `frontend/src/app/pages/` | One standalone component per page; routes in `app.routes.ts`; nav links in `layout/shell.ts` |
| `tests/e2e/` | Automated end-to-end API tests (`node --test`), one file per feature |
| `docs/test-cases.md` | Test case catalog. Every `TC-*` id there maps to a test in `tests/e2e/` or is a `UI-*` browser check |
| `render.yaml` | Render deployment blueprint (one web service + one PostgreSQL) |

## Commands (Windows; Node at `C:\Program Files\nodejs`, Git at `C:\Program Files\Git\cmd`)

```bash
npm run build                 # root: install + build frontend and backend (what Render runs)
npm run build --prefix backend
npm run build --prefix frontend
npm start                     # root: one server on :3000 serving API + built web pages
npm run start:dev --prefix backend   # API with watch on :3000
npm start --prefix frontend          # Angular dev server on :4200, proxies /api to :3000
npm run test:e2e              # root: builds backend, resets the TEST database, runs tests/e2e
```

`npm run test:e2e` needs `TEST_DATABASE_URL` (in `backend/.env.test`, git-ignored). It **drops and recreates the
schema of that database** — never point it at the real database.

## Conventions

- Match the existing style: standalone Angular components with inline templates, signals for state,
  `@if`/`@for` control flow, global CSS classes from `src/styles.css` (`card`, `toolbar`, `field`, `badge`, `alert`, `stats`).
- Every API input goes through a DTO with class-validator rules; the global `ValidationPipe` rejects unknown fields.
- Every class-scoped endpoint must call `ClassAccessService.assertClass/assertStudent` — teachers must never
  reach another teacher's class. Admin-only endpoints use `@Roles('admin')`.
- Dates are `YYYY-MM-DD` strings (DATE columns are parsed as strings in `main.ts`), times are `HH:MM`.
  Attendance can't be recorded for future dates.
- One attendance record per student per day (unique `studentId + date`); writes use `upsert`.
- Schema changes: edit the entity; `DB_SYNC=true` applies them in development and on Render.
- Never commit `.env`, `.env.*` (except `.env.example`), or real passwords.
- Keep `frontend/angular.json` `"prebundle": false` — Vite pre-bundling broke Angular DI in the dev server.

## Definition of done for any change

1. `npm run build --prefix backend` and `npm run build --prefix frontend` succeed with no errors.
2. `npm run test:e2e` passes.
3. New behaviour has test cases in `docs/test-cases.md` and automated tests in `tests/e2e/`.
4. README updated if setup, features or API changed.
