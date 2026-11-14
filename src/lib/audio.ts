export const WAVEFORM_RATE = 50; // 点/秒

export interface AudioAnalysis {
  duration: number;
  waveform: number[]; // 0..255
  bpm: number | null;
  beatOffset: number | null;
}

export async function analyzeAudioBlob(blob: Blob): Promise<AudioAnalysis> {
  const buf = await blob.arrayBuffer();
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const audio = await ctx.decodeAudioData(buf);
    const data = mixDown(audio);
    const waveform = computeWaveform(data, audio.sampleRate);
    const { bpm, offset } = estimateTempo(data, audio.sampleRate);
    return { duration: audio.duration, waveform, bpm, beatOffset: offset };
  } finally {
    void ctx.close();
  }
}

const mixDown = (audio: AudioBuffer): Float32Array => {
  if (audio.numberOfChannels === 1) return audio.getChannelData(0);
  const a = audio.getChannelData(0);
  const b = audio.getChannelData(1);
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = (a[i] + b[i]) * 0.5;
  return out;
};

export const computeWaveform = (data: Float32Array, sampleRate: number): number[] => {
  const block = Math.max(1, Math.floor(sampleRate / WAVEFORM_RATE));
  const n = Math.ceil(data.length / block);
  const raw = new Float32Array(n);
  let max = 0;
  for (let i = 0; i < n; i++) {
    let peak = 0;
    const end = Math.min(data.length, (i + 1) * block);
    for (let j = i * block; j < end; j++) {
      const v = Math.abs(data[j]);
      if (v > peak) peak = v;
    }
    raw[i] = peak;
    if (peak > max) max = peak;
  }
  return Array.from({ length: n }, (_, i) => (max > 0 ? Math.round((raw[i] / max) * 255) : 0));
};

/**
 * オンセット強度の自己相関で BPM を推定し、拍の位相 (1拍目の位置) も求める。
 * ダンス曲向けに 70〜180 BPM の範囲で探索する。
 */
export const estimateTempo = (
  data: Float32Array,
  sampleRate: number,
): { bpm: number | null; offset: number | null } => {
  const fps = 100; // 10ms ごとのエネルギー
  const hop = Math.floor(sampleRate / fps);
  const frames = Math.floor(data.length / hop);
  if (frames < fps * 5) return { bpm: null, offset: null };
  const energy = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let s = 0;
    for (let j = f * hop; j < (f + 1) * hop; j++) s += data[j] * data[j];
    energy[f] = Math.log(1e-9 + s / hop);
  }
  // オンセット強度 = エネルギーの正の差分
  const onset = new Float32Array(frames);
  for (let f = 1; f < frames; f++) onset[f] = Math.max(0, energy[f] - energy[f - 1]);
  // 平均を引く
  let mean = 0;
  for (let f = 0; f < frames; f++) mean += onset[f];
  mean /= frames;
  for (let f = 0; f < frames; f++) onset[f] = Math.max(0, onset[f] - mean);

  const minLag = Math.floor((60 / 180) * fps);
  const maxLag = Math.ceil((60 / 70) * fps);
  let bestLag = 0;
  let bestScore = -Infinity;
  const limit = Math.min(frames, fps * 90); // 最初の 90 秒で十分
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let f = lag; f < limit; f++) s += onset[f] * onset[f - lag];
    // テンポの倍/半分の曖昧さを軽減するため 100〜130 付近をわずかに優遇
    const bpm = (60 * fps) / lag;
    const weight = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 115) / 0.6, 2));
    s *= 0.7 + 0.3 * weight;
    if (s > bestScore) {
      bestScore = s;
      bestLag = lag;
    }
  }
  if (!bestLag) return { bpm: null, offset: null };
  // 放物線補間で lag を細かく
  const score = (lag: number) => {
    let s = 0;
    for (let f = lag; f < limit; f++) s += onset[f] * onset[f - lag];
    return s;
  };
  const y0 = score(bestLag - 1);
  const y1 = score(bestLag);
  const y2 = score(bestLag + 1);
  const denom = y0 - 2 * y1 + y2;
  const refined = denom !== 0 ? bestLag + (0.5 * (y0 - y2)) / denom : bestLag;
  const raw = (60 * fps) / refined;
  // ほとんどの曲は整数 BPM なので、近ければ整数に丸める
  const bpm = Math.abs(raw - Math.round(raw)) < 0.6 ? Math.round(raw) : Math.round(raw * 10) / 10;

  // 位相: 拍グリッド上のオンセット合計が最大になるオフセット
  const period = (60 / bpm) * fps;
  let bestPhase = 0;
  let bestSum = -Infinity;
  for (let ph = 0; ph < Math.ceil(period); ph++) {
    let s = 0;
    for (let x = ph; x < limit; x += period) s += onset[Math.round(x)] ?? 0;
    if (s > bestSum) {
      bestSum = s;
      bestPhase = ph;
    }
  }
  return { bpm, offset: bestPhase / fps };
};

/** 波形スライス (start〜end 秒) を最大 bins 個に間引く */
export const sliceWaveform = (wave: number[], start: number, end: number, bins: number): number[] => {
  const a = Math.max(0, Math.floor(start * WAVEFORM_RATE));
  const b = Math.min(wave.length, Math.ceil(end * WAVEFORM_RATE));
  const len = b - a;
  if (len <= 0) return [];
  if (len <= bins) return wave.slice(a, b);
  const step = len / bins;
  return Array.from({ length: bins }, (_, i) => {
    let m = 0;
    const s = a + Math.floor(i * step);
    const e = a + Math.floor((i + 1) * step);
    for (let j = s; j < e; j++) if (wave[j] > m) m = wave[j];
    return m;
  });
};
