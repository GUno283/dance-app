import { describe, expect, it } from 'vitest';
import type { Clip } from '../types';
import { formationAt } from '../lib/formation';
import { timeToCount } from '../lib/time';

const f = (id: string, start: number, duration: number, x: number): Clip => ({
  id, trackId: 't', start, duration, label: id, sourceIn: 0, rate: 1, positions: [{ memberId: 'm', x, y: 0.5 }],
});

describe('formationAt', () => {
  const clips = [f('a', 0, 2, 0.2), f('b', 4, 2, 0.8)];
  it('クリップ内は hold (編集可)', () => {
    const s = formationAt(clips, 1);
    expect(s.kind).toBe('hold');
  });
  it('隙間は補間 (中間で半分)', () => {
    const s = formationAt(clips, 3);
    expect(s.kind).toBe('transition');
    if (s.kind === 'transition') {
      expect(s.progress).toBeCloseTo(0.5);
      expect(s.positions[0].x).toBeCloseTo(0.5);
    }
  });
  it('最後の後は最後の隊形', () => {
    const s = formationAt(clips, 10);
    expect(s.kind).toBe('after');
    expect(s.kind !== 'empty' && s.positions[0].x).toBeCloseTo(0.8);
  });
});

describe('timeToCount', () => {
  it('BPM 120・オフセット 1 秒', () => {
    expect(timeToCount(1, 120, 1)).toMatchObject({ eight: 1, count: 1 });
    expect(timeToCount(1.5, 120, 1)).toMatchObject({ eight: 1, count: 2 });
    expect(timeToCount(5, 120, 1)).toMatchObject({ eight: 2, count: 1 });
    expect(timeToCount(0.5, 120, 1)).toMatchObject({ eight: 0, count: 8 });
  });
});
