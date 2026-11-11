import { Galaxy } from './galaxy.js?v=17';
import { MuseSource, SimSource, CHANNELS } from './sources.js?v=17';
import { EegAnalyzer, BeatTracker, Aligner, BANDS, rmssd } from './dsp.js?v=17';
import { Recorder, listSessions, deleteSession, exportSession, summaryCsv, deliver } from './recorder.js?v=17';
import { Soundscape } from './audio.js?v=17';
import { hostRelay, joinRelay } from './relay.js?v=17';
import { tr, applyLang, setLang, locale } from './i18n.js?v=17';

const $ = (id) => document.getElementById(id);
const CALIB_SEC = 60, EARLY_SEC = 10;
const DEFAULTS = { minutes: 10, goal: 'relax', breath: 6, inhale: 40, display: 'flat', sbsFormat: 'auto', music: true, heart: true, subject: '', note: '', recordRaw: true, tilt: true, view: 'galaxy' };
const GOAL_LABEL = { relax: '放鬆', focus: '專注', coherence: '呼吸同調' };
const GOAL_BAND = { relax: 2, focus: 3 };

const store = {
  get() { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('bg-settings') || '{}') }; } catch { return { ...DEFAULTS }; } },
  set(v) { try { localStorage.setItem('bg-settings', JSON.stringify(v)); } catch { /* private mode: keep for this visit only */ } },
};

const galaxy = new Galaxy($('galaxy'));
const sound = new Soundscape();
const S = {
  settings: store.get(), source: null, phase: 'idle', rec: null, an: null, beats: null, relay: null, follower: null,
  elapsed: 0, paused: false, last: 0, t0: 0, lastMeta: null, battery: null, wake: null,
};

/* ---------- routing: one document, so the Bluetooth link survives page changes ---------- */
function show(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.dataset.screen === name));
  if (name === 'settings') fillSettings();
  if (name === 'history') renderHistory();
  if (name === 'results') renderResults();
}
function route() {
  let name = location.hash.slice(1) || 'home';
  if (S.phase === 'session') { show('none'); return; }
  if (S.phase === 'calib' && name !== 'calib') { location.hash = 'calib'; return; }
  if (name === 'settings' && !S.source) name = 'home';
  if (name === 'calib' && S.phase !== 'calib') name = S.source ? 'settings' : 'home';
  if (name === 'results' && !S.lastMeta) name = 'history';
  show(name);
}
addEventListener('hashchange', route);
const go = (n) => { if (location.hash === `#${n}`) route(); else location.hash = n; };

/* ---------- home ---------- */
async function deviceChecks() {
  const bt = !!navigator.bluetooth;
  let vr = false;
  try { vr = !!(await navigator.xr?.isSessionSupported('immersive-vr')); } catch { /* unsupported */ }
  S.vr = vr;
  const gl = !!document.createElement('canvas').getContext('webgl2');
  const row = (k, ok) => `<li>${k}：<b>${ok ? tr('可用') : tr('不可用')}</b></li>`;
  $('checks').innerHTML = row(tr('藍牙'), bt) + row('WebXR VR', vr) + row('WebGL2', gl) + row(tr('安全連線'), isSecureContext);
  if (!bt) {
    $('btn-muse').disabled = true;
    $('connect-status').textContent = tr('此瀏覽器無法直接連 Muse。請用 Android／電腦 Chrome，或以手機轉傳到 Quest。');
  }
}
function attach(source) {
  S.source = source;
  S.an = new EegAnalyzer();
  S.beats = new BeatTracker();
  S.eegRows = 0;
  S.eeg = new Aligner(4, 12, 256, (t, v) => {
    S.eegRows++;
    if (recording() && S.settings.recordRaw && t >= S.t0) S.rec.add('eeg_raw', `${(t - S.t0).toFixed(1)},${v.map(fmt).join(',')}`);
  });
  S.ppg = new Aligner(3, 6, 64, (t, v) => {
    if (v[1] !== null) S.beats.push(v[1], t);
    if (recording() && S.settings.recordRaw && t >= S.t0) S.rec.add('ppg', `${(t - S.t0).toFixed(1)},${v.map((x) => x ?? '').join(',')}`);
  });
  S.beats.onBeat = onBeat;
  S.imuT = {};
  source.onPacket = onPacket;
  source.onTelemetry = (t) => { S.battery = t.battery; };
  source.onDisconnect = onDisconnect;
}
const fmt = (x) => (x === null ? '' : x.toFixed(2));
const recording = () => S.rec && (S.phase === 'calib' || S.phase === 'session');

function onPacket(p) {
  if (p.kind === 'eeg') { S.an.push(p.ch, p.samples); S.eeg.add(p.ch, p.seq, p.samples); }
  else if (p.kind === 'ppg') S.ppg.add(p.ch, p.seq, p.samples);
  if (p.kind === 'accel') trackGravity(p.xyz[2]);
  if (p.kind === 'gyro') trackYaw(p.xyz);
  if ((p.kind === 'accel' || p.kind === 'gyro') && recording() && S.settings.recordRaw) {
    const t = performance.now() - S.t0;
    p.xyz.forEach((v, i) => S.rec.add('motion', `${(t + (i - 2) * 19.2).toFixed(1)},${p.kind},${v.map((x) => x.toFixed(4)).join(',')}`));
  }
}

