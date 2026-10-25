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
