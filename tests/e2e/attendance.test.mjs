import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { addStudent, api, createSchool, daysFromToday, messages, saveRegister, startApp, stopApp, today } from './helpers.mjs';

let s;
before(async () => {
  await startApp();
  s = await createSchool();
});
after(stopApp);

const getRegister = (token, classId, date) =>
  api('GET', `/attendance/register?classId=${classId}&date=${date}`, undefined, token);
const entryOf = (register, student) => register.entries.find((e) => e.studentId === student.id);

test('TC-ATT-01 empty register lists students by roll number', async () => {
  const res = await getRegister(s.teacherA.token, s.grade5, today());
  assert.equal(res.status, 200);
  assert.deepEqual(res.data.entries.map((e) => e.rollNumber), [1, 2, 3]);
  assert.ok(res.data.entries.every((e) => e.status === null));
});

test("TC-ATT-02 save the day's register", async () => {
  const { aarav, diya, kabir } = s.students;
  await saveRegister(s.teacherA.token, s.grade5, today(), [
    { studentId: aarav.id, status: 'present', checkInTime: '08:00' },
    { studentId: diya.id, status: 'absent', remarks: 'Sick' },
    { studentId: kabir.id, status: 'late', checkInTime: '09:10' },
  ]);
  const reg = (await getRegister(s.teacherA.token, s.grade5, today())).data;
  assert.deepEqual(
    [entryOf(reg, aarav), entryOf(reg, diya), entryOf(reg, kabir)].map((e) => [e.status, e.checkInTime, e.remarks]),
    [['present', '08:00', null], ['absent', null, 'Sick'], ['late', '09:10', null]],
  );
});

test('TC-ATT-03 re-saving updates and never duplicates', async () => {
  await saveRegister(s.teacherA.token, s.grade5, today(), [{ studentId: s.students.aarav.id, status: 'absent' }]);
  const reg = (await getRegister(s.teacherA.token, s.grade5, today())).data;
  assert.equal(entryOf(reg, s.students.aarav).status, 'absent');
  assert.equal(entryOf(reg, s.students.diya).status, 'absent');
  assert.equal(entryOf(reg, s.students.kabir).status, 'late');
  const records = await api('GET', `/attendance/records?classId=${s.grade5}&from=${today()}&to=${today()}`, undefined, s.teacherA.token);
  assert.equal(records.data.length, 3);
});

test('TC-ATT-04 absent clears the check-in time', async () => {
  await saveRegister(s.teacherA.token, s.grade5, today(), [{ studentId: s.students.aarav.id, status: 'absent', checkInTime: '08:00' }]);
  const reg = (await getRegister(s.teacherA.token, s.grade5, today())).data;
  assert.equal(entryOf(reg, s.students.aarav).checkInTime, null);
});

test('TC-ATT-05 no future dates', async () => {
  const entries = [{ studentId: s.students.aarav.id, status: 'present' }];
  const future = await api('PUT', '/attendance/register', { classId: s.grade5, date: daysFromToday(1), entries }, s.teacherA.token);
  assert.equal(future.status, 400);
  assert.match(messages(future), /future date/);
  const past = await api('PUT', '/attendance/register', { classId: s.grade5, date: daysFromToday(-1), entries }, s.teacherA.token);
  assert.equal(past.status, 200);
});

test('TC-ATT-06 students must belong to the class', async () => {
  const res = await api(
    'PUT',
    '/attendance/register',
    { classId: s.grade5, date: today(), entries: [{ studentId: s.students.meera.id, status: 'present' }] },
    s.admin.token,
  );
  assert.equal(res.status, 400);
});

test('TC-ATT-07 no duplicate students in one save', async () => {
  const id = s.students.aarav.id;
  const res = await api(
    'PUT',
    '/attendance/register',
    { classId: s.grade5, date: today(), entries: [{ studentId: id, status: 'present' }, { studentId: id, status: 'absent' }] },
    s.teacherA.token,
  );
  assert.equal(res.status, 400);
});

test('TC-ATT-08 register input is validated', async () => {
  const id = s.students.aarav.id;
  const put = (body) => api('PUT', '/attendance/register', { classId: s.grade5, date: today(), ...body }, s.teacherA.token);
  assert.equal((await put({ entries: [{ studentId: id, status: 'holiday' }] })).status, 400);
  assert.equal((await put({ date: '25-10-2026', entries: [{ studentId: id, status: 'present' }] })).status, 400);
  assert.equal((await put({ entries: [{ studentId: id, status: 'late', checkInTime: '25:00' }] })).status, 400);
  assert.equal((await put({ entries: [] })).status, 400);
});