// Low-passed accelerometer: how the head leans compared with the calibration posture.
function trackGravity(v) {
  S.g ??= [...v];
  for (let i = 0; i < 3; i++) S.g[i] += (v[i] - S.g[i]) * 0.15;
}
const TILT_DEAD = 0.012;
function leanAngle(d) {
  const brain = S.settings.view === 'brain';
  const gain = brain ? 1 : 1.6, max = brain ? 0.9 : 0.5; // brain follows the head one to one
  const v = Math.abs(d) < TILT_DEAD ? 0 : d;
  return Math.max(-max, Math.min(max, v * gain));
}

// Gyroscope turn (z axis, degrees per second) integrated into a head-turn angle.
// A slow leak pulls it back to centre, because integrated gyro drifts.
const GYRO_DT = 1 / 52, YAW_MAX = 1.3, YAW_LEAK = 20, GYRO_DEAD = 1.5;
function trackYaw(samples) {
  for (const s of samples) {
    if (S.phase === 'calib' && !S.calibDone) { S.gyroSum = (S.gyroSum || 0) + s[2]; S.gyroN = (S.gyroN || 0) + 1; }
    const rate = s[2] - (S.gyroBias || 0);
    S.yaw = (S.yaw || 0) * Math.exp(-GYRO_DT / YAW_LEAK);
    if (Math.abs(rate) > GYRO_DEAD) S.yaw += (rate * Math.PI / 180) * GYRO_DT;
    S.yaw = Math.max(-YAW_MAX, Math.min(YAW_MAX, S.yaw));
  }
}

function onBeat(t, ibi) {
  if (recording() && t >= S.t0) {
    const hr = ibi ? (60000 / ibi).toFixed(1) : '';
    S.rec.add('heartbeats', `${(t - S.t0).toFixed(1)},${ibi ? ibi.toFixed(1) : ''},${hr}`);
    if (ibi && S.phase === 'session') S.sum.ibis.push(ibi);
  }
  const m = S.beats.ibi;
  if (!m) fireBeat();
  // Visual timing uses arrival time: sample timestamps can drift from the wall clock.
  S.lastBeatWall = performance.now();
  S.nextBeat = S.lastBeatWall + (m || 1000) - 120;
}
function fireBeat() {
  galaxy.beat(1);
  sound.heartbeat();
  S.relay?.send({ t: 'beat' });
}

async function onDisconnect() {
  note(tr('Muse 連線中斷，正在重新連線…'));
  logEvent('disconnect');
  for (let i = 0; i < 4; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      await S.source.reconnect();
      S.eeg.reset(); S.ppg.reset();
      logEvent('reconnect', `attempt ${i + 1}`);
      note(tr('已重新連線'));
      setTimeout(() => note(''), 2500);
      return;
    } catch { /* retry */ }
  }
  note(tr('無法重新連線。已記錄的資料都還在，可按「結束」後匯出。'));
  logEvent('reconnect_failed');
}
function note(t) { $('h-notice').textContent = t; if (S.phase === 'calib') $('calib-status').textContent = t; if (S.settings.display !== 'flat' && t) S.hudNote = t; }
function logEvent(type, detail) { if (S.rec) S.rec.event(performance.now() - S.t0, type, detail); }

$('btn-sim').onclick = async () => {
  const s = new SimSource();
  attach(s);
  await s.connect();
  go('settings');
};
$('btn-muse').onclick = async () => {
  const st = $('connect-status');
  try {
    st.textContent = tr('請在視窗中選擇您的 Muse…');
    const s = new MuseSource();
    attach(s);
    await s.connect();
    st.textContent = s.missing.length ? tr('已連線，但這些感測器無法使用：{0}', s.missing.join(', ')) : '';
    go('settings');
  } catch (e) {
    const step = S.source?.step || 'choose';
    console.error('Muse connection failed at', step, e);
    S.source = null;
    st.textContent = e.name === 'NotFoundError' && step === 'choose'
      ? tr('未選擇裝置。請確認 Muse 已開機，且官方 App 已斷線。')
      : tr('連線失敗（{0}）：{1}', step, `${e.name} ${e.message}`);
  }
};
$('btn-receive').onclick = () => go('receive');

