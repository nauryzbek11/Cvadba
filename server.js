'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, randomBytes, createHash, timingSafeEqual } = require('node:crypto');
const root = __dirname;
if (fs.existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'));
const adminPassword = process.env.ADMIN_PASSWORD;
if (process.env.NODE_ENV === 'production' && !adminPassword) throw new Error('Set ADMIN_PASSWORD before starting the server');
const sessions = new Map();
const loginAttempts = new Map();
const digest = value => createHash('sha256').update(value).digest();
const readGuests = () => fs.existsSync(dataFile) ? fs.readFileSync(dataFile, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
setInterval(() => {
  for (const [key, expires] of sessions) if (expires < Date.now()) sessions.delete(key);
  for (const [key, attempt] of loginAttempts) if (attempt.until < Date.now()) loginAttempts.delete(key);
}, 60000).unref();
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));
fs.mkdirSync(dataDir, { recursive: true });
const dataFile = path.join(dataDir, 'guests.jsonl');
const ids = new Set();
if (fs.existsSync(dataFile)) {
  for (const line of fs.readFileSync(dataFile, 'utf8').split('\n').filter(Boolean)) ids.add(JSON.parse(line).id);
}
const publicFiles = new Set(['index.html', 'styles.css', 'envelope.css', 'media.css', 'admin.css', 'admin.js', 'app.js', 'wedding.js']);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
function reply(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
function validate(input) {
  return input && typeof input.name === 'string' && input.name.trim().length > 0 && input.name.length <= 120 &&
    ['yes', 'no'].includes(input.attendance) && Number.isInteger(input.count) &&
    (input.attendance === 'yes' ? input.count >= 1 && input.count <= 20 : input.count === 0) &&
    typeof input.companions === 'string' && input.companions.length <= 400 &&
    (input.id === undefined || (typeof input.id === 'string' && /^[a-f0-9-]{36}$/i.test(input.id)));
}
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { return reply(res, 400, { error: 'Invalid URL' }); }
  if (pathname === '/health') return reply(res, 200, { ok: true });
  if (pathname.startsWith('/api/admin/')) {
    if (req.headers['sec-fetch-site'] === 'cross-site') return reply(res, 403, { error: 'Cross-site request' });
    const token = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('wedding_admin='))?.slice(14);
    const cookie = value => `wedding_admin=${value}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${value ? 28800 : 0}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
    if (pathname === '/api/admin/login' && req.method === 'POST') {
      if (!adminPassword) return reply(res, 503, { error: 'Admin access is not configured' });
      if (!(req.headers['content-type'] || '').startsWith('application/json')) return reply(res, 415, { error: 'JSON required' });
      // On Render, the final proxy address is appended to X-Forwarded-For.
      const ip = process.env.RENDER ? (req.headers['x-forwarded-for'] || '').split(',').pop().trim() || req.socket.remoteAddress : req.socket.remoteAddress;
      let attempts = loginAttempts.get(ip);
      if (!attempts || attempts.until <= Date.now()) { attempts = { count: 0, until: Date.now() + 15 * 60000 }; loginAttempts.set(ip, attempts); }
      if (attempts.count >= 10) return reply(res, 429, { error: 'Too many attempts' });
      attempts.count++;
      try {
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 2048) return reply(res, 413, { error: 'Request too large' }); chunks.push(chunk); }
        const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (typeof input.password !== 'string' || !timingSafeEqual(digest(input.password), digest(adminPassword))) return reply(res, 401, { error: 'Invalid password' });
        loginAttempts.delete(ip);
        if (token) sessions.delete(token);
        const session = randomBytes(32).toString('hex'); sessions.set(session, Date.now() + 8 * 3600000);
        res.setHeader('Set-Cookie', cookie(session));
        return reply(res, 200, { ok: true });
      } catch { return reply(res, 400, { error: 'Invalid request' }); }
    }
    if (pathname === '/api/admin/logout' && req.method === 'POST') { sessions.delete(token); res.setHeader('Set-Cookie', cookie('')); return reply(res, 200, { ok: true }); }
    if (!token || !(sessions.get(token) > Date.now())) return reply(res, 401, { error: 'Login required' });
    if (pathname === '/api/admin/guests' && req.method === 'GET') {
      try { return reply(res, 200, { guests: readGuests().reverse() }); } catch { return reply(res, 500, { error: 'Could not read responses' }); }
    }
    return reply(res, 404, { error: 'Not found' });
  }
  if (pathname === '/api/rsvp') {
    if (req.method !== 'POST') return reply(res, 405, { error: 'POST required' });
    if (req.headers['sec-fetch-site'] === 'cross-site') return reply(res, 403, { error: 'Cross-site request' });
    if (!(req.headers['content-type'] || '').startsWith('application/json')) return reply(res, 415, { error: 'JSON required' });
    try {
      let size = 0; const chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 8192) { reply(res, 413, { error: 'Request too large' }); return; } chunks.push(chunk); }
      let input;
      try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return reply(res, 400, { error: 'Invalid JSON' }); }
      if (!validate(input)) return reply(res, 400, { error: 'Invalid response' });
      const id = input.id || randomUUID();
      if (!ids.has(id)) {
        const record = { id, receivedAt: new Date().toISOString(), name: input.name.trim(), attendance: input.attendance, count: input.count, companions: input.attendance === 'yes' && input.count > 1 ? input.companions.trim() : '' };
        const fd = fs.openSync(dataFile, 'a', 0o600);
        try { fs.writeFileSync(fd, JSON.stringify(record) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
        ids.add(id);
      }
      return reply(res, 200, { saved: true, id });
    } catch { return reply(res, 500, { error: 'Could not save response' }); }
  }
  if (!['GET', 'HEAD'].includes(req.method)) return reply(res, 405, { error: 'Method not allowed' });
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const asset = relative.startsWith('assets/') && relative.split('/').every(segment => segment && segment !== '.' && segment !== '..' && !segment.startsWith('.')) && !relative.includes('\\') && Boolean(types[path.extname(relative).toLowerCase()]);
  if (!publicFiles.has(relative) && !asset) return reply(res, 404, { error: 'Not found' });
  try {
    const real = fs.realpathSync(path.join(root, relative));
    if (!real.startsWith(fs.realpathSync(root) + path.sep)) return reply(res, 404, { error: 'Not found' });
    const stat = fs.statSync(real);
    if (!stat.isFile()) return reply(res, 404, { error: 'Not found' });
    const headers = { 'Content-Type': types[path.extname(real).toLowerCase()] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes' };
    let start = 0, end = stat.size - 1;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || (!match[1] && !match[2])) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); return res.end(); }
      start = match[1] ? Number(match[1]) : Math.max(0, stat.size - Number(match[2]));
      end = match[1] && match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= stat.size) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); return res.end(); }
      headers['Content-Length'] = end - start + 1;
      headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    }
    res.writeHead(req.headers.range ? 206 : 200, headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(real, stat.size ? { start, end } : {}).on('error', () => res.destroy()).pipe(res);
  } catch { reply(res, 404, { error: 'Not found' }); }
});
server.requestTimeout = 20000;
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log(`Invitation: http://localhost:${server.address().port}`));
