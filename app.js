'use strict';
const config = window.WEDDING;
const $ = (selector) => document.querySelector(selector);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const date = config.date ? new Date(config.date) : null;
const validDate = date && !Number.isNaN(date.getTime());
const formattedDate = validDate ? new Intl.DateTimeFormat('kk-KZ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Almaty' }).format(date) : 'Той күні жақында хабарланады';
document.querySelectorAll('[data-names]').forEach(el => { el.textContent = config.names.join(' & '); });
document.querySelectorAll('[data-initials]').forEach(el => { el.textContent = config.initials; });
document.querySelectorAll('[data-date]').forEach(el => { el.textContent = formattedDate; });

const music = $('#music');
const musicButton = $('#music-toggle');
if (config.music) { music.src = config.music; music.volume = 0.45; musicButton.hidden = false; }
function syncMusic() { musicButton.setAttribute('aria-pressed', String(!music.paused)); musicButton.setAttribute('aria-label', music.paused ? 'Музыканы қосу' : 'Музыканы тоқтату'); }
let musicMutedByGuest = false;
let musicNeedsFirstStart = true;
async function playMusic() {
  if (!config.music || musicMutedByGuest) return;
  try {
    await music.play();
    if (musicMutedByGuest) music.pause();
    else musicNeedsFirstStart = false;
  } catch { /* Retry after a user gesture if the browser blocks autoplay. */ }
  syncMusic();
}
function tryMusicAutoplay(event) {
  if (event?.target instanceof Element && event.target.closest('#music-toggle')) return;
  if (musicNeedsFirstStart && !musicMutedByGuest) playMusic();
}
music.addEventListener('error', () => { musicButton.hidden = true; });
musicButton.addEventListener('click', () => {
  if (music.paused) { musicMutedByGuest = false; playMusic(); }
  else { musicMutedByGuest = true; music.pause(); syncMusic(); }
});
music.addEventListener('pause', syncMusic);
music.addEventListener('play', syncMusic);
document.addEventListener('click', tryMusicAutoplay);
document.addEventListener('touchend', tryMusicAutoplay, { passive: true });
document.addEventListener('keydown', tryMusicAutoplay);
tryMusicAutoplay();
const backgroundVideo = $('#background-video');
if (config.backgroundVideo) {
  backgroundVideo.muted = true;
  backgroundVideo.defaultMuted = true;
  backgroundVideo.src = config.backgroundVideo;
  backgroundVideo.addEventListener('playing', () => document.body.classList.add('has-background-video'));
  backgroundVideo.addEventListener('error', () => document.body.classList.remove('has-background-video'));
  const resumeVideo = () => {
    if (!document.hidden && backgroundVideo.paused && !backgroundVideo.error) backgroundVideo.play().catch(() => {});
  };
  backgroundVideo.addEventListener('canplay', resumeVideo);
  document.addEventListener('visibilitychange', resumeVideo);
  document.addEventListener('pointerdown', resumeVideo, { passive: true });
  document.addEventListener('keydown', resumeVideo);
  resumeVideo();
}
function openEnvelope() {
  if ($('#entrance').classList.contains('open')) return;
  $('#seal').disabled = true;
  $('#entrance').classList.add('open');
  tryMusicAutoplay();
  setTimeout(() => { $('#letter').inert = false; $('#enter').focus({ preventScroll: true }); }, reducedMotion ? 0 : 2800);
}
$('#seal').addEventListener('click', openEnvelope);
$('#entrance').addEventListener('click', event => {
  if (event.target.closest('button, a')) return;
  openEnvelope();
});
$('#enter').addEventListener('click', () => {
  $('#enter').disabled = true;
  $('#invitation').hidden = false;
  $('#entrance').classList.add('leaving');
  window.scrollTo(0, 0);
  setTimeout(() => {
    $('#entrance').classList.add('gone');
    $('#entrance').inert = true;
    $('#home').tabIndex = -1;
    $('#home').focus({ preventScroll: true });
    observeReveals();
    queueScrollUpdate();
  }, reducedMotion ? 0 : 1200);
});