/* ---------- settings ---------- */
function fillSettings() {
  const v = S.settings;
  $('source-label').textContent = tr('已連線：{0}', tr(S.source?.name ?? ''));
  document.querySelectorAll('.seg').forEach(paintSeg);
  $('minutes-custom').value = [5, 10, 15].includes(v.minutes) ? '' : v.minutes;
  $('breath').value = v.breath; $('inhale').value = v.inhale;
  for (const k of ['music', 'heart', 'recordRaw', 'tilt']) $(k).checked = v[k];
  for (const k of ['subject', 'note', 'sbsFormat']) $(k).value = v[k];
  paintRanges(); paintDisplay();
  galaxy.setView(v.view);
}
function paintSeg(seg) {
  const cur = String(S.settings[seg.dataset.key]);
  seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === cur)));
}
function paintRanges() {
  $('breath-out').textContent = S.settings.breath;
  const i = S.settings.inhale / 10;
  $('ratio-out').textContent = `${i} : ${10 - i}`;
}
function paintDisplay() {
  const d = S.settings.display;
  $('sbs-row').hidden = d !== 'sbs';
  $('display-hint').textContent = {
    flat: tr('單指：左半邊移動、右半邊轉視角。電腦用 WASD 與滑鼠。'),
    sbs: tr('請先把眼鏡切到 3D 模式。手機畫面不顯示按鈕：左半移動、右半轉向；雙擊暫停、兩指標記、三指連按兩次結束。'),
    quest: S.vr ? tr('左搖桿漂浮移動；右搖桿上下與轉向；A 標記、握把暫停、B 重設。') : tr('此裝置沒有 VR。校準後會顯示代碼，讓 Quest 接收這台手機的資料；紀錄存在這台手機。'),
  }[d];
}
document.querySelectorAll('.seg').forEach((seg) => seg.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  S.settings[seg.dataset.key] = 'num' in seg.dataset ? Number(b.dataset.v) : b.dataset.v;
  if (seg.dataset.key === 'minutes') $('minutes-custom').value = '';
  if (seg.dataset.key === 'goal' && b.dataset.v === 'coherence') { S.settings.breath = 6; S.settings.inhale = 50; $('breath').value = 6; $('inhale').value = 50; paintRanges(); }
  paintSeg(seg);
  if (seg.dataset.key === 'display') paintDisplay();
  if (seg.dataset.key === 'view') galaxy.setView(b.dataset.v);
}));
$('minutes-custom').oninput = (e) => {
  const n = Number(e.target.value);
  if (n >= 1 && n <= 120) { S.settings.minutes = n; paintSeg(document.querySelector('[data-key=minutes]')); }
};
$('breath').oninput = (e) => { S.settings.breath = Number(e.target.value); paintRanges(); };
$('inhale').oninput = (e) => { S.settings.inhale = Number(e.target.value); paintRanges(); };
$('settings-form').onsubmit = async (e) => {
  e.preventDefault();
  for (const k of ['music', 'heart', 'recordRaw', 'tilt']) S.settings[k] = $(k).checked;
  for (const k of ['subject', 'note', 'sbsFormat']) S.settings[k] = $(k).value.trim();
  store.set(S.settings);
  await beginCalibration();
};

/* ---------- calibration ---------- */
async function beginCalibration() {
  sound.start(S.settings);
  S.an.baseFrames = []; S.an.baseline = null;
  S.t0 = performance.now();
  S.calibStart = S.t0;
  S.sum = newSummary();
  S.rec = new Recorder({ subject: S.settings.subject, note: S.settings.note, source: S.source.name, model: S.source.model || 'simulated', settings: { ...S.settings } });
  try { await S.rec.open(); } catch (e) { S.rec = null; note(tr('無法開啟本機儲存，這次不會記錄：{0}', e.message)); }
  logEvent('calibration_start');
  S.phase = 'calib';
  $('btn-enter').disabled = true; $('btn-enter').textContent = tr('校準中');
  $('btn-early').disabled = true; $('btn-early').hidden = false;
  $('calib-status').textContent = '';
  $('relay-box').hidden = true;
  S.calibDone = false;
  location.hash = 'calib';
  requestWake();
  if (S.source instanceof SimSource) {
    S.source.warmBaseline(S.an);
    finishCalibration();
    S.gNeutral = [0, 0, 1];
    if (!(S.settings.display === 'quest' && !S.vr)) await enterSession(); // the phone-to-Quest link still needs its code screen
  }
}
function newSummary() { return { zSum: [0, 0, 0, 0, 0], n: 0, frames: 0, artifact: 0, ibis: [], trend: [], bucket: null, rowsStart: 0, startMs: 0 }; }

function renderQuality(f) {
  const t = { good: tr('良好'), fair: tr('普通'), bad: tr('不佳') };
  $('quality').innerHTML = CHANNELS.map((c, i) => `<div class="${f.quality[i]}">${c}<b>${t[f.quality[i]]}</b></div>`).join('');
}
function finishCalibration() {
  if (S.calibDone) return;
  S.calibDone = true;
  const n = S.an.finishBaseline();
  S.gNeutral = S.g ? [...S.g] : null;
  S.gyroBias = S.gyroN ? S.gyroSum / S.gyroN : 0;
  S.gyroSum = 0; S.gyroN = 0;
  logEvent('calibration_end', `clean_frames=${n}`);
  $('btn-early').hidden = true;
  $('calib-count').textContent = '0';
  if (n < 30) $('calib-status').textContent = tr('乾淨訊號偏少，基準可能不準。建議調整頭帶後重新開始。');
  if (S.settings.display === 'quest' && !S.vr) startRelayHost();
  else { $('btn-enter').disabled = false; $('btn-enter').textContent = tr('進入銀河'); }
}
$('btn-early').onclick = finishCalibration;
$('btn-enter').onclick = () => enterSession();

async function startRelayHost() {
  $('relay-box').hidden = false;
  $('btn-enter').textContent = tr('等待 Quest');
  try {
    S.relay = await hostRelay({
      onOpen: () => {
        $('relay-status').textContent = tr('Quest 已連線，請在 Quest 按「進入 VR」');
        S.relay.send({ t: 'config', settings: S.settings });
      },
      onMessage: (m) => {
        if (m.t === 'ready' && S.phase === 'calib') enterSession();
        else if (m.t === 'mark') doMark('controller');
        else if (m.t === 'pause') togglePause();
      },
      onClose: () => { $('relay-status').textContent = tr('Quest 已離線'); logEvent('relay_closed'); note(tr('Quest 已離線，記錄仍在繼續')); },
      onError: (e) => { $('relay-status').textContent = tr('轉傳錯誤：{0}', e.message || e.type); },
    });
    $('relay-code').textContent = S.relay.code;
  } catch (e) { $('relay-status').textContent = e.message; }
}

