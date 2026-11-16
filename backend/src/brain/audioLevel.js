// Measures how loud a 16-bit PCM WAV recording is, WITHOUT keeping or logging the sound itself.
// peak/rms are percentages of full scale (0–100). Silence ≈ 0; normal speech peak ≈ 10–90.
export function wavLevel(base64) {
  const buf = Buffer.from(base64, 'base64');
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null;
  let pos = 12;
  let bits = 16;
  let rate = 0;
  let channels = 1;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(body + 2);
      rate = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
    } else if (id === 'data') {
      if (bits !== 16) return { rate, channels, bits, seconds: null, peak: null, rms: null };
      const end = Math.min(buf.length, body + (size || buf.length - body));
      let peak = 0;
      let sumSq = 0;
      let n = 0;
      for (let i = body; i + 1 < end; i += 2) {
        const v = Math.abs(buf.readInt16LE(i));
        if (v > peak) peak = v;
        sumSq += v * v;
        n++;
      }
      const seconds = rate && channels ? +(n / channels / rate).toFixed(1) : null;
      return {
        rate, channels, bits, seconds,
        peak: +((peak / 32768) * 100).toFixed(1),
        rms: n ? +((Math.sqrt(sumSq / n) / 32768) * 100).toFixed(2) : 0,
      };
    }
    pos = body + size + (size % 2);
  }
  return null;
}
