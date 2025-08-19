function writeStr(v: DataView, o: number, s: string) {
  for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
}
export function audioBufferToWav(abuf: AudioBuffer) {
  const numCh = abuf.numberOfChannels;
  const sr = abuf.sampleRate;
  const len = abuf.length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const buf = new ArrayBuffer(44 + len * blockAlign);
  const view = new DataView(buf);

  writeStr(view, 0, "RIFF");
  view.setUint32(4, 36 + len * blockAlign, true);
  writeStr(view, 8, "WAVE");
  writeStr(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(view, 36, "data");
  view.setUint32(40, len * blockAlign, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numCh; ch++) channels.push(abuf.getChannelData(ch));
  let offset = 44;
  for (let i = 0; i < len; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      let s = Math.max(-1, Math.min(1, channels[ch][i]));
      s = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(offset, s, true);
      offset += 2;
    }
  }
  return new Blob([view], { type: "audio/wav" });
}
export function makeImpulseResponse(
  ctx: BaseAudioContext,
  seconds = 3.5,
  decay = 2.8
) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < ir.numberOfChannels; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const env = Math.pow(1 - i / len, decay);
      d[i] = (Math.random() * 2 - 1) * env;
    }
  }
  return ir;
}