/* ---------- session ---------- */
async function enterSession() {
  const d = S.settings.display;
  S.localMode = d === 'quest' && !S.vr ? 'flat' : d;
  if (S.localMode === 'quest') {
    try { await galaxy.startXR(); }
    catch (e) { $('calib-status').textContent = tr('無法進入 VR：{0}', e.message); return; }
    galaxy.onXREnd = () => { if (S.phase === 'session') endSession('headset_exit'); };
  } else if (S.localMode === 'sbs') {
    try { await document.documentElement.requestFullscreen(); await screen.orientation?.lock?.('landscape'); } catch { /* the view still works windowed */ }
    galaxy.setMode('sbs', S.settings.sbsFormat);
  }
  galaxy.resetView();
  galaxy.setSession(true);
  S.phase = 'session';
  S.elapsed = 0; S.paused = false; S.last = performance.now();
  S.yaw = 0;
  S.sum.startMs = S.last; S.sum.rowsStart = S.eegRows;
  S.breathPhase = null;
  logEvent('session_start', `display=${S.localMode}`);
  S.relay?.send({ t: 'go' });
  const layer = $('session');
  layer.hidden = false;
  layer.classList.toggle('sbs', S.localMode === 'sbs' || S.localMode === 'quest');
  $('h-rec').hidden = !S.rec;
  $('sim-box').hidden = !(S.source instanceof SimSource);
  paintSimState('neutral');
  $('h-notice').textContent = '';
  show('none');
}

function breathAt(el, st) {
  const cycle = 60 / st.breath, x = (el % cycle) / cycle, f = st.inhale / 100;
  const inhale = x < f, p = inhale ? x / f : (x - f) / (1 - f);
  const e = 0.5 - 0.5 * Math.cos(Math.PI * p);
  const level = inhale ? e : 1 - e; // 0 = dim at the core, 1 = light surrounds the galaxy
  return { inhale, p, cycle, level, radius: 0.4 + 7 * level, n: Math.floor(el / cycle) };
}
const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function advance() {
  if (S.phase !== 'session') return;
  const now = performance.now();
  if (!S.paused) S.elapsed += (now - S.last) / 1000;
  S.last = now;
  if (S.elapsed >= S.settings.minutes * 60) { sound.chime(); endSession('time_up'); }
}

function visualTick(st, elapsed, paused) {
  const b = breathAt(elapsed, st);
  galaxy.setBreath(b.radius, b.level);
  sound.update(b.cycle, b.inhale, b.p, !paused);
  return b;
}

let hudAt = 0;
galaxy.onFrame = () => {
  const now = performance.now();
  if (S.phase === 'session') {
    advance();
    if (S.phase !== 'session') return;
    const b = visualTick(S.settings, S.elapsed, S.paused);
    const key = `${b.n}${b.inhale}`;
    if (key !== S.breathPhase) { S.breathPhase = key; logEvent(b.inhale ? 'breath_inhale' : 'breath_exhale'); }
    if (S.beats.ibi && S.nextBeat && now >= S.nextBeat && now - S.lastBeatWall < 4000) { fireBeat(); S.nextBeat += S.beats.ibi; }
    if (now > hudAt) { hudAt = now + 200; drawHud(b); }
  } else if (S.follower?.running) {
    const f = S.follower;
    if (!f.paused) f.elapsed += (now - f.last) / 1000;
    f.last = now;
    const b = visualTick(f.settings, f.elapsed, f.paused);
    if (now > hudAt) {
      hudAt = now + 250;
      galaxy.setHud(clock(Math.max(0, f.settings.minutes * 60 - f.elapsed)), f.paused ? tr('暫停') : b.inhale ? tr('吸氣') : tr('吐氣'), f.hr ? `${Math.round(f.hr)} bpm` : '');
    }
  } else if (S.phase === 'calib' && S.an.baseline === null) {
    idleEnergy(now);
  } else if (S.phase === 'idle') {
    idleEnergy(now);
    galaxy.setBreath(0.4, 0);
  }
};
const idle = new Float32Array(20);
function idleEnergy(now) {
  const t = now / 1000;
  for (let i = 0; i < 20; i++) idle[i] = 0.3 + 0.13 * Math.sin(t * (0.3 + i * 0.05) + i);
  galaxy.setEnergy(idle);
}

function drawHud(b) {
  const left = S.settings.minutes * 60 - S.elapsed;
  const word = S.paused ? tr('暫停') : b.inhale ? tr('吸氣') : tr('吐氣');
  const hr = S.beats.bpm;
  $('h-time').textContent = clock(Math.max(0, left));
  $('h-breath').textContent = word;
  $('h-hr').textContent = hr ? `${Math.round(hr)} bpm` : '— bpm';
  if (S.localMode !== 'flat') galaxy.setHud(clock(Math.max(0, left)), S.endArmed ? tr('再一次結束') : word, hr ? `${Math.round(hr)} bpm` : '');
}

