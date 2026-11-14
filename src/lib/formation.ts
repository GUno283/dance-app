import type { Clip, Member, Position } from '../types';
import { clipEnd } from './timeline';

export const easeInOut = (t: number): number => t * t * (3 - 2 * t);

export type FormationState =
  | { kind: 'empty' }
  /** 隊形クリップの中 = 編集できる */
  | { kind: 'hold'; clip: Clip; positions: Position[]; prev?: Clip }
  /** クリップ間の移動中 = 補間表示 */
  | { kind: 'transition'; from: Clip; to: Clip; progress: number; positions: Position[] }
  | { kind: 'before'; next: Clip; positions: Position[] }
  | { kind: 'after'; last: Clip; positions: Position[] };

export const interpolatePositions = (a: Position[], b: Position[], k: number): Position[] => {
  const e = easeInOut(Math.min(1, Math.max(0, k)));
  const out: Position[] = [];
  for (const p of a) {
    const q = b.find((x) => x.memberId === p.memberId);
    out.push(q ? { memberId: p.memberId, x: p.x + (q.x - p.x) * e, y: p.y + (q.y - p.y) * e } : p);
  }
  // b にしかいないメンバーは途中から登場
  for (const q of b) if (!a.some((p) => p.memberId === q.memberId) && k > 0.5) out.push(q);
  return out;
};

export const formationAt = (clips: Clip[], t: number): FormationState => {
  const sorted = clips.filter((c) => c.positions).sort((a, b) => a.start - b.start);
  if (sorted.length === 0) return { kind: 'empty' };
  let holdIdx = -1;
  for (let i = 0; i < sorted.length; i++) {
    if (t >= sorted[i].start && t < clipEnd(sorted[i])) holdIdx = i;
  }
  if (holdIdx >= 0) {
    const clip = sorted[holdIdx];
    return { kind: 'hold', clip, positions: clip.positions!, prev: sorted[holdIdx - 1] };
  }
  const nextIdx = sorted.findIndex((c) => c.start > t);
  if (nextIdx === 0) return { kind: 'before', next: sorted[0], positions: sorted[0].positions! };
  if (nextIdx === -1) {
    const last = sorted[sorted.length - 1];
    return { kind: 'after', last, positions: last.positions! };
  }
  const from = sorted[nextIdx - 1];
  const to = sorted[nextIdx];
  const gapStart = clipEnd(from);
  const gap = to.start - gapStart;
  const progress = gap > 0 ? (t - gapStart) / gap : 1;
  return {
    kind: 'transition',
    from,
    to,
    progress,
    positions: interpolatePositions(from.positions!, to.positions!, progress),
  };
};

/** メンバーを横一列に並べた初期配置 */
export const lineUp = (members: Member[], y = 0.6): Position[] =>
  members.map((m, i) => ({
    memberId: m.id,
    x: members.length === 1 ? 0.5 : 0.1 + (0.8 * i) / (members.length - 1),
    y,
  }));

export const mirrorPositions = (ps: Position[]): Position[] => ps.map((p) => ({ ...p, x: 1 - p.x }));
