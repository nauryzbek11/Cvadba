'use strict';
(() => {
  const el = id => document.getElementById(id);
  let guests = [];
  function lock() { guests = []; el('guest-rows').replaceChildren(); el('admin-panel').hidden = true; el('admin-login').hidden = false; }
  async function request(url, options = {}) {
    const response = await fetch(url, { ...options, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (response.status === 401) { lock(); const error = Error('Құпиясөз қате немесе сессия аяқталды.'); error.status = 401; throw error; }
    if (response.status === 429) throw Error('Кіру әрекеті тым көп. 15 минуттан кейін қайталаңыз.');
    if (!response.ok) throw Error('Серверге қосылу мүмкін болмады. Қайта көріңіз.');
    return response.json();
  }
  async function refresh() {
    const result = await request('/api/admin/guests');
    guests = result.guests;
    el('guest-rows').replaceChildren();
    const format = new Intl.DateTimeFormat('kk-KZ', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Almaty' });
    for (const guest of guests) {
      const row = document.createElement('tr');
      for (const value of [guest.name, guest.attendance === 'yes' ? 'Қатысады' : 'Келе алмайды', guest.count, guest.companions || '—', format.format(new Date(guest.receivedAt))]) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
      el('guest-rows').append(row);
    }
    el('admin-summary').textContent = `Жауаптар: ${guests.length} · Қатысатын адам саны: ${guests.reduce((sum, g) => sum + (g.attendance === 'yes' ? g.count : 0), 0)}`;
    el('admin-status').textContent = guests.length ? '' : 'Әзірге жауаптар жоқ.';
    el('admin-login').hidden = true; el('admin-panel').hidden = false;
  }
  el('admin-login').addEventListener('submit', async event => {
    event.preventDefault(); const button = event.submitter; button.disabled = true;
    try { await request('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: el('admin-password').value }) }); el('admin-password').value = ''; await refresh(); }
    catch (error) { el('admin-status').textContent = error.message; }
    finally { button.disabled = false; }
  });
  el('admin-refresh').addEventListener('click', async () => { try { await refresh(); } catch (error) { el('admin-status').textContent = error.message; } });
  el('admin-logout').addEventListener('click', async () => { try { await request('/api/admin/logout', { method: 'POST' }); lock(); el('admin-status').textContent = ''; } catch (error) { el('admin-status').textContent = error.message; } });
  el('admin-download').addEventListener('click', async () => {
    try {
      await refresh();
      const cell = value => { let text = String(value); if (/^[=+@\-\t\r\n]/.test(text)) text = "'" + text; return '"' + text.replaceAll('"', '""') + '"'; };
      const rows = [['Аты-жөні', 'Қатысуы', 'Адам саны', 'Қонақтар', 'Жауап уақыты'], ...guests.map(g => [g.name, g.attendance === 'yes' ? 'Иә' : 'Жоқ', g.count, g.companions, g.receivedAt])];
      const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'guests.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { el('admin-status').textContent = error.message; }
  });
  // Restore the private list using the existing HttpOnly session cookie.
  if (location.protocol !== 'file:') refresh().catch(error => {
    if (error.status !== 401) el('admin-status').textContent = error.message;
  });
})();
