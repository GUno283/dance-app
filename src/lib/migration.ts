import localforage from 'localforage';
import type { Asset, Clip, Marker, Member, Project, Track } from '../types';
import { newId } from './id';
import { newProject, shortName } from './factory';
import { putMedia } from './media';

/** 旧バージョン (dance-app-storage-v3) のデータ構造 (必要な部分だけ) */
interface OldClip {
  id: string;
  trackId: string;
  name: string;
  startAt: number;
  duration: number;
  color?: string;
  assetId?: string;
  offsetInAsset?: number;
  playbackRate?: number;
  textData?: string;
}
interface OldTrack {
  id: string;
  name: string;
  type: 'audio' | 'video' | 'formation' | 'memo' | 'section' | 'marker';
  order: number;
  clips: OldClip[];
}
interface OldAsset {
  id: string;
  type: 'audio' | 'video' | 'image' | 'formation';
  name: string;
  url: string;
  duration?: number;
  createdAt?: number;
  thumbnailUrl?: string;
  waveformData?: number[];
  formationData?: { positions: { userId: string; x: number; y: number }[] };
}
interface OldData {
  bpm: number;
  members: { id: string; name: string; color: string }[];
  assets: OldAsset[];
  tracks: OldTrack[];
}

const OLD_KEY = 'dance-app-storage-v3';

export const hasLegacyData = (): boolean => {
  try {
    const raw = localStorage.getItem(OLD_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw)?.state?.editorData as OldData | undefined;
    return !!data && Array.isArray(data.tracks);
  } catch {
    return false;
  }
};

export const migrateLegacy = async (): Promise<Project | null> => {
  const raw = localStorage.getItem(OLD_KEY);
  if (!raw) return null;
  const old = JSON.parse(raw)?.state?.editorData as OldData | undefined;
  if (!old) return null;

  const p = newProject('旧バージョンから読み込み', old.bpm || 120);
  p.tracks = [];
  p.members = (old.members ?? []).map<Member>((m) => ({ id: m.id, name: m.name, color: m.color, short: shortName(m.name) }));

  // メディア本体は旧 IndexedDB (dance-app-media / assets) から移す
  const oldMedia = localforage.createInstance({ name: 'dance-app-media', storeName: 'assets' });
  const assets: Asset[] = [];
  for (const a of old.assets ?? []) {
    if (a.type !== 'audio' && a.type !== 'video') continue;
    let blob: Blob | null = null;
    try {
      blob = await oldMedia.getItem<Blob>(a.id);
    } catch {
      blob = null;
    }
    if (blob) await putMedia(a.id, blob);
    assets.push({
      id: a.id,
      kind: a.type,
      name: a.name,
      duration: a.duration ?? 0,
      mime: blob?.type ?? '',
      size: blob?.size ?? 0,
      createdAt: a.createdAt ?? Date.now(),
      thumbnail: a.thumbnailUrl,
      waveform: a.waveformData?.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)),
    });
  }
  p.assets = assets;

  const clips: Clip[] = [];
  const markers: Marker[] = [];
  for (const t of [...old.tracks].sort((a, b) => a.order - b.order)) {
    if (t.type === 'marker' || t.type === 'section') {
      for (const c of t.clips) markers.push({ id: newId('mk'), time: c.startAt, label: c.name || 'マーク', color: c.color || '#ff9f1c' });
      continue;
    }
    const track: Track = { id: t.id, kind: t.type, name: t.name };
    p.tracks.push(track);
    for (const c of t.clips) {
      const base: Clip = {
        id: c.id,
        trackId: t.id,
        start: c.startAt,
        duration: c.duration,
        label: c.name,
        color: c.color,
        sourceIn: c.offsetInAsset ?? 0,
        rate: c.playbackRate ?? 1,
      };
      if (t.type === 'formation') {
        const fa = old.assets.find((a) => a.id === c.assetId);
        base.positions = (fa?.formationData?.positions ?? []).map((q) => ({ memberId: q.userId, x: q.x, y: q.y }));
      } else if (t.type === 'memo') {
        base.text = c.textData ?? '';
      } else if (assets.some((a) => a.id === c.assetId)) {
        base.assetId = c.assetId;
      } else {
        continue;
      }
      clips.push(base);
    }
  }
  for (const kind of ['audio', 'video', 'formation', 'memo'] as const) {
    if (!p.tracks.some((t) => t.kind === kind)) p.tracks.push({ id: newId('tr'), kind, name: { audio: '音源', video: '動画', formation: '隊形', memo: 'メモ' }[kind] });
  }
  p.clips = clips;
  p.markers = markers;
  return p;
};