document.querySelectorAll('[data-photo]').forEach(el => {
  const src = config.photos[el.dataset.photo];
  if (!src) return;
  const img = new Image(); img.alt = el.dataset.photo === 'venue' ? 'Гүлдер мен майшамдар: сәндік той композициясы' : 'Жүздерсіз романтикалық той композициясы'; img.loading = 'lazy'; img.decoding = 'async';
  img.addEventListener('error', () => { img.remove(); });
  el.append(img); img.src = src;
});
document.querySelectorAll('[data-media]').forEach(el => {
  const key = el.dataset.media;
  if (config.photos[key]) {
    const img = new Image(); img.alt = ''; img.className = 'background-photo'; img.decoding = 'async';
    img.loading = key === 'hero' ? 'eager' : 'lazy';
    img.addEventListener('load', () => { el.classList.add('has-media'); });
    img.addEventListener('error', () => img.remove());
    el.prepend(img); img.src = config.photos[key];
  }
});
if (validDate) {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Almaty' }).formatToParts(date);
  const part = type => Number(parts.find(p => p.type === type).value);
  const year = part('year'), month = part('month') - 1, day = part('day');
  $('#date-heading').textContent = new Intl.DateTimeFormat('kk-KZ', { month: 'long', year: 'numeric', timeZone: 'Asia/Almaty' }).format(date);
  const eventTime = new Intl.DateTimeFormat('kk-KZ', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty' }).format(date);
  $('#event-time').textContent = `Той уақыты — ${eventTime}`;
  $('#venue-time').textContent = `Той уақыты — ${eventTime}`;
  const calendar = $('#calendar');
  ['ДС', 'СС', 'СР', 'БС', 'ЖМ', 'СН', 'ЖС'].forEach(text => { const el = document.createElement('span'); el.className = 'weekday'; el.textContent = text; calendar.append(el); });
  const offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  for (let i = 0; i < offset; i++) calendar.append(document.createElement('span'));
  for (let i = 1; i <= new Date(Date.UTC(year, month + 1, 0)).getUTCDate(); i++) {
    const el = document.createElement('span'); el.textContent = i;
    if (i === day) { el.className = 'selected'; el.setAttribute('aria-label', `${i} — той күні`); }
    calendar.append(el);
  }
  function tick() {
    const remaining = Math.max(0, Math.floor((date.getTime() - Date.now()) / 1000));
    const values = [Math.floor(remaining / 86400), Math.floor(remaining / 3600) % 24, Math.floor(remaining / 60) % 60, remaining % 60];
    ['days', 'hours', 'minutes', 'seconds'].forEach((key, i) => { $(`#${key}`).textContent = String(values[i]).padStart(2, '0'); });
    $('#countdown-note').textContent = remaining ? 'Әр сәт бізді осы күнге жақындатады' : 'Көптен күткен күніміз келді!';
  }
  tick(); setInterval(tick, 1000);
}
if (config.venue.name) $('#venue-name').textContent = config.venue.name;
if (config.venue.address) $('#venue-address').textContent = config.venue.address;
if (config.host) {
  const host = document.createElement('p');
  host.textContent = `Той иесі: ${config.host}`;
  $('#venue-time').after(host);
}
if (/^https?:\/\//i.test(config.venue.mapUrl)) { $('#map').href = config.venue.mapUrl; $('#map').textContent = '2ГИС-ТЕН АШУ ↗'; $('#map').hidden = false; }
config.schedule.forEach((event, index) => {
  const li = document.createElement('li');
  const icon = document.createElement('span'); icon.className = 'timeline-icon'; icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = index === 0
    ? '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="11" cy="18" r="7"/><circle cx="21" cy="18" r="7"/><path d="m9 8 2-3 2 3-2 3Z"/></svg>'
    : '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M16 26 5 15C-2 7 10 1 16 10 22 1 34 7 27 15Z"/></svg>';
  const content = document.createElement('div'); content.className = 'timeline-content';
  const time = document.createElement('time'); time.textContent = event.time;
  const text = document.createElement('p'); text.textContent = event.title;
  content.append(time, text); li.append(icon, content); $('#timeline').append(li);
});
if (config.schedule.length) $('#program-note').hidden = true;
function observeReveals() {
  if (reducedMotion || !('IntersectionObserver' in window)) { document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible')); return; }
  const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); } }), { threshold: .12 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}
let scrollQueued = false;
function updateScrollEffects() {
  scrollQueued = false;
  if ($('#invitation').hidden) return;
  if (!reducedMotion) $('.hero-content').style.opacity = Math.max(0, 1 - window.scrollY / ($('#home').offsetHeight * .8));
  const timeline = $('#timeline');
  const items = [...timeline.children];
  if (!items.length) return;
  const first = items[0].offsetTop + 24;
  const last = items[items.length - 1].offsetTop + 24;
  const trackHeight = Math.max(1, last - first);
  const travelled = window.innerHeight * 0.72 - timeline.getBoundingClientRect().top;
  const progress = reducedMotion ? 1 : Math.max(0, Math.min(1, (travelled - first) / trackHeight));
  timeline.style.setProperty('--track-top', `${first}px`);
  timeline.style.setProperty('--track-height', `${trackHeight}px`);
  timeline.style.setProperty('--progress', progress);
  items.forEach(item => {
    const distance = travelled - (item.offsetTop + 24);
    // Progress depends only on position: scrolling backwards restores the same state.
    const reveal = reducedMotion ? 1 : Math.max(0, Math.min(1, distance / 80));
    const highlight = reducedMotion ? 0 : Math.max(0, 1 - Math.abs(distance) / 85);
    item.style.setProperty('--event-opacity', reveal);
    item.style.setProperty('--event-y', `${(1 - reveal) * 28}px`);
    item.style.setProperty('--icon-opacity', 0.4 + reveal * 0.6);
    item.style.setProperty('--icon-scale', 0.86 + reveal * 0.14 + highlight * 0.12);
    item.style.setProperty('--glow-size', `${highlight * 22}px`);
    item.classList.toggle('reached', reducedMotion || distance >= 0);
    item.classList.toggle('current', !reducedMotion && Math.abs(distance) < 65);
  });
}
function queueScrollUpdate() {
  if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateScrollEffects); }
}
window.addEventListener('scroll', queueScrollUpdate, { passive: true });
window.addEventListener('resize', queueScrollUpdate, { passive: true });
window.addEventListener('pageshow', queueScrollUpdate);
if ('ResizeObserver' in window) new ResizeObserver(queueScrollUpdate).observe($('#timeline'));
if (document.fonts) document.fonts.ready.then(queueScrollUpdate);

