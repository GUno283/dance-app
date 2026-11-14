import React, { memo } from 'react';
import type { Asset, Clip, Track } from '../../types';
import { useProject } from '../../store/projectStore';
import { useUi } from '../../store/uiStore';
import { commands } from '../../lib/commands';
import {
  findSnap, fitToRange, sortedMarkers, stretchEnd, stretchStart, trimEnd, trimStart, clipEnd, type SnapTarget,
} from '../../lib/timeline';
import { sliceWaveform } from '../../lib/audio';
import { formatCount, timeToCount } from '../../lib/time';
import { TRACK_COLORS } from '../../lib/factory';
import { openInSource } from '../library/Library';
import { SNAP_PX, beatTargets, collectTargets } from './geometry';

interface Props {
  clip: Clip;
  track: Track;
  asset?: Asset;
  pps: number;
  selected: boolean;
  missing: boolean;
}

type Mode = 'move' | 'l' | 'r';

const startDrag = (e: React.PointerEvent, mode: Mode, clip: Clip, track: Track, asset?: Asset) => {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const ui = useUi.getState();
  ui.selectClip(clip.id);
  // 隊形クリップを選んだら、編集できるよう再生ヘッドをクリップ内へ
  if (clip.positions && mode === 'move' && (ui.currentTime < clip.start || ui.currentTime >= clipEnd(clip))) {
    ui.setTime(clip.start);
  }

  const ps = useProject.getState();
  const project = ps.project!;
  const targets: SnapTarget[] = collectTargets(project, ui.currentTime, [clip.id]);
  const markers = sortedMarkers(project.markers);
  const startX = e.clientX;
  const pps = ui.pxPerSec;
  let moved = false;
  let fittedRate: number | null = null;
  ps.beginGesture();

  const move = (ev: PointerEvent) => {
    const dx = ev.clientX - startX;
    if (!moved && Math.abs(dx) < 3) return;
    moved = true;
    const dt = dx / pps;
    const u = useUi.getState();
    const snapOn = u.snap && !ev.shiftKey;
    const thr = SNAP_PX / pps;
    const snapFor = (times: number[]) =>
      snapOn ? findSnap(times, [...targets, ...beatTargets(project, times, pps)], thr) : null;
    let next: Clip = clip;
    let guide: number | null = null;
    fittedRate = null;

    if (mode === 'move') {
      let start = Math.max(0, clip.start + dt);
      const snap = snapFor([start, start + clip.duration]);
      if (snap) {
        start = Math.max(0, start + snap.delta);
        guide = snap.target.time;
      }
      // 同じ種類のトラックへ移動
      let trackId = clip.trackId;
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-track-id]');
      const over = el ? useProject.getState().project!.tracks.find((t) => t.id === el.dataset.trackId) : undefined;
      if (over && over.kind === track.kind) trackId = over.id;
      next = { ...clip, start, trackId };
      // マーカー自動フィット: 先頭がマーカーに吸着したら次のマーカーまでに収める
      if (u.autoFit && clip.assetId && track.kind === 'video' && snap && snap.index === 0 && snap.target.kind === 'marker') {
        const b = markers.find((m) => m.time > snap.target.time + 0.01);
        if (b) {
          const res = fitToRange(clip, snap.target.time, b.time);
          if (res.ok) {
            next = { ...res.clip, trackId };
            fittedRate = res.clip.rate;
            guide = b.time;
          }
        }
      }
    } else if (mode === 'l') {
      let t = clip.start + dt;
      const snap = snapFor([t]);
      if (snap) {
        t += snap.delta;
        guide = snap.target.time;
      }
      next = ev.altKey && clip.assetId ? stretchStart(clip, t) : trimStart(clip, t);
    } else {
      let t = clipEnd(clip) + dt;
      const snap = snapFor([t]);
      if (snap) {
        t += snap.delta;
        guide = snap.target.time;
      }
      next = ev.altKey && clip.assetId ? stretchEnd(clip, t) : trimEnd(clip, t, asset?.duration);
    }

    useProject.getState().preview((d) => {
      const c = d.clips.find((x) => x.id === clip.id);
      if (c) Object.assign(c, { start: next.start, duration: next.duration, rate: next.rate, sourceIn: next.sourceIn, trackId: next.trackId });
    });
    if (u.snapGuide !== guide) useUi.setState({ snapGuide: guide });
  };

  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('keydown', key);
    useProject.getState().endGesture();
    useUi.setState({ snapGuide: null });
    if (moved && fittedRate !== null) useUi.getState().notify(`マーカー区間にフィット (速度 ×${fittedRate.toFixed(2)})`);
  };
  // Esc でドラッグを取り消し
  const key = (ev: KeyboardEvent) => {
    if (ev.key !== 'Escape') return;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('keydown', key);
    useProject.getState().cancelGesture();
    useUi.setState({ snapGuide: null });
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('keydown', key);
};

