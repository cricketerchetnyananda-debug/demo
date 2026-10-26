import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { api, BASE_URL, ROOT, startApp, stopApp } from './helpers.mjs';

before(startApp);
after(stopApp);

const webBuilt = existsSync(join(ROOT, 'frontend', 'dist', 'school-attendance-web', 'browser', 'index.html'));

test('TC-SYS-01 health check works without login', async () => {
  const res = await api('GET', '/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.data, { status: 'ok' });
});

test('TC-SYS-02 unknown API route returns 404', async () => {
  assert.equal((await api('GET', '/does-not-exist')).status, 404);
});

test('TC-SYS-03 web page deep links serve the app', { skip: !webBuilt && 'frontend not built' }, async () => {
  const res = await fetch(`${BASE_URL}/attendance`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<app-root/);
});