let guestCount = 1;
function updateCount() { $('#count').textContent = guestCount; $('#minus').disabled = guestCount <= 1; $('#plus').disabled = guestCount >= 20; $('#companions-wrap').hidden = guestCount <= 1; }
$('#minus').addEventListener('click', () => { guestCount = Math.max(1, guestCount - 1); updateCount(); });
$('#plus').addEventListener('click', () => { guestCount = Math.min(20, guestCount + 1); updateCount(); });
function updateAttendance() { $('#guest-details').hidden = $('input[name="attendance"]:checked').value === 'no'; }
document.querySelectorAll('input[name="attendance"]').forEach(el => el.addEventListener('change', updateAttendance));
const storageKey = 'wedding-rsvp-draft';
let pendingSubmission = null;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved) {
    $('#guest-name').value = saved.name || '';
    $(`input[name="attendance"][value="${saved.attendance === 'no' ? 'no' : 'yes'}"]`).checked = true;
    guestCount = Math.max(1, Math.min(20, Number(saved.count) || 1));
    $('#companions').value = saved.companions || '';
    if (saved.id) {
      const { name, attendance, count, companions } = saved;
      pendingSubmission = { fingerprint: JSON.stringify({ name, attendance, count, companions }), id: saved.id };
      $('#form-status').textContent = saved.sentToServer === true
        ? 'Рақмет! Жауабыңыз қабылданды 🤍'
        : 'Жауабыңыз осы құрылғыда сақталды.';
    }
  }
} catch { /* Storage is optional. */ }
updateCount(); updateAttendance();
if (config.rsvpEndpoint) { $('#submit').textContent = 'ЖАУАПТЫ ЖІБЕРУ ↗'; $('#form-note').textContent = 'Жауабыңыз той ұйымдастырушыларына жіберіледі.'; }
if (location.protocol === 'file:' && config.rsvpEndpoint.startsWith('/')) {
  $('#submit').disabled = true;
  $('#form-note').textContent = 'Жауап жіберу үшін шақыруды сайт сілтемесі арқылы ашыңыз.';
}
$('#rsvp-form').addEventListener('submit', async event => {
  event.preventDefault();
  const name = $('#guest-name').value.trim();
  if (!name) { $('#guest-name').setCustomValidity('Аты-жөніңізді жазыңыз'); $('#guest-name').reportValidity(); return; }
  const attendance = $('input[name="attendance"]:checked').value;
  const payload = { name, attendance, count: attendance === 'yes' ? guestCount : 0, companions: attendance === 'yes' && guestCount > 1 ? $('#companions').value.trim() : '' };
  const fingerprint = JSON.stringify(payload);
  if (!pendingSubmission || pendingSubmission.fingerprint !== fingerprint) pendingSubmission = { fingerprint, id: crypto.randomUUID() };
  payload.id = pendingSubmission.id;
  $('#submit').disabled = true; $('#form-status').textContent = '';
  try {
    if (config.rsvpEndpoint) {
      const response = await fetch(config.rsvpEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('send');
      const result = await response.json();
      if (result.saved !== true) throw new Error('save');
      $('#form-status').textContent = 'Рақмет! Жауабыңыз қабылданды 🤍';
      try { localStorage.setItem(storageKey, JSON.stringify({ ...payload, sentToServer: true })); } catch {}
    } else {
      localStorage.setItem(storageKey, JSON.stringify(payload));
      $('#form-status').textContent = 'Жауабыңыз осы құрылғыда сақталды. Ұйымдастырушыларға әлі жіберілген жоқ.';
    }
  } catch {
    $('#form-status').textContent = config.rsvpEndpoint ? 'Жауап жіберілмеді. Қайта көріңіз.' : 'Браузер жауапты сақтауға рұқсат бермеді.';
  } finally { $('#submit').disabled = false; }
});
$('#guest-name').addEventListener('input', () => $('#guest-name').setCustomValidity(''));
