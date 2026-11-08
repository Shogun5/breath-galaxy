// Phone-to-headset link for headsets whose browser cannot reach the Muse directly.
// A public PeerJS broker introduces the two devices; the data then flows device to device.

import { tr } from './i18n.js?v=15';

function loadPeer() {
  if (window.Peer) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload = res;
    s.onerror = () => rej(new Error(tr('無法載入轉傳元件，請確認網路')));
    document.head.append(s);
  });
}
const idOf = (code) => `breath-galaxy-${code}`;

export async function hostRelay({ onOpen, onMessage, onClose, onError }) {
  await loadPeer();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const peer = new window.Peer(idOf(code));
  const link = { code, conn: null, send: (m) => { if (link.conn?.open) link.conn.send(m); }, close: () => peer.destroy() };
  peer.on('error', (e) => onError(e));
  peer.on('connection', (conn) => {
    link.conn = conn;
    conn.on('open', () => onOpen());
    conn.on('data', onMessage);
    conn.on('close', onClose);
  });
  return link;
}

export async function joinRelay(code, { onOpen, onMessage, onClose, onError }) {
  await loadPeer();
  const peer = new window.Peer();
  const link = { conn: null, send: (m) => { if (link.conn?.open) link.conn.send(m); }, close: () => peer.destroy() };
  peer.on('error', (e) => onError(e));
  peer.on('open', () => {
    const conn = peer.connect(idOf(code), { reliable: false });
    link.conn = conn;
    conn.on('open', onOpen);
    conn.on('data', onMessage);
    conn.on('close', onClose);
  });
  return link;
}
