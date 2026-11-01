export function makeNoise(context: BaseAudioContext) {
  const noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.4), context.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  return noise;
}

export function stepDuration(step: number, bpm: number, swing: number) {
  const delay = [0, 0.16, 1 / 3][swing];
  return 15 / bpm * (step % 2 === 0 ? 1 + delay : 1 - delay);
}
export function hit(context: BaseAudioContext, noise: AudioBuffer, row: number, time: number, destination: AudioNode, level: number, mix = 1) {
  if (mix <= 0 || level === 0) return;
  const duration = [0.22,0.14,0.045,0.28,0.18][row];
  const gain = context.createGain();
  const volume = [0.62,0.36,0.18,0.16,0.33][row] * [0,0.35,0.65,1][level] * mix;
  gain.gain.setValueAtTime(volume, time);
  if (row === 4) {
    for (const offset of [0.012, 0.025]) {
      gain.gain.exponentialRampToValueAtTime(volume * 0.06, time + offset - 0.001);
      gain.gain.setValueAtTime(volume, time + offset);
    }
  }
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  gain.connect(destination);
  if (row === 0) {
    const kick = context.createOscillator();
    kick.frequency.setValueAtTime(154,time);
    kick.frequency.exponentialRampToValueAtTime(43,time+0.12);
    kick.connect(gain);
    kick.start(time);
    kick.stop(time+duration);
  } else {
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = row === 1 || row === 4 ? 'bandpass' : 'highpass';
    filter.frequency.value = [0,1850,7600,5950,1130][row];
    source.connect(filter).connect(gain);
    source.start(time);
    source.stop(time+duration);
  }
}

export async function renderLoop(pattern: number[][], bpm: number, swing: number, mix: number[]) {
  const rate = 44100;
  const frames = Math.round(rate * 240 / bpm);
  const offline = new OfflineAudioContext(1, frames * 2, rate);
  const noise = makeNoise(offline);
  // Render a lead-in bar so the last open hat can ring across the loop boundary.
  for (let bar = 0; bar < 2; bar++) {
    let time = bar * frames / rate;
    for (let step = 0; step < 16; step++) {
      pattern.forEach((track, row) => hit(offline, noise, row, time, offline.destination, track[step], mix[row]));
      time += stepDuration(step, bpm, swing);
    }
  }
  const samples = (await offline.startRendering()).getChannelData(0).subarray(frames);
  const buffer = new ArrayBuffer(44 + frames * 2);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const encoder = new TextEncoder();
  bytes.set(encoder.encode('RIFF'), 0);
  view.setUint32(4, buffer.byteLength - 8, true);
  bytes.set(encoder.encode('WAVEfmt '), 8);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  bytes.set(encoder.encode('data'), 36);
  view.setUint32(40, frames * 2, true);
  samples.forEach((sample, i) => view.setInt16(44 + 2 * i, Math.round(Math.max(-1, Math.min(1, sample)) * 32767), true));
  return new Blob([buffer], {type:'audio/wav'});
}