// 10 Hz analysis clock
const shown = new Float32Array(20);
setInterval(() => {
  if (!S.source || S.follower) return;
  advance();
  const f = S.an.frame();
  if (S.phase === 'calib') {
    const sec = (performance.now() - S.calibStart) / 1000;
    if (!S.calibDone) {
      $('calib-count').textContent = Math.max(0, Math.ceil(CALIB_SEC - sec));
      if (sec > EARLY_SEC) $('btn-early').disabled = false;
      if (sec >= CALIB_SEC) finishCalibration();
    }
    if (f) { renderQuality(f); if (!S.calibDone) S.an.collectBaseline(f); }
  }
  if (!f || !recording()) return;
  const t = Math.round(performance.now() - S.t0);
  f.log.forEach((row, c) => S.rec?.add('bands', `${t},${CHANNELS[c]},${row.map((x) => x.toFixed(4)).join(',')},${f.artifact[c] ? 1 : 0},${f.quality[c]},${f.ext[c].lo.toFixed(4)},${f.ext[c].hi.toFixed(4)},${f.ext[c].H.toFixed(4)}`));
  if (S.phase !== 'session') return;
  const z = S.an.zscores(f);
  const e = S.an.updateEnergy(f, z);
  const hl = GOAL_BAND[S.settings.goal];
  shown.set(e);
  if (hl !== undefined) for (let c = 0; c < 4; c++) shown[c * 5 + hl] = Math.min(1, e[c * 5 + hl] * 1.2);
  const order = S.an.updateOrder(f, z);
  galaxy.setEnergy(shown, order.chaos, order.flick, order.focus);
  accumulate(z, f);
  let tx = 0, tz = 0, ty = 0;
  if (S.settings.tilt && S.gNeutral && S.g) {
    tx = leanAngle(S.g[0] - S.gNeutral[0]);
    tz = leanAngle(S.g[1] - S.gNeutral[1]);
    if (S.settings.view === 'brain') ty = S.yaw || 0;
  }
  galaxy.setTilt(tx, tz, ty);
  S.relay?.send({ t: 'f', e: Array.from(shown, (x) => Math.round(x * 255)), el: S.elapsed, p: S.paused, hr: S.beats.bpm, x: tx, z: tz, y: ty, c: Array.from(order.chaos), fl: Array.from(order.flick), fo: order.focus });
}, 100);

function accumulate(z, f) {
  const s = S.sum;
  s.frames += 4;
  s.artifact += f.artifact.filter(Boolean).length;
  const row = [0, 0, 0, 0, 0];
  let n = 0;
  z.forEach((r, c) => { if (!f.artifact[c]) { n++; r.forEach((v, b) => { row[b] += v; }); } });
  if (!n) return;
  row.forEach((v, b) => { s.zSum[b] += v / n; });
  s.n++;
  const idx = Math.floor(S.elapsed / 5);
  if (!s.bucket || s.bucket.idx !== idx) {
    closeBucket();
    s.bucket = { idx, z: [0, 0, 0, 0, 0], n: 0 };
  }
  row.forEach((v, b) => { s.bucket.z[b] += v / n; });
  s.bucket.n++;
}
function closeBucket() {
  const s = S.sum, b = s.bucket;
  if (b?.n) s.trend.push({ t: b.idx * 5, z: b.z.map((v) => +(v / b.n).toFixed(3)), hr: S.beats.bpm ? +S.beats.bpm.toFixed(1) : null });
}

function doMark(by = 'user') {
  logEvent('mark', by);
  note(tr('已標記'));
  setTimeout(() => { if ($('h-notice').textContent === tr('已標記')) note(''); }, 1200);
}
function togglePause() {
  S.paused = !S.paused;
  logEvent(S.paused ? 'pause' : 'resume');
  $('s-pause').textContent = S.paused ? tr('繼續') : tr('暫停');
}
function armEnd() {
  if (S.endArmed) { clearTimeout(S.endTimer); endSession('user'); return; }
  S.endArmed = true;
  $('s-end').textContent = tr('再按一次結束');
  S.endTimer = setTimeout(() => { S.endArmed = false; $('s-end').textContent = tr('結束'); }, 3000);
}

async function endSession(reason) {
  if (S.phase !== 'session') return;
  S.phase = 'ending';
  S.endArmed = false; clearTimeout(S.endTimer); $('s-end').textContent = tr('結束');
  logEvent('session_end', reason);
  closeBucket();
  S.relay?.send({ t: 'end' });
  S.eeg.flush(); S.ppg.flush();
  $('session').hidden = true;
  galaxy.setTilt(0, 0);
  galaxy.setSession(false);
  if (S.localMode === 'quest') galaxy.endXR();
  if (S.localMode === 'sbs') {
    try { await document.exitFullscreen(); } catch { /* not fullscreen */ }
    galaxy.setMode('flat');
  }
  galaxy.resetView();
  const summary = makeSummary();
  S.lastMeta = S.rec ? await S.rec.finish(summary) : { subject: S.settings.subject, source: S.source.name, settings: { ...S.settings }, startedAt: new Date().toISOString(), summary };
  const err = S.rec?.writeError;
  S.rec = null;
  S.phase = 'idle';
  S.wake?.release?.(); S.wake = null;
  setTimeout(() => sound.stop(), reason === 'time_up' ? 3500 : 0);
  S.resultNote = err ? tr('部分資料寫入失敗：{0}', err.message) : '';
  go('results');
}

