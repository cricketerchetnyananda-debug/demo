import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { api, messages, PASSWORD, startApp, stopApp } from './helpers.mjs';

before(startApp);
after(stopApp);

let adminToken;

test('TC-AUTH-01 first registered user becomes admin', async () => {
  const res = await api('POST', '/auth/register', { fullName: 'First Admin', email: 'first@example.test', password: PASSWORD });
  assert.equal(res.status, 201);
  assert.equal(res.data.user.role, 'admin');
  assert.ok(res.data.accessToken);
  adminToken = res.data.accessToken;
});

test('TC-AUTH-02 later users register as teachers', async () => {
  const res = await api('POST', '/auth/register', { fullName: 'Second User', email: 'second@example.test', password: PASSWORD });
  assert.equal(res.status, 201);
  assert.equal(res.data.user.role, 'teacher');
});

test('TC-AUTH-03 email is unique and case-insensitive', async () => {
  const res = await api('POST', '/auth/register', { fullName: 'Dup', email: 'FIRST@EXAMPLE.TEST', password: PASSWORD });
  assert.equal(res.status, 409);
  assert.match(messages(res), /already exists/);
});

test('TC-AUTH-04 registration input is validated', async () => {
  const res = await api('POST', '/auth/register', { fullName: '', email: 'not-an-email', password: 'short' });
  assert.equal(res.status, 400);
  const text = messages(res);
  assert.match(text, /Enter a valid email address/);
  assert.match(text, /Password must be at least 8 characters/);
  assert.match(text, /Full name is required/);
});

test('TC-AUTH-05 login with email and password', async () => {
  const res = await api('POST', '/auth/login', { email: 'SECOND@example.test', password: PASSWORD });
  assert.equal(res.status, 200);
  assert.ok(res.data.accessToken);
  assert.equal(res.data.user.email, 'second@example.test');
  assert.equal(res.data.user.role, 'teacher');
  assert.ok(!('passwordHash' in res.data.user));
});

test('TC-AUTH-06 wrong password is rejected', async () => {
  const res = await api('POST', '/auth/login', { email: 'second@example.test', password: 'wrong-password' });
  assert.equal(res.status, 401);
  assert.match(messages(res), /Invalid email or password/);
});

test('TC-AUTH-07 unknown email gets the same message', async () => {
  const res = await api('POST', '/auth/login', { email: 'nobody@example.test', password: PASSWORD });
  assert.equal(res.status, 401);
  assert.match(messages(res), /Invalid email or password/);
});

test('TC-AUTH-08 API requires login', async () => {
  assert.equal((await api('GET', '/classes')).status, 401);
});

test('TC-AUTH-09 tampered or garbage token is rejected', async () => {
  const tampered = adminToken.slice(0, -2) + (adminToken.endsWith('aa') ? 'bb' : 'aa');
  assert.equal((await api('GET', '/classes', undefined, tampered)).status, 401);
  assert.equal((await api('GET', '/classes', undefined, 'garbage')).status, 401);
});

test('TC-AUTH-10 current user endpoint', async () => {
  const res = await api('GET', '/auth/me', undefined, adminToken);
  assert.equal(res.status, 200);
  assert.equal(res.data.email, 'first@example.test');
  assert.equal(res.data.fullName, 'First Admin');
  assert.equal(res.data.role, 'admin');
});

test('TC-AUTH-11 cannot self-register as admin', async () => {
  const res = await api('POST', '/auth/register', {
    fullName: 'Sneaky',
    email: 'sneaky@example.test',
    password: PASSWORD,
    role: 'admin',
  });
  assert.equal(res.status, 400);
  const login = await api('POST', '/auth/login', { email: 'sneaky@example.test', password: PASSWORD });
  assert.equal(login.status, 401);
});
