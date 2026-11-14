import { actions, useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';
import type { Clip, Project, Track } from '../types';
import { newId } from './id';
import { clipEnd, fitToRange, markerRangeAt, projectDuration, sortedMarkers } from './timeline';
import { formationAt, lineUp } from './formation';
import { beatLength, clamp } from './time';
import { TRACK_COLORS, makeTrack } from './factory';

const P = () => useProject.getState().project;
const U = () => useUi.getState();

export const selectedClip = (): Clip | undefined => {
  const id = U().selectedClipId;
  return id ? P()?.clips.find((c) => c.id === id) : undefined;
};

const eightSec = (p: Project) => beatLength(p.bpm) * 8;

export const commands = {
  togglePlay: () => {
    const ui = U();
    if (ui.monitorMode === 'source' && !ui.source.assetId) return;
    ui.set({ isPlaying: !ui.isPlaying });
  },

  stop: () => U().set({ isPlaying: false }),

  seek: (t: number) => {
    const ui = U();
    if (ui.monitorMode === 'source') {
      const dur = P()?.assets.find((a) => a.id === ui.source.assetId)?.duration ?? t;
      ui.set({ source: { ...ui.source, time: clamp(t, 0, dur) } });
    } else {
      const p = P();
      ui.setTime(p ? Math.min(t, Math.max(projectDuration(p), 0)) : t);
    }
  },

  step: (frames: number) => {
    const ui = U();
    const cur = ui.monitorMode === 'source' ? ui.source.time : ui.currentTime;
    commands.seek(cur + frames / 30);
  },

  stepBeat: (beats: number) => {
    const p = P();
    if (!p) return;
    const ui = U();
    const bl = beatLength(p.bpm);
    const cur = ui.currentTime;
    // 拍のグリッドにそろえて移動
    const idx = Math.round((cur - p.beatOffset) / bl);
    const onGrid = Math.abs(p.beatOffset + idx * bl - cur) < 0.01;
    const base = onGrid ? idx : beats > 0 ? Math.floor((cur - p.beatOffset) / bl) : Math.ceil((cur - p.beatOffset) / bl);
    ui.setTime(p.beatOffset + (base + beats) * bl);
  },

  jumpMarker: (dir: 1 | -1) => {
    const p = P();
    if (!p) return;
    const t = U().currentTime;
    const ms = sortedMarkers(p.markers).map((m) => m.time);
    const points = [0, ...ms, projectDuration(p)];
    const target = dir > 0 ? points.find((x) => x > t + 0.01) : [...points].reverse().find((x) => x < t - 0.01);
    if (target !== undefined) U().setTime(target);
  },

  addMarker: () => {
    const id = actions.addMarker(U().currentTime);
    if (id) U().selectMarker(id);
  },

  deleteSelection: () => {
    const ui = U();
    if (ui.selectedClipId) {
      actions.removeClips([ui.selectedClipId]);
      ui.selectClip(null);
    } else if (ui.selectedMarkerId) {
      const id = ui.selectedMarkerId;
      useProject.getState().commit((d) => {
        d.markers = d.markers.filter((m) => m.id !== id);
      });
      ui.selectMarker(null);
    }
  },

  split: () => {
    const ui = U();
    const c = selectedClip();
    if (c) {
      const right = actions.splitAt(c.id, ui.currentTime);
      if (right) ui.selectClip(right);
      else ui.notify('再生ヘッドが選択中のクリップの上にありません', 'warn');
      return;
    }
    const n = actions.splitAllAt(ui.currentTime);
    if (!n) ui.notify('再生ヘッドの位置にクリップがありません', 'warn');
  },

  copy: () => {
    const c = selectedClip();
    if (c) {
      U().set({ clipboard: c });
      U().notify('クリップをコピーしました');
    }
  },

  cut: () => {
    const c = selectedClip();
    if (!c) return;
    U().set({ clipboard: c });
    actions.removeClips([c.id]);
    U().selectClip(null);
  },

  paste: (at?: number, trackId?: string) => {
    const ui = U();
    const p = P();
    const src = ui.clipboard;
    if (!p || !src) return;
    const srcTrack = p.tracks.find((t) => t.id === src.trackId);
    const kind = srcTrack?.kind ?? kindOfClip(src);
    let target = trackId ? p.tracks.find((t) => t.id === trackId) : srcTrack;
    if (!target || target.kind !== kind) target = p.tracks.find((t) => t.kind === kind);
    if (!target) {
      ui.notify('貼り付け先のトラックがありません', 'warn');
      return;
    }
    const clip: Clip = { ...src, id: newId('cl'), trackId: target.id, start: at ?? ui.currentTime, positions: src.positions?.map((q) => ({ ...q })) };
    actions.addClip(clip);
    ui.selectClip(clip.id);
  },

  duplicate: () => {
    const c = selectedClip();
    if (!c) return;
    const clip: Clip = { ...c, id: newId('cl'), start: clipEnd(c), positions: c.positions?.map((q) => ({ ...q })) };
    actions.addClip(clip);
    U().selectClip(clip.id);
  },

  /** 選択クリップを、開始位置を含むマーカー区間にフィット */
  fitSelected: () => {
    const ui = U();
    const p = P();
    const c = selectedClip();
    if (!p || !c) {
      ui.notify('フィットするクリップを選択してください', 'warn');
      return;
    }
    const range = markerRangeAt(p.markers, c.start + 0.001);
    if (!range) {
      ui.notify('クリップの開始位置の前後にマーカーが必要です', 'warn');
      return;
    }
    const res = fitToRange(c, range[0], range[1]);
    if (!res.ok) {
      ui.notify(res.reason, 'warn');
      return;
    }
    actions.updateClip(c.id, { start: res.clip.start, duration: res.clip.duration, rate: res.clip.rate });
    ui.notify(c.assetId ? `マーカー区間にフィット (速度 ×${res.clip.rate.toFixed(2)})` : 'マーカー区間にフィット');
  },

  resetRate: () => {
    const c = selectedClip();
    if (!c || !c.assetId) return;
    actions.updateClip(c.id, { duration: c.duration * c.rate, rate: 1 });
  },

  setLoopIn: () => {
    const ui = U();
    const t = ui.currentTime;
    const end = ui.loop.end > t ? ui.loop.end : t + 4;
    ui.set({ loop: { on: true, start: t, end } });
  },

  setLoopOut: () => {
    const ui = U();
    const t = ui.currentTime;
    const start = ui.loop.start < t ? ui.loop.start : Math.max(0, t - 4);
    ui.set({ loop: { on: true, start, end: t } });
  },

  toggleLoop: () => {
    const ui = U();
    const p = P();
    if (ui.loop.end - ui.loop.start < 0.05 && p) {
      // ループ区間がなければ現在のマーカー区間を使う
      const r = markerRangeAt(p.markers, ui.currentTime);
      if (r) return ui.set({ loop: { on: true, start: r[0], end: r[1] } });
    }
    ui.set({ loop: { ...ui.loop, on: !ui.loop.on } });
  },

  loopRange: (start: number, end: number) => {
    U().set({ loop: { on: true, start, end } });
    U().setTime(start);
  },

  zoom: (factor: number) => U().set({ pxPerSec: clamp(U().pxPerSec * factor, 2, 400) }),

  /** 再生ヘッドの位置に隊形を追加 (直前の隊形をコピー) */
  addFormation: (at?: number) => {
    const p = P();
    const ui = U();
    if (!p) return;
    const t = at ?? ui.currentTime;
    let track = p.tracks.find((x) => x.kind === 'formation');
    if (!track) {
      track = makeTrack('formation');
      const tr = track;
      useProject.getState().commit((d) => void d.tracks.push(tr));
    }
    const fclips = p.clips.filter((c) => c.trackId === track!.id);
    const st = formationAt(fclips, t);
    if (st.kind === 'hold') {
      ui.selectClip(st.clip.id);
      ui.notify('ここにはすでに隊形があります (ドラッグで編集できます)');
      return;
    }
    const next = fclips.filter((c) => c.start > t).sort((a, b) => a.start - b.start)[0];
    const maxDur = next ? next.start - t : Infinity;
    const duration = Math.max(0.2, Math.min(eightSec(p), maxDur * 0.5));
    const positions = st.kind === 'empty' ? lineUp(p.members) : st.positions.map((q) => ({ ...q }));
    const n = fclips.length + 1;
    const clip: Clip = { id: newId('cl'), trackId: track.id, start: t, duration, label: `隊形 ${n}`, sourceIn: 0, rate: 1, positions };
    actions.addClip(clip);
    ui.selectClip(clip.id);
  },

  addMemo: (at?: number, trackId?: string) => {
    const p = P();
    const ui = U();
    if (!p) return;
    let track: Track | undefined = trackId ? p.tracks.find((x) => x.id === trackId) : p.tracks.find((x) => x.kind === 'memo');
    if (!track) {
      const tr = makeTrack('memo');
      useProject.getState().commit((d) => void d.tracks.push(tr));
      track = tr;
    }
    const clip: Clip = { id: newId('cl'), trackId: track.id, start: at ?? ui.currentTime, duration: eightSec(p), label: 'メモ', text: '', sourceIn: 0, rate: 1, color: TRACK_COLORS.memo };
    actions.addClip(clip);
    ui.selectClip(clip.id);
  },

  undo: () => {
    useProject.getState().undo();
    validateSelection();
  },
  redo: () => {
    useProject.getState().redo();
    validateSelection();
  },
};

const kindOfClip = (c: Clip): Track['kind'] => {
  if (c.positions) return 'formation';
  if (c.text !== undefined && !c.assetId) return 'memo';
  const a = P()?.assets.find((x) => x.id === c.assetId);
  return a?.kind ?? 'video';
};

/** Undo/Redo 後に消えたクリップを選択したままにしない */
const validateSelection = () => {
  const p = P();
  const ui = U();
  if (!p) return;
  if (ui.selectedClipId && !p.clips.some((c) => c.id === ui.selectedClipId)) ui.selectClip(null);
  if (ui.selectedMarkerId && !p.markers.some((m) => m.id === ui.selectedMarkerId)) ui.selectMarker(null);
};