function makeSummary() {
  const s = S.sum, m = (performance.now() - s.startMs) / 60000;
  const hrMean = s.ibis.length ? 60000 / (s.ibis.reduce((a, b) => a + b, 0) / s.ibis.length) : null;
  const r = rmssd(s.ibis);
  return {
    minutes: +(S.elapsed / 60).toFixed(2),
    hrMean: hrMean ? +hrMean.toFixed(1) : null,
    rmssd: r ? +r.toFixed(1) : null,
    artifactPct: s.frames ? +((s.artifact / s.frames) * 100).toFixed(1) : null,
    eegCompletePct: m > 0 ? +Math.min(100, ((S.eegRows - s.rowsStart) / (m * 60 * 256)) * 100).toFixed(1) : null,
    bandZ: s.zSum.map((v) => (s.n ? +(v / s.n).toFixed(3) : null)),
    trend: s.trend,
  };
}

async function requestWake() { try { S.wake = await navigator.wakeLock?.request('screen'); } catch { /* optional */ } }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') logEvent('page_hidden');
  else { logEvent('page_visible'); if (S.phase === 'session' || S.phase === 'calib') requestWake(); }
});

/* ---------- moving through the galaxy ---------- */
const layer = $('session');
const pointers = new Map();
const knob = $('knob');
layer.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button, #legend')) return;
  const isMove = e.pointerType !== 'mouse' && e.clientX < innerWidth / 2;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, isMove });
  layer.setPointerCapture(e.pointerId);
  if (isMove && !layer.classList.contains('sbs')) { knob.hidden = false; knob.style.left = `${e.clientX}px`; knob.style.top = `${e.clientY}px`; }
});
layer.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  if (p.isMove) {
    const c = (v) => Math.max(-1, Math.min(1, v / 60));
    galaxy.moveInput.x = -c(e.clientX - p.sx); // the scene follows the finger
    galaxy.moveInput.z = c(e.clientY - p.sy);
  } else {
    galaxy.look(e.clientX - p.x, e.clientY - p.y);
    p.x = e.clientX; p.y = e.clientY;
  }
});
const release = (e) => {
  const p = pointers.get(e.pointerId);
  if (p?.isMove) { galaxy.moveInput.x = 0; galaxy.moveInput.z = 0; knob.hidden = true; }
  pointers.delete(e.pointerId);
};
layer.addEventListener('wheel', (e) => {
  if (e.target.closest('#legend')) return;
  e.preventDefault();
  galaxy.zoom(e.deltaY);
}, { passive: false });
layer.addEventListener('pointerup', release);
layer.addEventListener('pointercancel', release);

let tapT = 0, firstT = 0, lastSingle = 0;
layer.addEventListener('touchstart', (e) => {
  if (!layer.classList.contains('sbs')) return;
  const now = performance.now();
  if (e.touches.length === 1) {
    firstT = now;
    if (now - lastSingle < 300) togglePause();
    lastSingle = now;
  } else if (now - firstT < 140 && now - tapT > 500) {
    if (e.touches.length === 2) doMark('gesture');
    if (e.touches.length === 3) { tapT = now; armEnd(); }
  }
}, { passive: true });

const hold = (id, v) => {
  const b = $(id);
  b.onpointerdown = () => { galaxy.moveInput.y = v; };
  b.onpointerup = b.onpointerleave = b.onpointercancel = () => { galaxy.moveInput.y = 0; };
};
hold('s-up', 1); hold('s-down', -1);
$('s-mark').onclick = () => doMark();
$('s-pause').onclick = togglePause;
$('s-reset').onclick = () => galaxy.resetView();
$('s-end').onclick = armEnd;
const setLegend = (open) => {
  $('legend').hidden = !open;
  $('s-legend').setAttribute('aria-expanded', String(open));
};
$('s-legend').onclick = () => setLegend($('legend').hidden);
$('legend-close').onclick = () => setLegend(false);
$('guide-back').onclick = () => { if (history.length > 1) history.back(); else go('home'); };
galaxy.onXRAction = (a) => {
  if (S.follower?.running) { S.follower.link.send({ t: a }); return; }
  if (a === 'mark') doMark('controller'); else togglePause();
};

const SIM_LABEL = { neutral: 'neutral', relax: 'relax', focus: 'focus', wander: 'wander', anxious: 'anxious' };
const SIM_CAPTION = {
  neutral: '模擬資料。切換狀態後約 10 秒會逐漸變化。',
  relax: '放鬆：旋臂中段變亮，線條收窄、乾淨。',
  focus: '專注：光往中心聚攏，外圍變淡。',
  wander: '放空：外圍變亮，旋臂發散、不規則。',
  anxious: '焦躁：內側細碎閃爍，旋臂發散。',
};
function paintSimState(name) {
  document.querySelectorAll('#sim-states button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.s === name)));
  $('sim-caption').textContent = tr(SIM_CAPTION[name]);
  if (S.source instanceof SimSource) S.source.setState(name);
}
$('sim-states').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  paintSimState(b.dataset.s);
  logEvent('sim_state', SIM_LABEL[b.dataset.s]);
});

