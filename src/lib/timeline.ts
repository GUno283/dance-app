import type { Clip, Marker, Project, Track } from '../types';
import { clamp } from './time';

export const MIN_CLIP = 0.1;
export const MIN_RATE = 0.25;
export const MAX_RATE = 4;

export const clipEnd = (c: Clip): number => c.start + c.duration;
/** 素材上で消費する長さ */
export const sourceLength = (c: Clip): number => c.duration * c.rate;

/** タイムライン時間 → 素材内の時間 */
export const mediaTimeAt = (c: Clip, t: number): number => c.sourceIn + (t - c.start) * c.rate;

/** t の位置で再生されるクリップ (重なりがある場合は後から始まるものを優先) */
export const activeClipAt = (clips: Clip[], trackId: string, t: number): Clip | undefined => {
  let best: Clip | undefined;
  for (const c of clips) {
    if (c.trackId !== trackId) continue;
    if (t >= c.start && t < clipEnd(c) && (!best || c.start >= best.start)) best = c;
  }
  return best;
};

export const projectDuration = (p: Project): number => {
  let end = 0;
  for (const c of p.clips) end = Math.max(end, clipEnd(c));
  for (const m of p.markers) end = Math.max(end, m.time);
  return end;
};

// ---------------- クリップ編集 (純粋関数) ----------------

export const splitClip = (c: Clip, t: number, newId: string): [Clip, Clip] | null => {
  if (t <= c.start + MIN_CLIP / 2 || t >= clipEnd(c) - MIN_CLIP / 2) return null;
  const leftDur = t - c.start;
  const left: Clip = { ...c, duration: leftDur };
  const right: Clip = {
    ...c,
    id: newId,
    start: t,
    duration: c.duration - leftDur,
    sourceIn: c.sourceIn + leftDur * c.rate,
    positions: c.positions?.map((p) => ({ ...p })),
  };
  return [left, right];
};

/** 左端を newStart に動かす (素材の位置は固定 = トリム) */
export const trimStart = (c: Clip, newStart: number): Clip => {
  const isMedia = !!c.assetId;
  let delta = newStart - c.start;
  // 素材の先頭より前には伸ばせない
  if (isMedia) delta = Math.max(delta, -c.sourceIn / c.rate);
  delta = Math.max(delta, -c.start);
  delta = Math.min(delta, c.duration - MIN_CLIP);
  return {
    ...c,
    start: c.start + delta,
    duration: c.duration - delta,
    sourceIn: isMedia ? c.sourceIn + delta * c.rate : c.sourceIn,
  };
};

/** 右端を newEnd に動かす (トリム)。assetDuration を超えない */
export const trimEnd = (c: Clip, newEnd: number, assetDuration?: number): Clip => {
  let dur = Math.max(MIN_CLIP, newEnd - c.start);
  if (c.assetId && assetDuration) dur = Math.min(dur, (assetDuration - c.sourceIn) / c.rate);
  return { ...c, duration: Math.max(MIN_CLIP, dur) };
};

/** 素材の範囲は変えずに長さを変える = 速度変更 (右端) */
export const stretchEnd = (c: Clip, newEnd: number): Clip => {
  const src = sourceLength(c);
  const dur = clamp(newEnd - c.start, src / MAX_RATE, src / MIN_RATE);
  return { ...c, duration: dur, rate: src / dur };
};

/** 素材の範囲は変えずに長さを変える = 速度変更 (左端) */
export const stretchStart = (c: Clip, newStart: number): Clip => {
  const src = sourceLength(c);
  const end = clipEnd(c);
  const dur = clamp(end - newStart, src / MAX_RATE, src / MIN_RATE);
  return { ...c, start: end - dur, duration: dur, rate: src / dur };
};

export type FitResult = { ok: true; clip: Clip } | { ok: false; reason: string };

/** 素材範囲を [a, b] にぴったり収める (速度を自動調整) */
export const fitToRange = (c: Clip, a: number, b: number): FitResult => {
  const dur = b - a;
  if (dur < MIN_CLIP) return { ok: false, reason: '区間が短すぎます' };
  if (!c.assetId) return { ok: true, clip: { ...c, start: a, duration: dur } };
  const rate = sourceLength(c) / dur;
  if (rate < MIN_RATE || rate > MAX_RATE) {
    return { ok: false, reason: `必要な速度 ×${rate.toFixed(2)} が範囲外です (×${MIN_RATE}〜×${MAX_RATE})` };
  }
  return { ok: true, clip: { ...c, start: a, duration: dur, rate } };
};

export const sortedMarkers = (markers: Marker[]): Marker[] =>
  [...markers].sort((a, b) => a.time - b.time);

/** t を含むマーカー区間 [前のマーカー, 次のマーカー] */
export const markerRangeAt = (markers: Marker[], t: number, eps = 0.05): [number, number] | null => {
  const ms = sortedMarkers(markers);
  let a: number | null = null;
  let b: number | null = null;
  for (const m of ms) {
    if (m.time <= t + eps) a = m.time;
    else {
      b = m.time;
      break;
    }
  }
  return a !== null && b !== null ? [a, b] : null;
};

// ---------------- スナップ ----------------

export interface SnapTarget {
  time: number;
  kind: 'marker' | 'playhead' | 'clip' | 'beat';
}

export const findSnap = (
  times: number[],
  targets: SnapTarget[],
  thresholdSec: number,
): { delta: number; target: SnapTarget; index: number } | null => {
  let best: { delta: number; target: SnapTarget; index: number } | null = null;
  // マーカー > 再生ヘッド > クリップ端 > 拍 の優先度 (同距離なら)
  const rank = { marker: 0, playhead: 1, clip: 2, beat: 3 } as const;
  times.forEach((t, index) => {
    for (const target of targets) {
      const d = target.time - t;
      const ad = Math.abs(d);
      if (ad > thresholdSec) continue;
      if (
        !best ||
        ad < Math.abs(best.delta) - 1e-9 ||
        (Math.abs(ad - Math.abs(best.delta)) < 1e-9 && rank[target.kind] < rank[best.target.kind])
      ) {
        best = { delta: d, target, index };
      }
    }
  });
  return best;
};

export const trackAccepts = (track: Track, assetKind: 'audio' | 'video'): boolean =>
  track.kind === assetKind;
