# School Attendance (Grades 1–10)

Angular single-page app + NestJS API + PostgreSQL for tracking daily class attendance.

## Features

| Feature | Where | What it does |
|---|---|---|
| Login / Register | `/login`, `/register` | Email address is the username. The **first account registered becomes the admin**; later accounts are teachers. |
| Attendance tracking | Mark Attendance | Daily register per class: Present / Late / Absent per student, with check-in time and remarks. |
| Absent tracking | Absent Tracking | Absences in a date range, per-student totals and attendance %, highlights < 75% or 3+ absences. |
| Late check-in | Late Check-in | Record a student's arrival time; marks them *late* for that day. |
| Absent correction | Absent Tracking → Absent Corrections | Teacher requests changing a wrong absence to present/late with a reason; admin approves (record is updated) or rejects. |
| Admin | Classes & Teachers | Assign class teachers, add sections, promote users to admin. |

Teachers only see the classes assigned to them. Grade 1-A … Grade 10-A are created automatically on first start.

## Project layout

```
backend/   NestJS API (port 3000), TypeORM entities in src/entities
frontend/  Angular 20 SPA (port 4200), proxies /api to the backend
```

## Database tables

`users`, `classes`, `students`, `attendance_records` (one row per student per day), `absence_corrections`.
Tables are created automatically when `DB_SYNC=true` (development).

## Running locally

Prerequisites: Node.js 20+ and PostgreSQL 14+.

1. Create the database (in `psql` as the postgres superuser):
   ```sql
   CREATE USER attendance_app WITH PASSWORD 'choose-a-password';
   CREATE DATABASE school_attendance OWNER attendance_app;
   ```
2. Backend:
   ```bash
   cd backend
   copy .env.example .env      # then edit DB_PASSWORD and JWT_SECRET
   npm install
   npm run start:dev
   ```
3. Frontend (new terminal):
   ```bash
   cd frontend
   npm install
   npm start
   ```
4. Open http://localhost:4200, click **Register a new account** — the first user is the admin.

## Testing

- Test case catalog: [docs/test-cases.md](docs/test-cases.md) — `TC-*` API cases and `UI-*` browser checks.
- Automated end-to-end tests: `npm run test:e2e` (root). Needs a **separate** test database:
  ```sql
  CREATE DATABASE school_attendance_test OWNER attendance_app;
  ```
  and `backend/.env.test` containing
  `TEST_DATABASE_URL=postgres://attendance_app:<password>@localhost:5432/school_attendance_test`.
  The suite wipes that database on every run (it refuses to run on a database whose name lacks "test").

## Claude Code agents

Defined in `.claude/agents/` (project guide for all of them: `CLAUDE.md`):

| Agent | Use it for |
|---|---|
| `feature-developer` | New features end to end: entity → API → Angular page → test cases → e2e tests → docs |
| `bug-fixer` | Reproduce with a failing test, fix the root cause, keep the regression test |
| `qa-tester` | Full start-to-end test run (build, `test:e2e`, `UI-*` browser checks), writes new test cases, reports bugs |

Example: *"Use the feature-developer agent to add a monthly attendance report per class."*

## Production (one server)

`npm run build` in the repo root builds both parts; `npm start` then serves the API **and** the web pages
on one port (default 3000). Set `DATABASE_URL` (plus `DB_SSL=true` if the database needs SSL) and `JWT_SECRET`.

## Deploy on Render (public https link)

1. Create a free account at https://render.com and sign in with GitHub.
2. **New → Blueprint**, choose this repository, click **Apply**.
   `render.yaml` creates the web service and a PostgreSQL database and wires them together.
3. Wait for the first deploy (about 5 minutes), then open the `https://school-attendance-xxxx.onrender.com` link
   in Chrome or Safari and register — the first account becomes the admin.

Free-plan notes: the web service sleeps after ~15 minutes idle (first visit then takes ~1 minute),
and Render's free PostgreSQL expires after 30 days — upgrade the database plan to keep data.

## API overview (all under `/api`)

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | Public. Return `{ accessToken, user }` |
| GET | `/classes` | Admin: all; teacher: own classes |
| GET/POST | `/classes/:id/students` | |
| PATCH | `/students/:id` | Rename, change roll no., mark as left |
| GET/PUT | `/attendance/register?classId&date` | Daily class register |
| POST | `/attendance/late-checkin` | `{ studentId, date, checkInTime, remarks }` |
| GET | `/attendance/records?classId&from&to&status` | Absent / late lists |
| GET | `/attendance/summary?classId&from&to` | Per-student totals |
| GET | `/attendance/overview?date` | Dashboard |
| GET/POST | `/corrections` | List / request absent corrections |
| PATCH | `/corrections/:id/review` | Admin: `{ decision: approved|rejected, note }` |
| GET / PATCH | `/users`, `/users/:id/role`, `/classes/:id/teacher` | Admin only |