const KEYS = { KeyW: ['z', -1], KeyS: ['z', 1], KeyA: ['x', -1], KeyD: ['x', 1], KeyE: ['y', 1], KeyQ: ['y', -1] };
addEventListener('keydown', (e) => {
  if (S.phase !== 'session' || e.repeat) return;
  if (KEYS[e.code]) galaxy.moveInput[KEYS[e.code][0]] = KEYS[e.code][1];
  else if (e.code === 'KeyM') doMark('keyboard');
  else if (e.code === 'Space') { e.preventDefault(); togglePause(); }
  else if (e.code === 'KeyR') galaxy.resetView();
});
addEventListener('keyup', (e) => { if (KEYS[e.code]) galaxy.moveInput[KEYS[e.code][0]] = 0; });

/* ---------- Quest receiver ---------- */
$('btn-join').onclick = async () => {
  const code = $('receive-code').value.trim();
  const st = $('receive-status');
  if (!/^\d{6}$/.test(code)) { st.textContent = tr('請輸入 6 位數代碼'); return; }
  st.textContent = tr('連線中…');
  const f = { running: false, paused: false, elapsed: 0, last: 0, settings: null, link: null, hr: null };
  try {
    f.link = await joinRelay(code, {
      onOpen: () => { st.textContent = tr('已連線，等待手機設定…'); },
      onMessage: (m) => followerMessage(f, m),
      onClose: () => { st.textContent = tr('手機已離線'); },
      onError: (e) => { st.textContent = e.type === 'peer-unavailable' ? tr('找不到這組代碼') : tr('連線錯誤：{0}', e.message || e.type); },
    });
    S.follower = f;
  } catch (e) { st.textContent = e.message; }
};
function followerMessage(f, m) {
  if (m.t === 'config') {
    f.settings = m.settings;
    galaxy.setView(m.settings.view || 'galaxy');
    $('receive-status').textContent = tr('準備完成');
    $('btn-vr').hidden = false;
  } else if (m.t === 'go') {
    f.running = true; f.elapsed = 0; f.last = performance.now();
    galaxy.setSession(true);
  } else if (m.t === 'f') {
    galaxy.setEnergy(Float32Array.from(m.e, (x) => x / 255), m.c, m.fl, m.fo);
    f.paused = m.p; f.hr = m.hr;
    galaxy.setTilt(m.x ?? 0, m.z ?? 0, m.y ?? 0);
    if (Math.abs(f.elapsed - m.el) > 0.15) f.elapsed = m.el;
  } else if (m.t === 'beat') {
    galaxy.beat(1); sound.heartbeat();
  } else if (m.t === 'end') {
    f.running = false;
    galaxy.setTilt(0, 0);
    galaxy.setSession(false);
    galaxy.endXR();
    sound.stop();
    $('receive-status').textContent = tr('本次結束，資料已存在手機上。');
    $('btn-vr').hidden = true;
  }
}
$('btn-vr').onclick = async () => {
  const f = S.follower, st = $('receive-status');
  try {
    sound.start(f.settings);
    await galaxy.startXR();
    galaxy.onXREnd = () => {};
    f.link.send({ t: 'ready' });
  } catch (e) { st.textContent = tr('無法進入 VR：{0}', e.message); }
};

