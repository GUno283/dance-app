import type { Project, TrackKind } from '../../types';
import { beatLength } from '../../lib/time';
import { clipEnd, type SnapTarget } from '../../lib/timeline';

export const HEAD_W = 168;
export const TRACK_H: Record<TrackKind, number> = { audio: 68, video: 58, formation: 50, memo: 46 };
export const SNAP_PX = 8;

/** ドラッグ開始時にスナップ候補を集める (exclude: 自分自身のクリップ) */
export const collectTargets = (p: Project, playhead: number, excludeClipIds: string[] = []): SnapTarget[] => {
  const out: SnapTarget[] = [{ time: playhead, kind: 'playhead' }];
  for (const m of p.markers) out.push({ time: m.time, kind: 'marker' });
  for (const c of p.clips) {
    if (excludeClipIds.includes(c.id)) continue;
    out.push({ time: c.start, kind: 'clip' }, { time: clipEnd(c), kind: 'clip' });
  }
  out.push({ time: 0, kind: 'clip' });
  return out;
};

/** 時刻の近くの拍をスナップ候補にする (十分ズームしているときだけ) */
export const beatTargets = (p: Project, times: number[], pxPerSec: number): SnapTarget[] => {
  const bl = beatLength(p.bpm);
  const px = bl * pxPerSec;
  if (px < 6) {
    // ズームアウト時はエイトの頭だけ
    const el = bl * 8;
    if (el * pxPerSec < 6) return [];
    return times.map((t) => ({ time: p.beatOffset + Math.round((t - p.beatOffset) / el) * el, kind: 'beat' as const }));
  }
  return times.map((t) => ({ time: p.beatOffset + Math.round((t - p.beatOffset) / bl) * bl, kind: 'beat' as const }));
};
