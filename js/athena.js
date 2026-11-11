// Muse S Athena (MS-03) packet decoder.
// Adapted from web-muse by Itay Inbar (MIT License, github.com/itayinbarr/web-muse),
// which draws on OpenMuse and BrainFlow. The Athena sends every sensor on one
// characteristic as packets of tagged, bit-packed subpackets:
//   packet:    [length][counter lo][counter hi][6 header bytes][subpackets...]
//   subpacket: [tag][index][3 metadata bytes][payload]

export const ATHENA_DATA = '273e0013-4c4d-454d-96be-f03bac821358';
export const ATHENA_DATA2 = '273e0014-4c4d-454d-96be-f03bac821358';
export const ATHENA_PRESET = 'p1035'; // 4 EEG channels + 4 optics channels

const PACKET_HEADER = 9;
const SUB_HEADER = 5;
const EEG_SCALE = 1450 / 16383; // microvolts per count
const EEG_MID = 8192;
const ACC_SCALE = 1 / 16384; // g per count
const GYRO_SCALE = -0.0074768; // degrees per second per count

export const TAGS = {
  0x11: { type: 'eeg', channels: 4, samples: 4, bytes: 28 },
  0x12: { type: 'eeg', channels: 8, samples: 2, bytes: 28 },
  0x34: { type: 'optics', channels: 4, samples: 3, bytes: 30 },
  0x35: { type: 'optics', channels: 8, samples: 2, bytes: 40 },
  0x36: { type: 'optics', channels: 16, samples: 1, bytes: 40 },
  0x47: { type: 'motion', channels: 6, samples: 3, bytes: 36 },
  0x53: { type: 'drlref', channels: 2, samples: 6, bytes: 24 },
  0x88: { type: 'battery', channels: 1, samples: 1, bytes: 20 },
  0x98: { type: 'battery', channels: 1, samples: 1, bytes: 20 },
};

// Little-endian bitstream, least significant bit first.
export function unpackLE(bytes, offset, count, bits) {
  const out = new Array(count), mask = (1 << bits) - 1;
  let acc = 0, accBits = 0, pos = offset;
  for (let i = 0; i < count; i++) {
    while (accBits < bits) { acc |= bytes[pos++] << accBits; accBits += 8; }
    out[i] = acc & mask;
    acc >>>= bits;
    accBits -= bits;
  }
  return out;
}

const byChannel = (values, channels, samples) =>
  Array.from({ length: channels }, (_, ch) => Array.from({ length: samples }, (_, s) => values[s * channels + ch]));

function payload(spec, bytes, p) {
  const n = spec.channels * spec.samples;
  if (spec.type === 'eeg') return byChannel(unpackLE(bytes, p, n, 14).map((x) => (x - EEG_MID) * EEG_SCALE), spec.channels, spec.samples);
  if (spec.type === 'optics') return byChannel(unpackLE(bytes, p, n, 20), spec.channels, spec.samples);
  const dv = new DataView(bytes.buffer, bytes.byteOffset + p, spec.bytes);
  if (spec.type === 'motion') {
    const v = [];
    for (let i = 0; i < n; i++) { const x = dv.getInt16(i * 2, true); v.push(i % 6 < 3 ? x * ACC_SCALE : x * GYRO_SCALE); }
    return byChannel(v, spec.channels, spec.samples);
  }
  if (spec.type === 'battery') return [[(bytes[p] | (bytes[p + 1] << 8)) / 256]];
  return null;
}

// Calls onSub({type, tag, index, values}) for every subpacket; values is one array per channel.
export function parseAthena(bytes, onSub) {
  let offset = 0, subs = 0;
  while (offset < bytes.length) {
    const length = bytes[offset];
    if (length < PACKET_HEADER + SUB_HEADER || offset + length > bytes.length) break;
    const end = offset + length;
    let i = offset + PACKET_HEADER;
    while (i + SUB_HEADER <= end) {
      const spec = TAGS[bytes[i]];
      if (!spec || i + SUB_HEADER + spec.bytes > end) break;
      const values = payload(spec, bytes, i + SUB_HEADER);
      if (values) { onSub({ type: spec.type, tag: bytes[i], index: bytes[i + 1], values }); subs++; }
      i += SUB_HEADER + spec.bytes;
    }
    offset = end;
  }
  return subs;
}