test("TC-ATT-09 teachers can't mark other classes", async () => {
  assert.equal((await getRegister(s.teacherA.token, s.grade6, today())).status, 403);
  const res = await api(
    'PUT',
    '/attendance/register',
    { classId: s.grade6, date: today(), entries: [{ studentId: s.students.meera.id, status: 'present' }] },
    s.teacherA.token,
  );
  assert.equal(res.status, 403);
});

test('TC-LATE-01 late check-in without an earlier mark', async () => {
  const res = await api(
    'POST',
    '/attendance/late-checkin',
    { studentId: s.students.aarav.id, date: daysFromToday(-3), checkInTime: '09:30' },
    s.teacherA.token,
  );
  assert.equal(res.status, 201);
  assert.equal(res.data.status, 'late');
  assert.equal(res.data.checkInTime, '09:30');
});

test('TC-LATE-02 late check-in replaces an absence', async () => {
  const res = await api(
    'POST',
    '/attendance/late-checkin',
    { studentId: s.students.diya.id, date: today(), checkInTime: '09:45', remarks: 'Bus late' },
    s.teacherA.token,
  );
  assert.equal(res.status, 201);
  const diya = entryOf((await getRegister(s.teacherA.token, s.grade5, today())).data, s.students.diya);
  assert.deepEqual([diya.status, diya.checkInTime, diya.remarks], ['late', '09:45', 'Bus late']);
});

test('TC-LATE-03 arrival time is required and valid', async () => {
  const post = (extra) =>
    api('POST', '/attendance/late-checkin', { studentId: s.students.kabir.id, date: today(), ...extra }, s.teacherA.token);
  assert.equal((await post({})).status, 400);
  assert.equal((await post({ checkInTime: '9:5' })).status, 400);
});

test('TC-LATE-04 no future late check-ins', async () => {
  const res = await api(
    'POST',
    '/attendance/late-checkin',
    { studentId: s.students.kabir.id, date: daysFromToday(1), checkInTime: '09:00' },
    s.teacherA.token,
  );
  assert.equal(res.status, 400);
});

test('TC-LATE-05 not for students who left', async () => {
  const left = await addStudent(s.teacherA.token, s.grade5, 9, 'Left Student');
  await api('PATCH', `/students/${left.id}`, { active: false }, s.teacherA.token);
  const res = await api('POST', '/attendance/late-checkin', { studentId: left.id, date: today(), checkInTime: '09:00' }, s.teacherA.token);
  assert.equal(res.status, 400);
});

test("TC-LATE-06 teachers can't check in other classes", async () => {
  const res = await api(
    'POST',
    '/attendance/late-checkin',
    { studentId: s.students.meera.id, date: today(), checkInTime: '09:00' },
    s.teacherA.token,
  );
  assert.equal(res.status, 403);
});

test('TC-LATE-07 late list for the day', async () => {
  const res = await api(
    'GET',
    `/attendance/records?classId=${s.grade5}&from=${today()}&to=${today()}&status=late`,
    undefined,
    s.teacherA.token,
  );
  assert.equal(res.status, 200);
  const rows = res.data.map((r) => [r.student.fullName, r.checkInTime, r.remarks]).sort();
  assert.deepEqual(rows, [['Diya Patel', '09:45', 'Bus late'], ['Kabir Singh', '09:10', null]]);
});

test('TC-DASH-01 dashboard counts per class', async () => {
  const res = await api('GET', `/attendance/overview?date=${today()}`, undefined, s.admin.token);
  assert.equal(res.status, 200);
  const g5 = res.data.find((c) => c.classId === s.grade5);
  assert.deepEqual(
    { total: g5.total, present: g5.present, late: g5.late, absent: g5.absent, unmarked: g5.unmarked, teacher: g5.teacherName },
    { total: 3, present: 0, late: 2, absent: 1, unmarked: 0, teacher: 'Teacher A' },
  );
  const g6 = res.data.find((c) => c.classId === s.grade6);
  assert.equal(g6.unmarked, 2);
});

test('TC-DASH-02 teacher dashboard shows only own classes', async () => {
  const res = await api('GET', `/attendance/overview?date=${today()}`, undefined, s.teacherA.token);
  assert.deepEqual(res.data.map((c) => c.classId), [s.grade5]);
});

test('TC-DASH-03 dashboard date is validated', async () => {
  assert.equal((await api('GET', '/attendance/overview?date=today', undefined, s.admin.token)).status, 400);
});
