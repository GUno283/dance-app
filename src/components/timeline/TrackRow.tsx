import React, { memo, useState } from 'react';
import { LuEllipsisVertical, LuVolume2, LuVolumeX } from 'react-icons/lu';
import type { Asset, Clip, Track } from '../../types';
import { useProject } from '../../store/projectStore';
import { useUi } from '../../store/uiStore';
import { useMediaUrls } from '../../lib/media';
import { commands } from '../../lib/commands';
import { clipEnd, findSnap, fitToRange, sortedMarkers } from '../../lib/timeline';
import { TRACK_COLORS } from '../../lib/factory';
import { newId } from '../../lib/id';
import { importFiles } from '../../lib/importMedia';
import { TextField } from '../common/Fields';
import { ASSET_MIME } from '../library/Library';
import { ClipView } from './ClipView';
import { HEAD_W, SNAP_PX, TRACK_H, collectTargets } from './geometry';

interface Props {
  track: Track;
  clips: Clip[];
  assets: Asset[];
  pps: number;
  selectedClipId: string | null;
  index: number;
  count: number;
}

const KIND_LABEL: Record<Track['kind'], string> = { audio: '音源', video: '動画', formation: '隊形', memo: 'メモ' };

const timeAtEvent = (e: React.MouseEvent | React.DragEvent, pps: number) => {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  return Math.max(0, (e.clientX - r.left) / pps);
};

