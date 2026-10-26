// Shared setup for the end-to-end API tests: resets the TEST database, starts the built API, and builds test data.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { Client } = createRequire(join(ROOT, 'backend', 'package.json'))('pg');

const PORT = Number(process.env.E2E_PORT ?? 3101);
export const BASE_URL = `http://localhost:${PORT}`;
/** Random password shared by every test account in a run. */
export const PASSWORD = randomBytes(12).toString('base64url');

let server;

function testDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const file = join(ROOT, 'backend', '.env.test');
  if (existsSync(file)) {
    const line = readFileSync(file, 'utf8')
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .find((l) => l.startsWith('TEST_DATABASE_URL='));
    if (line) return line.slice('TEST_DATABASE_URL='.length).trim();
  }
  throw new Error('TEST_DATABASE_URL is not set (environment variable or backend/.env.test)');
}

/** Wipes the test database and starts the API on it. Use as `before(startApp)`. */
export async function startApp() {
  const url = testDatabaseUrl();
  if (!/test/i.test(new URL(url).pathname)) {
    throw new Error(`Refusing to reset database "${new URL(url).pathname}": its name must contain "test"`);
  }
  const db = new Client({ connectionString: url });
  await db.connect();
  await db.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
  await db.end();

  const main = join(ROOT, 'backend', 'dist', 'main.js');
  if (!existsSync(main)) throw new Error('backend/dist/main.js not found - run "npm run build --prefix backend" first');
  server = spawn(process.execPath, [main], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: url, PORT: String(PORT), JWT_SECRET: 'e2e-test-secret', DB_SYNC: 'true', DB_SSL: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  server.stdout.on('data', (d) => (output += d));
  server.stderr.on('data', (d) => (output += d));

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`API exited during startup:\n${output}`);
    try {
      if ((await fetch(`${BASE_URL}/api/health`)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`API did not start within 30s:\n${output}`);
}

/** Stops the API started by startApp. Use as `after(stopApp)`. */
export async function stopApp() {
  if (server && server.exitCode === null) {
    const exited = new Promise((r) => server.once('exit', r));
    server.kill();
    await exited;
  }
}

/** Calls the API (path without the /api prefix). Returns { status, data }. */
export async function api(method, path, body, token) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

/** Error message(s) from a 4xx response as one string, for assert.match. */
export const messages = (res) => [res.data?.message].flat().join(' | ');

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => iso(new Date());
export function daysFromToday(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
}

export async function register(fullName, email) {
  const res = await api('POST', '/auth/register', { fullName, email, password: PASSWORD });
  assert.equal(res.status, 201, `register ${email}: ${JSON.stringify(res.data)}`);
  return { token: res.data.accessToken, user: res.data.user };
}

export async function addStudent(token, classId, rollNumber, fullName) {
  const res = await api('POST', `/classes/${classId}/students`, { rollNumber, fullName }, token);
  assert.equal(res.status, 201, `add student ${fullName}: ${JSON.stringify(res.data)}`);
  return res.data;
}

export async function saveRegister(token, classId, date, entries) {
  const res = await api('PUT', '/attendance/register', { classId, date, entries }, token);
  assert.equal(res.status, 200, `save register ${date}: ${JSON.stringify(res.data)}`);
  return res.data;
}

/**
 * Standard school used by most test files (see docs/test-cases.md):
 * admin, Teacher A on Grade 5-A (Aarav, Diya, Kabir), Teacher B on Grade 6-A (Meera, Rohan).
 */
export async function createSchool() {
  const admin = await register('Admin User', 'admin@example.test');
  const teacherA = await register('Teacher A', 'teacher.a@example.test');
  const teacherB = await register('Teacher B', 'teacher.b@example.test');

  const classes = (await api('GET', '/classes', undefined, admin.token)).data;
  const grade5 = classes.find((c) => c.grade === 5).id;
  const grade6 = classes.find((c) => c.grade === 6).id;
  for (const [classId, teacher] of [[grade5, teacherA], [grade6, teacherB]]) {
    const res = await api('PATCH', `/classes/${classId}/teacher`, { teacherId: teacher.user.id }, admin.token);
    assert.equal(res.status, 200);
  }

  const aarav = await addStudent(teacherA.token, grade5, 1, 'Aarav Sharma');
  const diya = await addStudent(teacherA.token, grade5, 2, 'Diya Patel');
  const kabir = await addStudent(teacherA.token, grade5, 3, 'Kabir Singh');
  const meera = await addStudent(teacherB.token, grade6, 1, 'Meera Iyer');
  const rohan = await addStudent(teacherB.token, grade6, 2, 'Rohan Das');

  return { admin, teacherA, teacherB, grade5, grade6, students: { aarav, diya, kabir, meera, rohan } };
}
