/** mm:ss.cc 形式 */
export const formatTime = (t: number): string => {
  if (!Number.isFinite(t)) t = 0;
  const sign = t < 0 ? '-' : '';
  const a = Math.abs(t);
  const m = Math.floor(a / 60);
  const s = Math.floor(a % 60);
  const cs = Math.floor((a * 100) % 100);
  return `${sign}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
};

/** 短い表記 (ルーラー用) */
export const formatShort = (t: number): string => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const beatLength = (bpm: number): number => 60 / Math.max(1, bpm);

/** 時間 → 拍 (0 始まり、オフセット前は負) */
export const timeToBeat = (t: number, bpm: number, offset: number): number =>
  (t - offset) / beatLength(bpm);

export const beatToTime = (beat: number, bpm: number, offset: number): number =>
  offset + beat * beatLength(bpm);

export interface CountInfo {
  /** 何エイト目か (1 始まり)。オフセットより前は 0 以下 */
  eight: number;
  /** エイト内のカウント (1〜8) */
  count: number;
  /** 拍内の進行度 0〜1 */
  phase: number;
}

export const timeToCount = (t: number, bpm: number, offset: number): CountInfo => {
  const beat = timeToBeat(t + 1e-6, bpm, offset);
  const whole = Math.floor(beat);
  const eight = Math.floor(whole / 8) + 1;
  const count = (((whole % 8) + 8) % 8) + 1;
  return { eight, count, phase: beat - whole };
};

export const formatCount = (c: CountInfo): string =>
  c.eight < 1 ? `-  ${c.count}` : `${c.eight}-${c.count}`;

export const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));