const Waveform: React.FC<{ asset: Asset; clip: Clip; width: number }> = memo(({ asset, clip, width }) => {
  if (!asset.waveform) return null;
  const bins = Math.max(10, Math.min(1500, Math.floor(width / 2)));
  const data = sliceWaveform(asset.waveform, clip.sourceIn, clip.sourceIn + clip.duration * clip.rate, bins);
  if (!data.length) return null;
  const d = data.map((v, i) => `M${i},${50 - (v / 255) * 48}V${50 + (v / 255) * 48}`).join('');
  return (
    <svg className="clip-wave" viewBox={`0 0 ${data.length} 100`} preserveAspectRatio="none">
      <path d={d} stroke="rgba(0,0,0,.65)" strokeWidth={Math.max(0.6, data.length / width)} />
    </svg>
  );
});

const openMenu = (e: React.MouseEvent, clip: Clip, asset?: Asset) => {
  e.preventDefault();
  e.stopPropagation();
  const ui = useUi.getState();
  ui.selectClip(clip.id);
  const hasMarkers = (useProject.getState().project?.markers.length ?? 0) >= 2;
  ui.openMenu(e, [
    { label: '再生ヘッドで分割', shortcut: 'S', onClick: commands.split },
    { label: '複製', shortcut: 'Ctrl+D', onClick: commands.duplicate },
    { label: 'コピー', shortcut: 'Ctrl+C', onClick: commands.copy },
    { label: 'カット', shortcut: 'Ctrl+X', onClick: commands.cut },
    'sep',
    ...(asset
      ? [
          { label: 'マーカー区間にフィット', shortcut: 'F', disabled: !hasMarkers, onClick: commands.fitSelected },
          { label: '速度を ×1 に戻す', disabled: Math.abs(clip.rate - 1) < 1e-3, onClick: commands.resetRate },
          { label: '素材モニターで範囲を調整', onClick: () => openInSource(asset, clip.id) },
          'sep' as const,
        ]
      : []),
    { label: 'このクリップの範囲をループ', onClick: () => commands.loopRange(clip.start, clipEnd(clip)) },
    'sep',
    { label: '削除', shortcut: 'Del', danger: true, onClick: commands.deleteSelection },
  ]);
};

export const ClipView: React.FC<Props> = memo(({ clip, track, asset, pps, selected, missing }) => {
  const width = Math.max(4, clip.duration * pps);
  const color = clip.color ?? TRACK_COLORS[track.kind];
  const rate = clip.assetId && Math.abs(clip.rate - 1) > 0.005 ? clip.rate : null;
  const bpm = useProject((s) => s.project!.bpm);
  const off = useProject((s) => s.project!.beatOffset);

  return (
    <div
      className={`clip${selected ? ' sel' : ''}${missing ? ' missing' : ''}`}
      style={{ left: clip.start * pps, width, background: color }}
      onPointerDown={(e) => startDrag(e, 'move', clip, track, asset)}
      onContextMenu={(e) => openMenu(e, clip, asset)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (asset && !missing) openInSource(asset, clip.id);
      }}
      title={`${clip.label}\n${formatCount(timeToCount(clip.start, bpm, off))} 〜 ${formatCount(timeToCount(clipEnd(clip) - 0.001, bpm, off))}${rate ? `\n速度 ×${rate.toFixed(3)}` : ''}${asset ? '\nダブルクリックで範囲を調整 / Alt+端ドラッグで速度変更' : ''}`}
    >
      {asset?.kind === 'audio' && <Waveform asset={asset} clip={clip} width={width} />}
      <div className="clip-label">
        {rate && <span className={`clip-rate ${rate > 1 ? 'fast' : 'slow'}`}>×{rate.toFixed(2)}</span>}
        <span>{clip.label || (track.kind === 'memo' ? 'メモ' : '')}</span>
      </div>
      {track.kind === 'memo' && clip.text && <div className="clip-sub">{clip.text}</div>}
      {track.kind === 'formation' && <div className="clip-sub">{clip.positions?.length ?? 0}人</div>}
      {missing && <div className="clip-sub">メディアがありません</div>}
      <div className="clip-handle l" onPointerDown={(e) => startDrag(e, 'l', clip, track, asset)} />
      <div className="clip-handle r" onPointerDown={(e) => startDrag(e, 'r', clip, track, asset)} />
    </div>
  );
});
