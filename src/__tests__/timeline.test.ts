import { describe, expect, it } from 'vitest';
import type { Clip, Marker } from '../types';
import {
  activeClipAt, findSnap, fitToRange, markerRangeAt, mediaTimeAt, splitClip, stretchEnd, stretchStart, trimEnd, trimStart,
} from '../lib/timeline';

const clip = (o: Partial<Clip> = {}): Clip => ({ id: 'c', trackId: 't', start: 10, duration: 8, label: '', assetId: 'a', sourceIn: 2, rate: 1, ...o });

describe('splitClip', () => {
  it('右側の素材位置に速度を反映する (旧版のバグ)', () => {
    const c = clip({ rate: 2, duration: 4 }); // 素材 2〜10 を 4 秒で
    const [l, r] = splitClip(c, 11, 'r')!;
    expect(l.duration).toBeCloseTo(1);
    expect(r.start).toBe(11);
    expect(r.duration).toBeCloseTo(3);
    expect(r.sourceIn).toBeCloseTo(4); // 2 + 1秒 × 2倍速
    // 分割の前後で同じ時刻の映像が同じ
    expect(mediaTimeAt(r, 12)).toBeCloseTo(mediaTimeAt(c, 12));
  });
  it('端では分割しない', () => {
    expect(splitClip(clip(), 10, 'r')).toBeNull();
    expect(splitClip(clip(), 18, 'r')).toBeNull();
  });
});

describe('trim', () => {
  it('左端トリムは速度を考慮して素材位置をずらす (旧版のバグ)', () => {
    const c = clip({ rate: 2 });
    const t = trimStart(c, 11);
    expect(t.start).toBe(11);
    expect(t.duration).toBeCloseTo(7);
    expect(t.sourceIn).toBeCloseTo(4);
    expect(mediaTimeAt(t, 15)).toBeCloseTo(mediaTimeAt(c, 15));
  });
  it('素材の先頭より前には伸ばせない', () => {
    const t = trimStart(clip({ sourceIn: 2, rate: 1 }), 0);
    expect(t.start).toBeCloseTo(8);
    expect(t.sourceIn).toBeCloseTo(0);
  });
  it('右端は素材の長さを超えない', () => {
    const t = trimEnd(clip({ sourceIn: 2, rate: 2 }), 100, 20);
    expect(t.duration).toBeCloseTo(9); // (20-2)/2
  });
});

describe('stretch / fit', () => {
  it('右端ストレッチは素材範囲を保って速度を変える', () => {
    const s = stretchEnd(clip(), 14); // 8秒 → 4秒
    expect(s.duration).toBeCloseTo(4);
    expect(s.rate).toBeCloseTo(2);
    expect(s.duration * s.rate).toBeCloseTo(8);
  });
  it('左端ストレッチは終わりの位置を保つ', () => {
    const s = stretchStart(clip(), 14);
    expect(s.start + s.duration).toBeCloseTo(18);
    expect(s.rate).toBeCloseTo(2);
  });
  it('マーカー区間にフィット', () => {
    const r = fitToRange(clip(), 20, 30);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.clip.start).toBe(20);
      expect(r.clip.duration).toBe(10);
      expect(r.clip.rate).toBeCloseTo(0.8);
    }
  });
  it('速度が範囲外ならフィットしない', () => {
    expect(fitToRange(clip(), 0, 1).ok).toBe(false); // ×8
  });
});

describe('markers & snap', () => {
  const ms: Marker[] = [
    { id: '1', time: 4, label: '', color: '' },
    { id: '2', time: 0, label: '', color: '' },
    { id: '3', time: 8, label: '', color: '' },
  ];
  it('時刻を含むマーカー区間', () => {
    expect(markerRangeAt(ms, 5)).toEqual([4, 8]);
    expect(markerRangeAt(ms, 4)).toEqual([4, 8]);
    expect(markerRangeAt(ms, 9)).toBeNull();
  });
  it('同じ距離ならマーカーを優先してスナップ', () => {
    const s = findSnap([4.05], [{ time: 4.1, kind: 'beat' }, { time: 4, kind: 'marker' }], 0.2);
    expect(s?.target.kind).toBe('marker');
    expect(s?.delta).toBeCloseTo(-0.05);
  });
  it('しきい値外ではスナップしない', () => {
    expect(findSnap([1], [{ time: 2, kind: 'marker' }], 0.5)).toBeNull();
  });
});

describe('activeClipAt', () => {
  it('重なりでは後から始まるクリップを優先', () => {
    const a = clip({ id: 'a', start: 0, duration: 10 });
    const b = clip({ id: 'b', start: 5, duration: 10 });
    expect(activeClipAt([a, b], 't', 6)?.id).toBe('b');
    expect(activeClipAt([a, b], 't', 3)?.id).toBe('a');
    expect(activeClipAt([a, b], 't', 15)).toBeUndefined();
  });
});
