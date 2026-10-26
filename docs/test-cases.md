# Test cases — School Attendance

`TC-*` cases are automated in `tests/e2e/` (the test name starts with the id) and run with `npm run test:e2e`.
`UI-*` cases are browser checks, walked through by the `qa-tester` agent or by hand.

**Shared test data** (`createSchool()` in `tests/e2e/helpers.mjs`), on an empty test database:
- Admin User (`admin@example.test`, first registered → admin), Teacher A, Teacher B.
- Teacher A is class teacher of **Grade 5-A**: Aarav Sharma (roll 1), Diya Patel (2), Kabir Singh (3).
- Teacher B is class teacher of **Grade 6-A**: Meera Iyer (1), Rohan Das (2).

"D-1" means yesterday, "D+1" tomorrow.

---

## 1. Login & registration — `tests/e2e/auth.test.mjs`

| Id | Title | Steps | Expected |
|---|---|---|---|
| TC-AUTH-01 | First registered user becomes admin | Empty DB → register name/email/password | 201, `user.role = admin`, token returned |
| TC-AUTH-02 | Later users register as teachers | Register a second account | 201, `role = teacher` |
| TC-AUTH-03 | Email is unique, case-insensitive | Register `FIRST@EXAMPLE.TEST` when `first@example.test` exists | 409 "already exists" |
| TC-AUTH-04 | Registration input is validated | Register with bad email, 5-char password, empty name | 400 with "Enter a valid email address", "Password must be at least 8 characters", "Full name is required" |
| TC-AUTH-05 | Login with email + password | Login using upper-case email and correct password | 200, token, user email lower-case, no password hash in response |
| TC-AUTH-06 | Wrong password rejected | Login with wrong password | 401 "Invalid email or password" |
| TC-AUTH-07 | Unknown email rejected with same message | Login with unregistered email | 401 "Invalid email or password" (doesn't reveal which part was wrong) |
| TC-AUTH-08 | API requires login | Call `GET /api/classes` without token | 401 |
| TC-AUTH-09 | Tampered token rejected | Call with a modified token / garbage token | 401 |
| TC-AUTH-10 | Current user endpoint | `GET /api/auth/me` with token | 200 with id, email, fullName, role |
| TC-AUTH-11 | Cannot self-register as admin | Register with extra field `role: "admin"` | 400; account not created (login fails) |

## 2. Classes & students — `tests/e2e/classes.test.mjs`

| Id | Title | Steps | Expected |
|---|---|---|---|
| TC-CLASS-01 | Grades 1–10 created automatically | Admin lists classes on new DB | 10 classes, Grade 1-A … Grade 10-A |
| TC-CLASS-02 | Teachers see only their classes | Teacher A / Teacher B list classes | A sees only Grade 5-A, B only Grade 6-A |
| TC-CLASS-03 | Only admin assigns class teachers | Teacher tries to assign; admin unassigns and reassigns Grade 6-A | Teacher 403; after unassign Teacher B sees 0 classes, after reassign 1 |
| TC-CLASS-04 | Assigning unknown teacher fails | Admin assigns teacherId 999999 | 400 "Teacher not found" |
| TC-CLASS-05 | Admin adds a section | Create Grade 3-B; again; grade 11; section `b` | 201; 409 duplicate; 400; 400 |
| TC-CLASS-06 | Teachers cannot add classes | Teacher creates a class | 403 |
| TC-STU-01 | Teacher adds a student to own class | Teacher A adds roll 4 to Grade 5-A | 201, active, in Grade 5-A |
| TC-STU-02 | Roll numbers unique per class | Add roll 1 again in 5-A; add roll 3 in 6-A | 409; 201 (same number in another class is fine) |
| TC-STU-03 | Teachers can't manage other classes' students | Teacher A lists/adds/edits Grade 6-A students | 403 each |
| TC-STU-04 | Student who left is excluded | Mark roll 4 as left | 200; not in daily register; class student count back to 3 |
| TC-STU-05 | Student input validated | Roll 0; empty name; unknown field | 400 each |
| TC-STU-06 | Can't change roll to a used number | Change Kabir's roll to 1 | 409 |
| TC-ADMIN-01 | Only admin lists users | Teacher / admin `GET /api/users` | 403; 200 with 3 users and no password hashes |
| TC-ADMIN-02 | Admin promotes a teacher | Make Teacher B admin; B uses old token, then logs in again | Old token still teacher (403 on users); after login 200 |
| TC-ADMIN-03 | Admin can't remove own admin role | Admin sets own role to teacher | 400 |

## 3. Attendance tracking, late check-in, dashboard — `tests/e2e/attendance.test.mjs`

| Id | Title | Steps | Expected |
|---|---|---|---|
| TC-ATT-01 | Empty register lists students | Get Grade 5-A register for today | 3 students by roll number, all unmarked |
| TC-ATT-02 | Save the day's register | Aarav present 08:00, Diya absent "Sick", Kabir late 09:10 | 200; reading back returns same statuses, times, remarks |
| TC-ATT-03 | Re-saving updates, never duplicates | Save only Aarav as absent | Aarav absent, others unchanged, still 3 records for the day |
| TC-ATT-04 | Absent clears check-in time | Save absent with a check-in time | Stored check-in time is empty |
| TC-ATT-05 | No future dates | Save for D+1; save for D-1 | 400 "future date"; 200 |
| TC-ATT-06 | Students must belong to the class | Grade 5-A register containing a Grade 6-A student | 400 |
| TC-ATT-07 | No duplicate students in one save | Same student twice | 400 |
| TC-ATT-08 | Register input validated | Status `holiday`; date `25-10-2026`; time `25:00`; empty list | 400 each |
| TC-ATT-09 | Teachers can't mark other classes | Teacher A reads/saves Grade 6-A | 403 |
| TC-LATE-01 | Late check-in without earlier mark | Check in Aarav late on D-3 at 09:30 | 201, status late, time 09:30 |
| TC-LATE-02 | Late check-in replaces an absence | Diya (absent today) checks in 09:45 "Bus late" | Record becomes late 09:45 with remark |
| TC-LATE-03 | Arrival time required and valid | Missing time; `9:5` | 400 |
| TC-LATE-04 | No future late check-ins | Check-in for D+1 | 400 |
| TC-LATE-05 | Not for students who left | Check in a student marked as left | 400 |
| TC-LATE-06 | Teachers can't check in other classes | Teacher A checks in a Grade 6-A student | 403 |
| TC-LATE-07 | Late list for the day | List late records for Grade 5-A today | Diya 09:45 "Bus late" and Kabir 09:10 |
| TC-DASH-01 | Dashboard counts per class | Admin overview for today | Grade 5-A: total 3, present 0, late 2, absent 1, unmarked 0, teacher "Teacher A"; Grade 6-A: 2 unmarked |
| TC-DASH-02 | Teacher dashboard only own classes | Teacher A overview | Only Grade 5-A |
| TC-DASH-03 | Dashboard date validated | Overview with date `today` | 400 |

## 4. Absent tracking & absent correction — `tests/e2e/absences.test.mjs`

Data: Grade 5-A — D-2: Aarav absent, Diya & Kabir present; D-1: Aarav & Diya absent, Kabir late; today: Aarav absent,
Diya & Kabir present. Grade 6-A today: Meera absent, Rohan present.

| Id | Title | Steps | Expected |
|---|---|---|---|
| TC-ABS-01 | Absence list by class and date range | Teacher A lists absences D-2…today, then D-1 only | 4 records newest first; 2 records |
| TC-ABS-02 | Absence list respects class access | Teacher A without class filter; admin without filter | A: only Grade 5-A (4); admin: 5 incl. Meera |
| TC-ABS-03 | Attendance summary & percentage | Summary Grade 5-A D-2…today; and a range with no marks | Aarav 0% (3 absent), Diya 66.7%, Kabir 100% (late counts as attended); empty range → % empty, 0 days |
| TC-ABS-04 | Date range validated | from after to; range > 1 year; summary without class | 400 each |
| TC-ABS-05 | Teachers can't track other classes | Teacher A summary / list for Grade 6-A | 403 |
| TC-CORR-01 | Teacher requests absent → present | Request for Aarav today with reason | 201 pending; absence shows "pending correction" |
| TC-CORR-02 | Absent → late needs a time | Request late without time; with 09:40 | 400; 201 |
| TC-CORR-03 | Only absences can be corrected | Request for Kabir's present record | 400 "Only absences can be corrected" |
| TC-CORR-04 | One pending request per absence | Request again for Aarav today | 409 |
| TC-CORR-05 | Teachers can't approve | Teacher A reviews a request | 403 |
| TC-CORR-06 | Approval updates attendance | Admin approves both Aarav requests | Approved, reviewer "Admin User"; Aarav present today (remark "Corrected from absent…"), late 09:40 on D-1 |
| TC-CORR-07 | Rejection leaves attendance unchanged | Request for Diya D-1; admin rejects with note | Rejected with note; Diya still absent |
| TC-CORR-08 | Can't review twice | Review an approved request again | 400 |
| TC-CORR-09 | New request allowed after rejection | Request again for Diya D-1 | 201 pending |
| TC-CORR-10 | Correction list filters & access | Teacher B requests for Meera; Teacher A lists; filter by status | A doesn't see Meera's; pending filter only pending; admin sees all |
| TC-CORR-11 | Teachers can't correct other classes | Teacher A requests for Meera's absence | 403 |
| TC-CORR-12 | Correction input validated | Empty reason; requested status `absent` | 400 each |
| TC-CORR-13 | Unknown ids | Request for record 999999; review request 999999 | 404 each |

## 5. System — `tests/e2e/system.test.mjs`

| Id | Title | Steps | Expected |
|---|---|---|---|
| TC-SYS-01 | Health check without login | `GET /api/health` | 200 `{status: "ok"}` |
| TC-SYS-02 | Unknown API route | `GET /api/does-not-exist` | 404 (not the web page) |
| TC-SYS-03 | Web page deep links | `GET /attendance` (frontend built) | 200 HTML containing `<app-root>` |

---

## 6. Browser checks (UI)

Run against an empty test database (see `qa-tester` agent). Check Chrome desktop and a 375px-wide phone view.

| Id | Title | Steps | Expected |
|---|---|---|---|
| UI-01 | Login page | Open `/` | Redirects to `/login`: email + password fields, "Log in" button, "Register a new account" link |
| UI-02 | Register form validation | Open register; enter bad email, 5-char password, different confirm; leave fields | Messages: valid email, at least 8 characters, passwords do not match; Register does nothing |
| UI-03 | First registration → admin dashboard | Register first account | Lands on Dashboard "Welcome, <name>", role badge "admin", nav shows "Classes & Teachers" |
| UI-04 | Logout & protected pages | Log out; open `/attendance` directly | Back on login page; `/attendance` redirects to `/login` |
| UI-05 | Wrong password message | Log in with wrong password | "Invalid email or password" shown, stays on login |
| UI-06 | Assign teacher & add section | Register a teacher (other browser/after logout); as admin assign them to Grade 5-A; add Grade 5-B | Success messages; table shows teacher; new section listed |
| UI-07 | Manage students | Students page → Grade 5-A; add 3 students; mark one as left | Next roll number pre-filled; list updates; "Left school" badge; active count drops |
| UI-08 | Mark attendance | Mark Attendance → Grade 5-A today; "Mark all present"; set one L and one A; Save | Late gets current time; counters update live; "Attendance saved for N student(s)" |
| UI-09 | No future dates in pickers | Open date pickers on Mark Attendance / Late Check-in | Dates after today can't be picked |
| UI-10 | Late check-in | Late Check-in → class, student, time, reason → submit | Success message; student appears in "Late arrivals" list with time |
| UI-11 | Absent tracking & correction request | Absent Tracking → Grade 5-A; "Request correction" on an absence; pick Late + time + reason; submit | Summary table shows %; < 75% / 3+ absences in red; row shows "Pending review" |
| UI-12 | Review correction | As admin open Absent Corrections → Approve with note; switch filter to Approved | Success message; request listed as Approved with reviewer and note; Mark Attendance shows new status |
| UI-13 | Teacher view | Log in as the teacher | Only own classes in dropdowns/dashboard; no "Classes & Teachers" link; `/admin` redirects to dashboard |
| UI-14 | Dashboard | Dashboard as admin; change date; click "Mark" on a class | Totals match register; Mark opens that class/date |
| UI-15 | Phone layout | 375px wide window | ☰ toggles menu; tables scroll sideways inside cards; no page-wide horizontal scroll |
| UI-16 | Expired / invalid session | Edit `attendance.token` in localStorage to garbage; reload a page that loads data | Redirected to login |