export const TrackRow: React.FC<Props> = memo(({ track, clips, assets, pps, selectedClipId, index, count }) => {
  const missing = useMediaUrls((s) => s.missing);
  const commit = useProject((s) => s.commit);
  const [dropOk, setDropOk] = useState(false);
  const h = TRACK_H[track.kind];

  // 隊形クリップ間の「移動」区間
  const transitions =
    track.kind === 'formation'
      ? [...clips].sort((a, b) => a.start - b.start).flatMap((c, i, arr) => {
          const n = arr[i + 1];
          return n && n.start > clipEnd(c) ? [{ from: clipEnd(c), to: n.start, key: c.id }] : [];
        })
      : [];

  const headMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    useUi.getState().openMenu(e, [
      { label: '上へ移動', disabled: index === 0, onClick: () => commit((d) => void d.tracks.splice(index - 1, 0, d.tracks.splice(index, 1)[0])) },
      { label: '下へ移動', disabled: index === count - 1, onClick: () => commit((d) => void d.tracks.splice(index + 1, 0, d.tracks.splice(index, 1)[0])) },
      'sep',
      {
        label: 'トラックを削除',
        danger: true,
        onClick: () => {
          if (clips.length && !window.confirm(`「${track.name}」と ${clips.length} 個のクリップを削除しますか？`)) return;
          commit((d) => {
            d.tracks = d.tracks.filter((t) => t.id !== track.id);
            d.clips = d.clips.filter((c) => c.trackId !== track.id);
          });
        },
      },
    ]);
  };

  const laneMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const t = timeAtEvent(e, pps);
    const ui = useUi.getState();
    const clip = ui.clipboard;
    ui.openMenu(e, [
      { label: 'ここに貼り付け', shortcut: 'Ctrl+V', disabled: !clip, onClick: () => commands.paste(t, track.id) },
      { label: 'ここにマーカーを追加', onClick: () => useProject.getState().project && (useUi.getState().setTime(t), commands.addMarker()) },
      ...(track.kind === 'memo' ? [{ label: 'ここにメモを追加', onClick: () => commands.addMemo(t, track.id) }] : []),
      ...(track.kind === 'formation' ? [{ label: 'ここに隊形を追加', onClick: () => commands.addFormation(t) }] : []),
    ]);
  };

  const accepts = (e: React.DragEvent) =>
    (e.dataTransfer.types.includes(ASSET_MIME) && (track.kind === 'audio' || track.kind === 'video')) ||
    (e.dataTransfer.types.includes('Files') && (track.kind === 'audio' || track.kind === 'video'));

  const onDragOver = (e: React.DragEvent) => {
    if (!accepts(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!dropOk) setDropOk(true);
  };

  const onDrop = (e: React.DragEvent) => {
    setDropOk(false);
    useUi.setState({ snapGuide: null });
    const t0 = timeAtEvent(e, pps);
    if (e.dataTransfer.files.length) {
      e.preventDefault();
      void importFiles(Array.from(e.dataTransfer.files), { trackId: track.id, start: t0 });
      return;
    }
    const assetId = e.dataTransfer.getData(ASSET_MIME);
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;
    e.preventDefault();
    if (asset.kind !== track.kind) {
      useUi.getState().notify(`${KIND_LABEL[asset.kind]}は${KIND_LABEL[asset.kind]}トラックに置いてください`, 'warn');
      return;
    }
    const p = useProject.getState().project!;
    const ui = useUi.getState();
    let start = t0;
    const snap = ui.snap ? findSnap([start], collectTargets(p, ui.currentTime), (SNAP_PX * 1.5) / pps) : null;
    if (snap) start += snap.delta;
    let clip: Clip = { id: newId('cl'), trackId: track.id, start, duration: asset.duration, label: asset.name, assetId: asset.id, sourceIn: 0, rate: 1, color: TRACK_COLORS[asset.kind] };
    let fitted = false;
    if (ui.autoFit && track.kind === 'video' && snap?.target.kind === 'marker') {
      const b = sortedMarkers(p.markers).find((m) => m.time > start + 0.01);
      const res = b ? fitToRange(clip, start, b.time) : null;
      if (res?.ok) {
        clip = res.clip;
        fitted = true;
      }
    }
    commit((d) => void d.clips.push(clip));
    ui.selectClip(clip.id);
    if (fitted) ui.notify(`マーカー区間にフィット (速度 ×${clip.rate.toFixed(2)})`);
  };

  return (
    <div className="tl-row" style={{ height: h }}>
      <div className="tl-head" onContextMenu={headMenu}>
        <span className="track-color" style={{ background: TRACK_COLORS[track.kind] }} />
        <TextField className="track-name" value={track.name} onCommit={(v) => commit((d) => void (d.tracks.find((t) => t.id === track.id)!.name = v || track.name))} ariaLabel="トラック名" />
        {(track.kind === 'audio' || track.kind === 'video') && (
          <button
            className={`icon-btn sm${track.muted ? '' : ' active'}`}
            title={track.muted ? 'ミュート中 (クリックで音を出す)' : '音を出している (クリックでミュート)'}
            onClick={() => commit((d) => void (d.tracks.find((t) => t.id === track.id)!.muted = !track.muted))}
          >
            {track.muted ? <LuVolumeX /> : <LuVolume2 />}
          </button>
        )}
        <button className="icon-btn sm" title="トラックのメニュー" onClick={headMenu}><LuEllipsisVertical /></button>
      </div>
      <div
        className={`tl-lane${dropOk ? ' drop-ok' : ''}`}
        data-track-id={track.id}
        onPointerDown={(e) => {
          if (e.button !== 0 || e.target !== e.currentTarget) return;
          const ui = useUi.getState();
          ui.set({ selectedClipId: null, selectedMarkerId: null });
          ui.setTime(timeAtEvent(e, pps));
        }}
        onDoubleClick={(e) => {
          if (e.target !== e.currentTarget) return;
          const t = timeAtEvent(e, pps);
          if (track.kind === 'memo') commands.addMemo(t, track.id);
          if (track.kind === 'formation') commands.addFormation(t);
        }}
        onContextMenu={laneMenu}
        onDragOver={onDragOver}
        onDragLeave={() => setDropOk(false)}
        onDrop={onDrop}
      >
        {transitions.map((tr) => (
          <div key={tr.key} className="transition-band" style={{ left: tr.from * pps, width: (tr.to - tr.from) * pps }} title="移動" />
        ))}
        {clips.map((c) => (
          <ClipView
            key={c.id}
            clip={c}
            track={track}
            asset={c.assetId ? assets.find((a) => a.id === c.assetId) : undefined}
            pps={pps}
            selected={selectedClipId === c.id}
            missing={!!c.assetId && !!missing[c.assetId]}
          />
        ))}
        {clips.length === 0 && (
          <span className="hint" style={{ position: 'sticky', left: HEAD_W, top: 0, lineHeight: `${h}px`, paddingLeft: 10, pointerEvents: 'none' }}>
            {{
              audio: '音源をここへドラッグ',
              video: '振付動画をここへドラッグ (先頭をマーカーに合わせると自動フィット)',
              formation: 'ダブルクリックで隊形を追加',
              memo: 'ダブルクリックでメモを追加',
            }[track.kind]}
          </span>
        )}
      </div>
    </div>
  );
});
