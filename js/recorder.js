// Local-only recording in IndexedDB, plus ZIP export.

const HEADERS = {
  eeg_raw: 't_ms,TP9,AF7,AF8,TP10',
  bands: 't_ms,channel,delta,theta,alpha,beta,gamma,artifact,quality,beta_low,beta_high,spectral_entropy',
  ppg: 't_ms,ambient,infrared,red',
  heartbeats: 't_ms,ibi_ms,hr_bpm',
  motion: 't_ms,sensor,x,y,z',
  events: 't_ms,type,detail',
};
const FLUSH_MS = 3000;

let dbPromise;
function db() {
  dbPromise ??= new Promise((res, rej) => {
    const r = indexedDB.open('breath-galaxy', 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('sessions', { keyPath: 'id' });
      r.result.createObjectStore('chunks', { autoIncrement: true }).createIndex('session', 'sessionId');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbPromise;
}
const done = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export class Recorder {
  buffers = Object.fromEntries(Object.keys(HEADERS).map((k) => [k, []]));
  bytes = 0;
  writeError = null;

  constructor(meta) {
    this.meta = { ...meta, id: crypto.randomUUID(), status: 'recording', startedAt: new Date().toISOString() };
    this.id = this.meta.id;
  }

  async open() {
    this.db = await db();
    await this.#saveMeta();
    this.timer = setInterval(() => this.flush(), FLUSH_MS);
  }

  add(kind, line) { this.buffers[kind].push(line); }
  event(t, type, detail = '') { this.add('events', `${Math.round(t)},${type},${String(detail).replace(/[\n,]/g, ' ')}`); }

  async #saveMeta() {
    const tx = this.db.transaction('sessions', 'readwrite');
    await done(tx.objectStore('sessions').put(this.meta));
  }

  async flush() {
    const entries = Object.entries(this.buffers).filter(([, v]) => v.length);
    if (!entries.length || !this.db) return;
    const records = entries.map(([kind, v]) => ({ sessionId: this.id, kind, text: `${v.join('\n')}\n` }));
    entries.forEach(([k]) => { this.buffers[k] = []; });
    try {
      const tx = this.db.transaction('chunks', 'readwrite');
      records.forEach((r) => tx.objectStore('chunks').add(r));
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
    } catch (e) {
      this.writeError = e;
    }
  }

  async finish(summary) {
    clearInterval(this.timer);
    await this.flush();
    Object.assign(this.meta, { status: 'complete', endedAt: new Date().toISOString(), summary });
    await this.#saveMeta();
    return this.meta;
  }
}

export async function listSessions() {
  const d = await db();
  const all = await done(d.transaction('sessions').objectStore('sessions').getAll());
  return all.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function deleteSession(id) {
  const d = await db();
  const tx = d.transaction(['sessions', 'chunks'], 'readwrite');
  tx.objectStore('sessions').delete(id);
  const keys = await done(tx.objectStore('chunks').index('session').getAllKeys(id));
  keys.forEach((k) => tx.objectStore('chunks').delete(k));
  await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
}

const safe = (s) => String(s || 'anon').replace(/[^\w一-鿿-]/g, '_');
const stamp = (iso) => iso.replace(/[-:]/g, '').slice(0, 15);
export const baseName = (m) => `${safe(m.subject)}_${stamp(m.startedAt)}`;

export async function sessionFiles(meta) {
  const d = await db();
  const chunks = await done(d.transaction('chunks').objectStore('chunks').index('session').getAll(meta.id));
  const parts = Object.fromEntries(Object.entries(HEADERS).map(([k, h]) => [k, [`${h}\n`]]));
  chunks.forEach((c) => parts[c.kind].push(c.text));
  const files = [];
  for (const [k, p] of Object.entries(parts)) {
    if (p.length === 1 && ['eeg_raw', 'ppg', 'motion'].includes(k) && !meta.settings?.recordRaw) continue;
    files.push({ name: `${k === 'bands' ? 'bands' : k}.csv`, blob: new Blob(p, { type: 'text/csv' }) });
  }
  files.push({ name: 'session.json', blob: new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' }) });
  return files;
}

export async function exportSession(meta) {
  const files = await sessionFiles(meta);
  return { blob: await zip(files), filename: `${baseName(meta)}.zip` };
}

export function summaryCsv(sessions) {
  const cols = ['subject', 'startedAt', 'status', 'source', 'goal', 'breathPerMin', 'minutes', 'hrMean', 'rmssd', 'artifactPct', 'eegCompletePct',
    'delta_z', 'theta_z', 'alpha_z', 'beta_z', 'gamma_z', 'note'];
  const q = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v);
  const rows = sessions.map((m) => {
    const s = m.summary || {};
    return [m.subject, m.startedAt, m.status, m.source, m.settings?.goal, m.settings?.breath, s.minutes, s.hrMean, s.rmssd, s.artifactPct, s.eegCompletePct,
      ...(s.bandZ || [null, null, null, null, null]), m.note].map(q).join(',');
  });
  return new Blob([`${cols.join(',')}\n${rows.join('\n')}\n`], { type: 'text/csv' });
}

// Delivers a file through the phone's share sheet when offered, otherwise as a download.
export async function deliver(blob, filename, preferShare) {
  const file = new File([blob], filename, { type: blob.type || 'application/zip' });
  if (preferShare && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return 'shared'; }
    catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  return 'downloaded';
}

// Minimal ZIP writer (deflate when the browser offers it, stored otherwise).
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export async function zip(files) {
  const out = [], central = [];
  let offset = 0;
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const f of files) {
    const raw = new Uint8Array(await f.blob.arrayBuffer());
    const crc = crc32(raw);
    let data = raw, method = 0;
    if (typeof CompressionStream !== 'undefined') {
      data = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
      method = 8;
    }
    const name = new TextEncoder().encode(f.name);
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true); head.setUint16(4, 20, true); head.setUint16(6, 0x0800, true);
    head.setUint16(8, method, true); head.setUint16(10, time, true); head.setUint16(12, date, true);
    head.setUint32(14, crc, true); head.setUint32(18, data.length, true); head.setUint32(22, raw.length, true);
    head.setUint16(26, name.length, true);
    out.push(head.buffer, name, data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, method, true); cd.setUint16(12, time, true); cd.setUint16(14, date, true);
    cd.setUint32(16, crc, true); cd.setUint32(20, data.length, true); cd.setUint32(24, raw.length, true);
    cd.setUint16(28, name.length, true); cd.setUint32(42, offset, true);
    central.push(cd.buffer, name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((a, b) => a + b.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, size, true); end.setUint32(16, offset, true);
  return new Blob([...out, ...central, end.buffer], { type: 'application/zip' });
}