/* ---------- results and history ---------- */
const ink = (t) => document.createTextNode(t);
const n1 = (v, s = '') => (v === null || v === undefined ? '—' : `${v}${s}`);
const signed = (v) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}`);

function renderResults() {
  const m = S.lastMeta;
  if (!m) return;
  const s = m.summary || {}, goal = m.settings?.goal;
  $('r-meta').textContent = `${m.subject || tr('未填代號')}　${new Date(m.startedAt).toLocaleString(locale())}　${tr(m.source)}　${tr(GOAL_LABEL[goal] || '')}`;
  if (goal === 'coherence') {
    $('r-hero').textContent = n1(s.rmssd);
    $('r-hero-label').textContent = 'RMSSD（ms）';
  } else {
    const b = GOAL_BAND[goal] ?? 2;
    $('r-hero').textContent = signed(s.bandZ?.[b]);
    $('r-hero-label').textContent = tr('{0}，相對靜息基準（SD）', BANDS[b].label);
  }
  const stats = [[tr('平均心率'), n1(s.hrMean)], ['RMSSD ms', n1(s.rmssd)], [tr('訓練分鐘'), n1(s.minutes)], [tr('雜訊比例'), n1(s.artifactPct, '%')], [tr('EEG 完整度'), n1(s.eegCompletePct, '%')]];
  $('r-stats').replaceChildren(...stats.map(([k, v]) => {
    const d = document.createElement('div');
    d.innerHTML = '<b></b><span></span>';
    d.children[0].textContent = v; d.children[1].textContent = k;
    return d;
  }));
  const trend = s.trend || [];
  const series = BANDS.map((b, i) => ({ label: b.label, unit: 'SD', v: trend.map((p) => p.z[i]) }));
  series.push({ label: tr('心率'), unit: 'bpm', v: trend.map((p) => p.hr) });
  $('r-charts').replaceChildren(...series.map((x) => spark(x, trend)));
  $('r-share').hidden = !navigator.canShare;
  $('r-status').textContent = S.resultNote || '';
}

function spark(series, trend) {
  const box = document.createElement('div');
  box.className = 'chart';
  const head = document.createElement('header');
  const b = document.createElement('b'); b.textContent = series.label;
  const val = document.createElement('span');
  head.append(b, val);
  box.append(head);
  const pts = series.v.map((v, i) => [i, v]).filter((p) => p[1] !== null);
  const latest = () => { val.textContent = pts.length ? `${pts[pts.length - 1][1]} ${series.unit}` : tr('資料不足'); };
  latest();
  if (pts.length < 2) return box;
  const W = 300, H = 64, ys = pts.map((p) => p[1]);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (hi - lo < 1e-6) { hi += 1; lo -= 1; }
  const X = (i) => 4 + (i / Math.max(1, series.v.length - 1)) * (W - 8);
  const Y = (v) => H - 6 - ((v - lo) / (hi - lo)) * (H - 12);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', tr('{0} 趨勢', series.label));
  const line = document.createElementNS(NS, 'path');
  line.setAttribute('d', pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join(''));
  line.setAttribute('fill', 'none'); line.setAttribute('stroke', '#a98bf9'); line.setAttribute('stroke-width', '2');
  line.setAttribute('vector-effect', 'non-scaling-stroke'); line.setAttribute('stroke-linejoin', 'round');
  const cross = document.createElementNS(NS, 'line');
  cross.setAttribute('y1', 0); cross.setAttribute('y2', H); cross.setAttribute('stroke', '#a39fb8');
  cross.setAttribute('vector-effect', 'non-scaling-stroke'); cross.style.display = 'none';
  svg.append(line, cross);
  svg.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect();
    const idx = Math.round(((e.clientX - r.left) / r.width) * (series.v.length - 1));
    const near = pts.reduce((a, p) => (Math.abs(p[0] - idx) < Math.abs(a[0] - idx) ? p : a));
    cross.setAttribute('x1', X(near[0])); cross.setAttribute('x2', X(near[0])); cross.style.display = '';
    val.textContent = `${clock(trend[near[0]].t)}　${near[1]} ${series.unit}`;
  });
  svg.addEventListener('pointerleave', () => { cross.style.display = 'none'; latest(); });
  box.append(svg);
  return box;
}

async function runExport(meta, share, statusEl) {
  try {
    statusEl.textContent = tr('正在打包…');
    const { blob, filename } = await exportSession(meta);
    const how = await deliver(blob, filename, share);
    statusEl.textContent = how === 'cancelled' ? tr('已取消分享') : tr('已匯出 {0}（{1} MB）', filename, (blob.size / 1048576).toFixed(1));
  } catch (e) { statusEl.textContent = tr('匯出失敗：{0}', e.message); }
}
$('r-export').onclick = () => {
  if (!S.lastMeta.id) { $('r-status').textContent = tr('這次未能使用本機儲存，沒有可匯出的資料。'); return; }
  runExport(S.lastMeta, false, $('r-status'));
};
$('r-share').onclick = () => runExport(S.lastMeta, true, $('r-status'));

async function renderHistory() {
  const list = $('hist-list'), st = $('hist-status');
  list.replaceChildren();
  let all = [];
  try { all = await listSessions(); } catch (e) { st.textContent = tr('無法讀取紀錄：{0}', e.message); return; }
  st.textContent = all.length ? '' : tr('還沒有紀錄。');
  S.history = all;
  all.forEach((m) => {
    const li = document.createElement('li');
    const info = document.createElement('div');
    info.append(ink(m.subject || tr('未填代號')));
    const small = document.createElement('small');
    small.textContent = `${new Date(m.startedAt).toLocaleString(locale())}　${tr('{0} 分', m.summary?.minutes ?? '—')}　${tr(m.source)}${m.status === 'complete' ? '' : `　${tr('未完成')}`}`;
    info.append(small);
    const row = document.createElement('div');
    row.className = 'row-actions';
    const btn = (t, fn) => { const b = document.createElement('button'); b.textContent = t; b.onclick = () => fn(b); row.append(b); };
    if (m.summary) btn(tr('查看'), () => { S.lastMeta = m; S.resultNote = ''; go('results'); });
    btn(tr('匯出'), () => runExport(m, false, st));
    btn(tr('刪除'), async (b) => {
      if (b.dataset.armed) { await deleteSession(m.id); renderHistory(); return; }
      b.dataset.armed = 1; b.textContent = tr('確定刪除？');
      setTimeout(() => { delete b.dataset.armed; b.textContent = tr('刪除'); }, 3000);
    });
    li.append(info, row);
    list.append(li);
  });
}
$('h-summary').onclick = async () => {
  if (!S.history?.length) { $('hist-status').textContent = tr('還沒有紀錄。'); return; }
  await deliver(summaryCsv(S.history), 'summary.csv', false);
  $('hist-status').textContent = tr('已匯出 summary.csv');
};

document.querySelector('.lang-bar').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  setLang(b.dataset.lang);
  applyLang();
  galaxy.relabel();
  deviceChecks();
  if (location.hash === '#settings') {
    $('source-label').textContent = tr('已連線：{0}', tr(S.source?.name ?? ''));
    paintDisplay(); // keeps anything typed but not yet saved
  } else route();
});

applyLang();
deviceChecks();
route();
window.__bg = { S, galaxy }; // for inspection while testing
