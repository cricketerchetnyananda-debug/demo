import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { addStudent, api, createSchool, PASSWORD, startApp, stopApp, today } from './helpers.mjs';

let s;
before(async () => {
  await startApp();
  s = await createSchool();
});
after(stopApp);

const classesOf = async (token) => (await api('GET', '/classes', undefined, token)).data;

test('TC-CLASS-01 grades 1 to 10 are created automatically', async () => {
  const classes = await classesOf(s.admin.token);
  assert.equal(classes.length, 10);
  assert.deepEqual(classes.map((c) => `${c.grade}-${c.section}`), ['1-A', '2-A', '3-A', '4-A', '5-A', '6-A', '7-A', '8-A', '9-A', '10-A']);
});

test('TC-CLASS-02 teachers see only their classes', async () => {
  assert.deepEqual((await classesOf(s.teacherA.token)).map((c) => c.id), [s.grade5]);
  assert.deepEqual((await classesOf(s.teacherB.token)).map((c) => c.id), [s.grade6]);
});

test('TC-CLASS-03 only admin assigns class teachers', async () => {
  const byTeacher = await api('PATCH', `/classes/${s.grade6}/teacher`, { teacherId: s.teacherA.user.id }, s.teacherA.token);
  assert.equal(byTeacher.status, 403);

  assert.equal((await api('PATCH', `/classes/${s.grade6}/teacher`, { teacherId: null }, s.admin.token)).status, 200);
  assert.equal((await classesOf(s.teacherB.token)).length, 0);
  assert.equal((await api('PATCH', `/classes/${s.grade6}/teacher`, { teacherId: s.teacherB.user.id }, s.admin.token)).status, 200);
  assert.equal((await classesOf(s.teacherB.token)).length, 1);
});

test('TC-CLASS-04 assigning an unknown teacher fails', async () => {
  const res = await api('PATCH', `/classes/${s.grade5}/teacher`, { teacherId: 999999 }, s.admin.token);
  assert.equal(res.status, 400);
});

test('TC-CLASS-05 admin adds a section', async () => {
  const created = await api('POST', '/classes', { grade: 3, section: 'B' }, s.admin.token);
  assert.equal(created.status, 201);
  assert.equal((await api('POST', '/classes', { grade: 3, section: 'B' }, s.admin.token)).status, 409);
  assert.equal((await api('POST', '/classes', { grade: 11, section: 'A' }, s.admin.token)).status, 400);
  assert.equal((await api('POST', '/classes', { grade: 4, section: 'b' }, s.admin.token)).status, 400);
});

test('TC-CLASS-06 teachers cannot add classes', async () => {
  assert.equal((await api('POST', '/classes', { grade: 7, section: 'C' }, s.teacherA.token)).status, 403);
});

let isha;

test('TC-STU-01 teacher adds a student to own class', async () => {
  isha = await addStudent(s.teacherA.token, s.grade5, 4, 'Isha Rao');
  assert.equal(isha.classId, s.grade5);
  assert.equal(isha.active, true);
});

test('TC-STU-02 roll numbers are unique per class', async () => {
  const dup = await api('POST', `/classes/${s.grade5}/students`, { rollNumber: 1, fullName: 'Dup' }, s.teacherA.token);
  assert.equal(dup.status, 409);
  const otherClass = await api('POST', `/classes/${s.grade6}/students`, { rollNumber: 3, fullName: 'Tara Nair' }, s.teacherB.token);
  assert.equal(otherClass.status, 201);
});

test("TC-STU-03 teachers can't manage other classes' students", async () => {
  assert.equal((await api('GET', `/classes/${s.grade6}/students`, undefined, s.teacherA.token)).status, 403);
  assert.equal(
    (await api('POST', `/classes/${s.grade6}/students`, { rollNumber: 9, fullName: 'X' }, s.teacherA.token)).status,
    403,
  );
  assert.equal(
    (await api('PATCH', `/students/${s.students.meera.id}`, { fullName: 'Changed' }, s.teacherA.token)).status,
    403,
  );
});

test('TC-STU-04 a student who left is excluded', async () => {
  const res = await api('PATCH', `/students/${isha.id}`, { active: false }, s.teacherA.token);
  assert.equal(res.status, 200);
  assert.equal(res.data.active, false);

  const reg = await api('GET', `/attendance/register?classId=${s.grade5}&date=${today()}`, undefined, s.teacherA.token);
  assert.ok(!reg.data.entries.some((e) => e.studentId === isha.id));
  const grade5 = (await classesOf(s.admin.token)).find((c) => c.id === s.grade5);
  assert.equal(grade5.studentCount, 3);
});

test('TC-STU-05 student input is validated', async () => {
  const post = (body) => api('POST', `/classes/${s.grade5}/students`, body, s.teacherA.token);
  assert.equal((await post({ rollNumber: 0, fullName: 'Zero' })).status, 400);
  assert.equal((await post({ rollNumber: 10, fullName: '' })).status, 400);
  assert.equal((await post({ rollNumber: 11, fullName: 'Extra', classId: s.grade6 })).status, 400);
});

test("TC-STU-06 can't change roll to a used number", async () => {
  const res = await api('PATCH', `/students/${s.students.kabir.id}`, { rollNumber: 1 }, s.teacherA.token);
  assert.equal(res.status, 409);
});

test('TC-ADMIN-01 only admin lists users', async () => {
  assert.equal((await api('GET', '/users', undefined, s.teacherA.token)).status, 403);
  const res = await api('GET', '/users', undefined, s.admin.token);
  assert.equal(res.status, 200);
  assert.equal(res.data.length, 3);
  assert.ok(res.data.every((u) => !('passwordHash' in u)));
});

test('TC-ADMIN-02 admin promotes a teacher', async () => {
  const res = await api('PATCH', `/users/${s.teacherB.user.id}/role`, { role: 'admin' }, s.admin.token);
  assert.equal(res.status, 200);
  assert.equal(res.data.role, 'admin');
  // The old token still carries the teacher role until Teacher B logs in again.
  assert.equal((await api('GET', '/users', undefined, s.teacherB.token)).status, 403);
  const login = await api('POST', '/auth/login', { email: 'teacher.b@example.test', password: PASSWORD });
  assert.equal(login.data.user.role, 'admin');
  assert.equal((await api('GET', '/users', undefined, login.data.accessToken)).status, 200);
});

test("TC-ADMIN-03 admin can't remove own admin role", async () => {
  const res = await api('PATCH', `/users/${s.admin.user.id}/role`, { role: 'teacher' }, s.admin.token);
  assert.equal(res.status, 400);
});
