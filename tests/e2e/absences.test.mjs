import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { api, createSchool, daysFromToday, messages, saveRegister, startApp, stopApp, today } from './helpers.mjs';

let s;
const D2 = daysFromToday(-2);
const D1 = daysFromToday(-1);
const recordIds = {};

before(async () => {
  await startApp();
  s = await createSchool();
  const { aarav, diya, kabir, meera, rohan } = s.students;
  const A = s.teacherA.token;
  await saveRegister(A, s.grade5, D2, [
    { studentId: aarav.id, status: 'absent' },
    { studentId: diya.id, status: 'present' },
    { studentId: kabir.id, status: 'present' },
  ]);
  await saveRegister(A, s.grade5, D1, [
    { studentId: aarav.id, status: 'absent' },
    { studentId: diya.id, status: 'absent' },
    { studentId: kabir.id, status: 'late', checkInTime: '09:15' },
  ]);
  await saveRegister(A, s.grade5, today(), [
    { studentId: aarav.id, status: 'absent' },
    { studentId: diya.id, status: 'present' },
    { studentId: kabir.id, status: 'present' },
  ]);
  await saveRegister(s.teacherB.token, s.grade6, today(), [
    { studentId: meera.id, status: 'absent' },
    { studentId: rohan.id, status: 'present' },
  ]);

  const all = (await api('GET', `/attendance/records?from=${D2}&to=${today()}`, undefined, s.admin.token)).data;
  const find = (student, date) => all.find((r) => r.student.id === student.id && r.date === date).id;
  recordIds.aaravToday = find(aarav, today());
  recordIds.aaravD1 = find(aarav, D1);
  recordIds.diyaD1 = find(diya, D1);
  recordIds.kabirToday = find(kabir, today());
  recordIds.meeraToday = find(meera, today());
});
after(stopApp);

const absences = (token, query) => api('GET', `/attendance/records?status=absent&${query}`, undefined, token);
const registerEntry = async (date, student) =>
  (await api('GET', `/attendance/register?classId=${s.grade5}&date=${date}`, undefined, s.teacherA.token)).data.entries.find(
    (e) => e.studentId === student.id,
  );

test('TC-ABS-01 absence list by class and date range', async () => {
  const res = await absences(s.teacherA.token, `classId=${s.grade5}&from=${D2}&to=${today()}`);
  assert.equal(res.status, 200);
  assert.equal(res.data.length, 4);
  assert.deepEqual(res.data.map((r) => r.date), [today(), D1, D1, D2]);
  assert.ok(res.data.every((r) => r.status === 'absent' && r.class.id === s.grade5));

  const oneDay = await absences(s.teacherA.token, `classId=${s.grade5}&from=${D1}&to=${D1}`);
  assert.deepEqual(oneDay.data.map((r) => r.student.fullName).sort(), ['Aarav Sharma', 'Diya Patel']);
});

test('TC-ABS-02 absence list respects class access', async () => {
  const teacher = await absences(s.teacherA.token, `from=${D2}&to=${today()}`);
  assert.equal(teacher.data.length, 4);
  assert.ok(!teacher.data.some((r) => r.student.fullName === 'Meera Iyer'));
  const admin = await absences(s.admin.token, `from=${D2}&to=${today()}`);
  assert.equal(admin.data.length, 5);
  assert.ok(admin.data.some((r) => r.student.fullName === 'Meera Iyer'));
});

test('TC-ABS-03 attendance summary and percentage', async () => {
  const res = await api('GET', `/attendance/summary?classId=${s.grade5}&from=${D2}&to=${today()}`, undefined, s.teacherA.token);
  assert.equal(res.status, 200);
  const row = (name) => res.data.find((r) => r.fullName === name);
  assert.deepEqual(
    [row('Aarav Sharma'), row('Diya Patel'), row('Kabir Singh')].map((r) => [r.present, r.late, r.absent, r.markedDays, r.percentage]),
    [[0, 0, 3, 3, 0], [2, 0, 1, 3, 66.7], [2, 1, 0, 3, 100]],
  );

  const empty = await api(
    'GET',
    `/attendance/summary?classId=${s.grade5}&from=${daysFromToday(-30)}&to=${daysFromToday(-20)}`,
    undefined,
    s.teacherA.token,
  );
  assert.ok(empty.data.every((r) => r.markedDays === 0 && r.percentage === null));
});

test('TC-ABS-04 date range is validated', async () => {
  assert.equal((await absences(s.teacherA.token, `from=${today()}&to=${D2}`)).status, 400);
  assert.equal((await absences(s.teacherA.token, `from=${daysFromToday(-400)}&to=${today()}`)).status, 400);
  assert.equal((await api('GET', `/attendance/summary?from=${D2}&to=${today()}`, undefined, s.admin.token)).status, 400);
});

test("TC-ABS-05 teachers can't track other classes", async () => {
  const summary = await api('GET', `/attendance/summary?classId=${s.grade6}&from=${D2}&to=${today()}`, undefined, s.teacherA.token);
  assert.equal(summary.status, 403);
  assert.equal((await absences(s.teacherA.token, `classId=${s.grade6}&from=${D2}&to=${today()}`)).status, 403);
});

const request = (token, body) => api('POST', '/corrections', body, token);
const review = (token, id, decision, note) => api('PATCH', `/corrections/${id}/review`, { decision, note }, token);
const corrections = {};

