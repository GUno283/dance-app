import type { Clip, Member, Project, Track } from '../types';
import { newId } from './id';
import { lineUp } from './formation';
import { beatLength } from './time';

export const MEMBER_COLORS = [
  '#ff5a5f', '#3d8bff', '#2ec27e', '#ff9f1c', '#b36bff', '#00c2c7',
  '#ff6fb5', '#f5c518', '#8bd450', '#6c7cff', '#ff7b54', '#4dd0e1',
];

export const TRACK_COLORS: Record<Track['kind'], string> = {
  audio: '#f59e0b',
  video: '#3b82f6',
  formation: '#22c55e',
  memo: '#a855f7',
};

export const MARKER_COLORS = ['#ff9f1c', '#ff5a5f', '#2ec27e', '#3d8bff', '#b36bff', '#f5c518'];

export const defaultTrackName = (kind: Track['kind'], n = 1): string =>
  ({ audio: '音源', video: n > 1 ? `動画 ${n}` : '動画', formation: '隊形', memo: 'メモ' })[kind];

export const makeTrack = (kind: Track['kind'], name?: string): Track => ({
  id: newId('tr'),
  kind,
  name: name ?? defaultTrackName(kind),
  // 振付動画は音源と音が二重になりやすいので最初はミュート
  muted: kind === 'video' ? true : undefined,
});

export const makeMember = (name: string, index: number): Member => ({
  id: newId('mb'),
  name,
  color: MEMBER_COLORS[index % MEMBER_COLORS.length],
  short: shortName(name),
});

export const shortName = (name: string): string => {
  const t = name.trim();
  if (!t) return '?';
  // 日本語なら先頭1〜2文字、英字なら頭文字
  if (/^[ -~\s]+$/.test(t)) {
    const parts = t.split(/\s+/);
    return (parts.length > 1 ? parts[0][0] + parts[1][0] : t.slice(0, 2)).toUpperCase();
  }
  return t.slice(0, 2);
};

export const newProject = (name: string, bpm = 120): Project => {
  const now = Date.now();
  return {
    id: newId('pj'),
    version: 2,
    name,
    createdAt: now,
    updatedAt: now,
    bpm,
    beatOffset: 0,
    members: [],
    assets: [],
    tracks: [makeTrack('audio'), makeTrack('video', '動画 (正面)'), makeTrack('formation'), makeTrack('memo')],
    clips: [],
    markers: [],
    stage: { width: 10, depth: 6 },
  };
};

/** メディアなしで機能を試せるサンプル */
export const sampleProject = (): Project => {
  const p = newProject('サンプル: ショーケース', 100);
  const names = ['あおい', 'けんた', 'さくら', 'ゆうと', 'みお', 'りく'];
  p.members = names.map((n, i) => makeMember(n, i));
  const eight = beatLength(p.bpm) * 8;
  const formationTrack = p.tracks.find((t) => t.kind === 'formation')!;
  const memoTrack = p.tracks.find((t) => t.kind === 'memo')!;
  const ids = p.members.map((m) => m.id);
  const shapes: { label: string; pos: [number, number][] }[] = [
    { label: '横一列', pos: lineUp(p.members).map((q) => [q.x, q.y]) },
    { label: 'V字', pos: [[0.5, 0.75], [0.38, 0.6], [0.62, 0.6], [0.26, 0.45], [0.74, 0.45], [0.5, 0.3]] },
    { label: '2列', pos: [[0.3, 0.4], [0.5, 0.4], [0.7, 0.4], [0.3, 0.7], [0.5, 0.7], [0.7, 0.7]] },
    { label: '円', pos: ids.map((_, i) => [0.5 + 0.25 * Math.cos((i / ids.length) * Math.PI * 2), 0.5 + 0.25 * Math.sin((i / ids.length) * Math.PI * 2)] as [number, number]) },
  ];
  const clips: Clip[] = shapes.map((s, i) => ({
    id: newId('cl'),
    trackId: formationTrack.id,
    start: i * eight * 2,
    duration: eight * 1.5,
    label: s.label,
    sourceIn: 0,
    rate: 1,
    positions: s.pos.map(([x, y], k) => ({ memberId: ids[k], x, y })),
  }));
  clips.push(
    { id: newId('cl'), trackId: memoTrack.id, start: 0, duration: eight, label: 'イントロ', text: '全員下を向いてスタート', sourceIn: 0, rate: 1 },
    { id: newId('cl'), trackId: memoTrack.id, start: eight * 4, duration: eight, label: 'サビ前', text: '目線は客席の奥', sourceIn: 0, rate: 1 },
  );
  p.clips = clips;
  p.markers = [
    { id: newId('mk'), time: 0, label: 'イントロ', color: '#ff9f1c' },
    { id: newId('mk'), time: eight * 2, label: 'Aメロ', color: '#3d8bff' },
    { id: newId('mk'), time: eight * 4, label: 'サビ', color: '#ff5a5f' },
    { id: newId('mk'), time: eight * 8, label: 'END', color: '#2ec27e' },
  ];
  return p;
};
