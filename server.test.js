const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
test('RSVP validation, persistence, retry deduplication and private data', async () => {
  const dir = fs.mkdtempSync(path.join(__dirname, '.test-data-'));
  let child;
  const password = randomUUID();
  async function start() {
    child = spawn(process.execPath, ['server.js'], { cwd: __dirname, env: { ...process.env, NODE_ENV: 'test', ADMIN_PASSWORD: password, PORT: '0', DATA_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] });
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Startup timeout')), 5000);
      child.stdout.once('data', data => { clearTimeout(timer); resolve(data.toString().match(/http:\/\/localhost:\d+/)[0]); });
      child.once('error', reject);
    });
  }
  async function stop() { if (child && child.exitCode === null) await new Promise(resolve => { child.once('exit', resolve); child.kill(); }); }
  try {
    let url = await start();
    const payload = { id: randomUUID(), name: 'Тест қонақ', attendance: 'yes', count: 2, companions: 'Қонақ' };
    const post = body => fetch(url + '/api/rsvp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await fetch(url)).status, 200);
    assert.equal((await fetch(url + '/media.css')).status, 200);
    const range = await fetch(url + '/assets/wedding-rings.png', { headers: { Range: 'bytes=0-7' } });
    assert.equal(range.status, 206);
    assert.equal((await range.arrayBuffer()).byteLength, 8);
    assert.equal((await fetch(url + '/assets/wedding-rings.png', { headers: { Range: 'bytes=999999999-' } })).status, 416);
    for (const image of ['wedding-rings.png', 'wedding-hands.png', 'wedding-table.png']) {
      const response = await fetch(url + '/assets/' + image);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'image/png');
      const bytes = new Uint8Array(await response.arrayBuffer());
      assert.deepEqual([...bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    }
    assert.equal((await post({ ...payload, count: 0 })).status, 400);
    assert.equal((await (await post(payload)).json()).saved, true);
    await Promise.all([post(payload), post(payload)]);
    for (const file of ['/data/guests.jsonl', '/server.js', '/.env', '/export-guests.js', '/assets/../data/guests.jsonl']) assert.equal((await fetch(url + file)).status, 404);
    await stop(); url = await start();
    assert.equal((await post(payload)).status, 200);
    assert.equal((await post({ ...payload, id: randomUUID(), attendance: 'no', count: 0 })).status, 200);
    const records = fs.readFileSync(path.join(dir, 'guests.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(records.length, 2);
    assert.equal(records[0].name, payload.name);
    assert.equal(records[1].companions, '');
    assert.equal((await fetch(url + '/api/admin/guests')).status, 401);
    const login = value => fetch(url + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: value }) });
    assert.equal((await login('incorrect')).status, 401);
    const auth = await login(password);
    assert.equal(auth.status, 200);
    assert.ok(auth.headers.get('set-cookie').includes('HttpOnly'));
    const cookie = auth.headers.get('set-cookie').split(';')[0];
    const list = await fetch(url + '/api/admin/guests', { headers: { Cookie: cookie } });
    assert.equal(list.status, 200);
    assert.equal((await list.json()).guests.length, 2);
    const logout = await fetch(url + '/api/admin/logout', { method: 'POST', headers: { Cookie: cookie } });
    assert.equal(logout.status, 200);
    assert.equal((await fetch(url + '/api/admin/guests', { headers: { Cookie: cookie } })).status, 401);
    for (let attempt = 0; attempt < 10; attempt++) assert.equal((await login('incorrect')).status, 401);
    assert.equal((await login(password)).status, 429);
    for (const asset of ['/assets/audio/music%20(2).mp3', '/assets/video/background.mp4']) {
      const response = await fetch(url + asset, { headers: { Range: 'bytes=0-31' } });
      assert.equal(response.status, 206);
      assert.equal((await response.arrayBuffer()).byteLength, 32);
    }
    const exported = spawnSync(process.execPath, ['export-guests.js'], { cwd: __dirname, env: { ...process.env, DATA_DIR: dir }, encoding: 'utf8' });
    assert.equal(exported.status, 0);
    const csv = fs.readFileSync(path.join(dir, 'guests.csv'), 'utf8');
    assert.ok(csv.includes(payload.name));
    assert.equal(csv.split('\r\n').length, 3);
  } finally {
    await stop();
    for (const file of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, file));
    fs.rmdirSync(dir);
  }
});