test('TC-CORR-01 teacher requests absent to present', async () => {
  const res = await request(s.teacherA.token, {
    attendanceRecordId: recordIds.aaravToday,
    requestedStatus: 'present',
    reason: 'Was in the library during roll call',
  });
  assert.equal(res.status, 201);
  assert.equal(res.data.status, 'pending');
  assert.equal(res.data.originalStatus, 'absent');
  corrections.aaravToday = res.data.id;

  const list = await absences(s.teacherA.token, `classId=${s.grade5}&from=${today()}&to=${today()}`);
  assert.equal(list.data.find((r) => r.id === recordIds.aaravToday).pendingCorrection, true);
});

test('TC-CORR-02 absent to late needs a time', async () => {
  const body = { attendanceRecordId: recordIds.aaravD1, requestedStatus: 'late', reason: 'Signed in at reception' };
  assert.equal((await request(s.teacherA.token, body)).status, 400);
  const res = await request(s.teacherA.token, { ...body, requestedCheckInTime: '09:40' });
  assert.equal(res.status, 201);
  assert.equal(res.data.requestedCheckInTime, '09:40');
  corrections.aaravD1 = res.data.id;
});

test('TC-CORR-03 only absences can be corrected', async () => {
  const res = await request(s.teacherA.token, { attendanceRecordId: recordIds.kabirToday, requestedStatus: 'late', requestedCheckInTime: '09:00', reason: 'x' });
  assert.equal(res.status, 400);
  assert.match(messages(res), /Only absences can be corrected/);
});

test('TC-CORR-04 one pending request per absence', async () => {
  const res = await request(s.teacherA.token, { attendanceRecordId: recordIds.aaravToday, requestedStatus: 'present', reason: 'again' });
  assert.equal(res.status, 409);
});

test("TC-CORR-05 teachers can't approve", async () => {
  assert.equal((await review(s.teacherA.token, corrections.aaravToday, 'approved')).status, 403);
});

test('TC-CORR-06 approval updates attendance', async () => {
  const res = await review(s.admin.token, corrections.aaravToday, 'approved', 'Verified with librarian');
  assert.equal(res.status, 200);
  assert.equal(res.data.status, 'approved');
  assert.equal(res.data.reviewedBy, 'Admin User');
  assert.equal(res.data.reviewNote, 'Verified with librarian');
  const todayEntry = await registerEntry(today(), s.students.aarav);
  assert.equal(todayEntry.status, 'present');
  assert.match(todayEntry.remarks, /^Corrected from absent/);

  assert.equal((await review(s.admin.token, corrections.aaravD1, 'approved')).status, 200);
  const d1Entry = await registerEntry(D1, s.students.aarav);
  assert.deepEqual([d1Entry.status, d1Entry.checkInTime], ['late', '09:40']);
});

test('TC-CORR-07 rejection leaves attendance unchanged', async () => {
  const created = await request(s.teacherA.token, { attendanceRecordId: recordIds.diyaD1, requestedStatus: 'present', reason: 'Parent says she came' });
  assert.equal(created.status, 201);
  corrections.diyaD1 = created.data.id;
  const res = await review(s.admin.token, corrections.diyaD1, 'rejected', 'No sign-in record');
  assert.equal(res.status, 200);
  assert.deepEqual([res.data.status, res.data.reviewNote], ['rejected', 'No sign-in record']);
  assert.equal((await registerEntry(D1, s.students.diya)).status, 'absent');
});

test("TC-CORR-08 can't review twice", async () => {
  assert.equal((await review(s.admin.token, corrections.aaravToday, 'rejected')).status, 400);
});

test('TC-CORR-09 new request allowed after rejection', async () => {
  const res = await request(s.teacherA.token, { attendanceRecordId: recordIds.diyaD1, requestedStatus: 'present', reason: 'Found sign-in sheet' });
  assert.equal(res.status, 201);
  assert.equal(res.data.status, 'pending');
});

test('TC-CORR-10 correction list filters and access', async () => {
  const meera = await request(s.teacherB.token, { attendanceRecordId: recordIds.meeraToday, requestedStatus: 'present', reason: 'Sports practice' });
  assert.equal(meera.status, 201);

  const teacherAll = (await api('GET', '/corrections', undefined, s.teacherA.token)).data;
  assert.equal(teacherAll.length, 4);
  assert.ok(!teacherAll.some((c) => c.student.fullName === 'Meera Iyer'));

  const pending = (await api('GET', '/corrections?status=pending', undefined, s.teacherA.token)).data;
  assert.equal(pending.length, 1);
  assert.ok(pending.every((c) => c.status === 'pending'));

  const adminAll = (await api('GET', '/corrections', undefined, s.admin.token)).data;
  assert.equal(adminAll.length, 5);
  assert.ok(adminAll.some((c) => c.student.fullName === 'Meera Iyer'));
});

test("TC-CORR-11 teachers can't correct other classes", async () => {
  const res = await request(s.teacherA.token, { attendanceRecordId: recordIds.meeraToday, requestedStatus: 'present', reason: 'x' });
  assert.equal(res.status, 403);
});

test('TC-CORR-12 correction input is validated', async () => {
  const base = { attendanceRecordId: recordIds.aaravD1 };
  assert.equal((await request(s.teacherA.token, { ...base, requestedStatus: 'present', reason: '' })).status, 400);
  assert.equal((await request(s.teacherA.token, { ...base, requestedStatus: 'absent', reason: 'x' })).status, 400);
});

test('TC-CORR-13 unknown ids return 404', async () => {
  assert.equal((await request(s.teacherA.token, { attendanceRecordId: 999999, requestedStatus: 'present', reason: 'x' })).status, 404);
  assert.equal((await review(s.admin.token, 999999, 'approved')).status, 404);
});
