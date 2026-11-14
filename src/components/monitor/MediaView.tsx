import React from 'react';
import { useProject } from '../../store/projectStore';
import { useUi } from '../../store/uiStore';
import { registerTrackMedia } from '../../lib/engine';
import { activeClipAt } from '../../lib/timeline';
import { formatCount, timeToCount } from '../../lib/time';

/** 音源トラックの <audio>。表示モードに関係なく常にマウントしておく */
export const AudioElements: React.FC = () => {
  const tracks = useProject((s) => s.project!.tracks);
  return (
    <div style={{ display: 'none' }}>
      {tracks
        .filter((t) => t.kind === 'audio')
        .map((t) => (
          <audio key={t.id} ref={(el) => registerTrackMedia(t.id, el)} preload="auto" />
        ))}
    </div>
  );
};

/** タイムラインの動画表示 (単一 / マルチアングル) */
export const VideoView: React.FC<{ showCount?: boolean }> = ({ showCount = true }) => {
  const tracks = useProject((s) => s.project!.tracks);
  const hasClips = useProject((s) => s.project!.clips.some((c) => c.assetId));
  const layout = useUi((s) => s.videoLayout);
  const mirror = useUi((s) => s.mirror);
  const videoTracks = tracks.filter((t) => t.kind === 'video');
  const grid = layout === 'grid' && videoTracks.length > 1;
  const cols = Math.ceil(Math.sqrt(videoTracks.length));

  return (
    <div className="monitor-view">
      {!hasClips && (
        <div className="monitor-empty">
          ここに振付動画が表示されます
          <br />
          <small>左のメディアから動画をタイムラインへドラッグ</small>
        </div>
      )}
      {grid ? (
        <div className={`video-grid${mirror ? ' mirrored' : ''}`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {videoTracks.map((t) => (
            <div key={t.id} className="video-tile">
              <video ref={(el) => registerTrackMedia(t.id, el)} playsInline preload="auto" />
              <span className="tile-label">{t.name}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className={`video-single${mirror ? ' mirrored' : ''}`}>
          {videoTracks.map((t) => (
            <video key={t.id} ref={(el) => registerTrackMedia(t.id, el)} playsInline preload="auto" />
          ))}
        </div>
      )}
      <MemoOverlay />
      {showCount && <CountBadge />}
    </div>
  );
};

const MemoOverlay: React.FC = () => {
  const show = useUi((s) => s.showMemo);
  // 選択関数内で計算し、表示内容が変わったときだけ再描画する
  const memo = useUi((s) => {
    const p = useProject.getState().project;
    if (!p || !s.showMemo) return '';
    for (const t of p.tracks) {
      if (t.kind !== 'memo') continue;
      const c = activeClipAt(p.clips, t.id, s.currentTime);
      if (c && (c.text || c.label)) return `${c.label}\u0000${c.text ?? ''}`;
    }
    return '';
  });
  if (!show || !memo) return null;
  const [label, text] = memo.split('\u0000');
  return (
    <div className="memo-overlay">
      {text ? (
        <>
          <small>{label}</small>
          {text}
        </>
      ) : (
        label
      )}
    </div>
  );
};

export const useCount = () => {
  const bpm = useProject((s) => s.project!.bpm);
  const offset = useProject((s) => s.project!.beatOffset);
  return useUi((s) => {
    const c = timeToCount(s.currentTime, bpm, offset);
    return `${c.eight}|${c.count}`;
  });
};

const CountBadge: React.FC = () => {
  const key = useCount();
  const [eight, count] = key.split('|').map(Number);
  return <div className="count-overlay">{formatCount({ eight, count, phase: 0 })}</div>;
};
