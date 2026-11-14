import React, { useRef } from 'react';
import { LuColumns2, LuFlipHorizontal2, LuMessageSquareText, LuSquare } from 'react-icons/lu';
import { useUi } from '../../store/uiStore';
import { useProject, actions } from '../../store/projectStore';
import { registerSourceMedia } from '../../lib/engine';
import { formatTime } from '../../lib/time';
import { fitToRange, markerRangeAt, clipEnd } from '../../lib/timeline';
import { sliceWaveform } from '../../lib/audio';
import { newId } from '../../lib/id';
import { TRACK_COLORS } from '../../lib/factory';
import type { Clip } from '../../types';
import { VideoView } from './MediaView';
import { Transport } from './Transport';

export const Monitor: React.FC = () => {
  const mode = useUi((s) => s.monitorMode);
  const mirror = useUi((s) => s.mirror);
  const layout = useUi((s) => s.videoLayout);
  const showMemo = useUi((s) => s.showMemo);
  const set = useUi((s) => s.set);
  const multi = useProject((s) => s.project!.tracks.filter((t) => t.kind === 'video').length > 1);

  return (
    <>
      <div className="monitor-modebar">
        <div className="seg">
          <button className={mode === 'timeline' ? 'on' : ''} onClick={() => set({ monitorMode: 'timeline', isPlaying: false })}>タイムライン</button>
          <button className={mode === 'source' ? 'on' : ''} onClick={() => set({ monitorMode: 'source', isPlaying: false })}>素材モニター</button>
        </div>
        <div className="spacer" />
        <button className={`icon-btn${mirror ? ' active' : ''}`} title="左右反転 (鏡の向きで見る)" onClick={() => set({ mirror: !mirror })}><LuFlipHorizontal2 /></button>
        {mode === 'timeline' && (
          <>
            <button
              className={`icon-btn${layout === 'grid' ? ' active' : ''}`}
              title={multi ? 'マルチアングル表示 (すべての動画トラックを並べる)' : '動画トラックが 2 本以上あると並べて表示できます'}
              disabled={!multi}
              onClick={() => set({ videoLayout: layout === 'grid' ? 'single' : 'grid' })}
            >
              {layout === 'grid' ? <LuColumns2 /> : <LuSquare />}
            </button>
            <button className={`icon-btn${showMemo ? ' active' : ''}`} title="メモを映像に重ねて表示" onClick={() => set({ showMemo: !showMemo })}><LuMessageSquareText /></button>
          </>
        )}
      </div>
      {mode === 'timeline' ? <VideoView /> : <SourceView />}
      <Transport />
    </>
  );
};

// ---------------- 素材モニター ----------------

const SourceView: React.FC = () => {
  const source = useUi((s) => s.source);
  const mirror = useUi((s) => s.mirror);
  const asset = useProject((s) => s.project!.assets.find((a) => a.id === source.assetId));
  const targetClip = useProject((s) => (source.clipId ? s.project!.clips.find((c) => c.id === source.clipId) : undefined));
  const autoFit = useUi((s) => s.autoFit);
  const hasMarkers = useProject((s) => s.project!.markers.length >= 2);

  if (!asset)
    return (
      <div className="monitor-view">
        <div className="monitor-empty">
          メディアをダブルクリック (または ✂ ボタン) で開くと、
          <br />
          イン点 / アウト点を決めてからタイムラインへ追加できます。
          <br />
          <small>タイムラインのクリップをダブルクリックすると、そのクリップの範囲を調整できます</small>
        </div>
      </div>
    );

  const len = Math.max(0.1, source.out - source.in);
  const ui = () => useUi.getState();

  const place = (fit: boolean) => {
    const p = useProject.getState().project!;
    const track = p.tracks.find((t) => t.kind === asset.kind);
    if (!track) return ui().notify('対応するトラックがありません', 'warn');
    const t = ui().currentTime;
    let clip: Clip = { id: newId('cl'), trackId: track.id, start: t, duration: len, label: asset.name, assetId: asset.id, sourceIn: source.in, rate: 1, color: TRACK_COLORS[asset.kind] };
    if (fit) {
      const r = markerRangeAt(p.markers, t);
      if (!r) return ui().notify('再生ヘッドの前後にマーカーがありません', 'warn');
      const res = fitToRange(clip, r[0], r[1]);
      if (!res.ok) return ui().notify(res.reason, 'warn');
      clip = res.clip;
    }
    actions.addClip(clip);
    useUi.setState({ monitorMode: 'timeline', selectedClipId: clip.id, selectedMarkerId: null, isPlaying: false });
    ui().notify(fit ? `マーカー区間に追加 (速度 ×${clip.rate.toFixed(2)})` : 'タイムラインに追加しました');
  };

  const updateClip = () => {
    if (!targetClip) return;
    const p = useProject.getState().project!;
    const onMarker = (x: number) => p.markers.some((m) => Math.abs(m.time - x) < 0.02);
    // マーカー区間にぴったり置かれているクリップは、区間を保ったまま速度で合わせる
    if (autoFit && onMarker(targetClip.start) && onMarker(clipEnd(targetClip))) {
      const res = fitToRange({ ...targetClip, sourceIn: source.in, duration: len, rate: 1 }, targetClip.start, clipEnd(targetClip));
      if (res.ok) {
        actions.updateClip(targetClip.id, { sourceIn: source.in, assetId: asset.id, rate: res.clip.rate, duration: res.clip.duration });
        useUi.setState({ monitorMode: 'timeline', isPlaying: false });
        return ui().notify(`区間を保って更新 (速度 ×${res.clip.rate.toFixed(2)})`);
      }
    }
    actions.updateClip(targetClip.id, { sourceIn: source.in, assetId: asset.id, duration: len / targetClip.rate });
    useUi.setState({ monitorMode: 'timeline', isPlaying: false });
    ui().notify('クリップの範囲を更新しました');
  };

  return (
    <>
      <div className="monitor-view">
        {asset.kind === 'video' ? (
          <div className={`video-single${mirror ? ' mirrored' : ''}`}>
            <video ref={registerSourceMedia} playsInline preload="auto" style={{ display: 'block' }} />
          </div>
        ) : (
          <div className="monitor-empty" style={{ pointerEvents: 'auto' }}>
            <div style={{ fontSize: 15, color: 'var(--text)' }}>♪ {asset.name}</div>
            <audio ref={registerSourceMedia} preload="auto" />
          </div>
        )}
        <div className="count-overlay" style={{ fontSize: 13, left: 12, right: 'auto' }}>素材: {asset.name}</div>
      </div>
      <TrimBar duration={asset.duration} waveform={asset.waveform} />
      <div className="row" style={{ padding: '8px 10px', background: 'var(--bg-1)', borderTop: '1px solid var(--line)', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="btn sm" title="イン点 (I)" onClick={() => useUi.setState({ source: { ...source, in: Math.min(source.time, source.out - 0.1) } })}>{'{'} イン点</button>
        <button className="btn sm" title="アウト点 (O)" onClick={() => useUi.setState({ source: { ...source, out: Math.max(source.time, source.in + 0.1) } })}>アウト点 {'}'}</button>
        <span className="muted" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>長さ {formatTime(len)}</span>
        <div className="spacer" />
        {targetClip && (
          <button className="btn sm active" onClick={updateClip} title="タイムライン上の元のクリップに反映">
            クリップを更新
          </button>
        )}
        <button className="btn sm" disabled={!hasMarkers} onClick={() => place(true)} title="再生ヘッドを含むマーカー区間に、速度を合わせて追加">
          マーカー区間にフィット
        </button>
        <button className="btn sm primary" onClick={() => place(false)} title="再生ヘッドの位置に追加">
          再生ヘッドに追加
        </button>
      </div>
    </>
  );
};

const TrimBar: React.FC<{ duration: number; waveform?: number[] }> = ({ duration, waveform }) => {
  const source = useUi((s) => s.source);
  const ref = useRef<HTMLDivElement>(null);
  const pct = (t: number) => `${(t / Math.max(0.001, duration)) * 100}%`;

  const timeAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.min(duration, Math.max(0, ((clientX - r.left) / r.width) * duration));
  };

  const drag = (e: React.PointerEvent, what: 'in' | 'out' | 'seek') => {
    e.preventDefault();
    e.stopPropagation();
    useUi.setState({ isPlaying: false });
    const apply = (x: number) => {
      const s = useUi.getState().source;
      const t = timeAt(x);
      if (what === 'in') useUi.setState({ source: { ...s, in: Math.min(t, s.out - 0.1), time: Math.min(t, s.out - 0.1) } });
      else if (what === 'out') useUi.setState({ source: { ...s, out: Math.max(t, s.in + 0.1), time: Math.max(t, s.in + 0.1) } });
      else useUi.setState({ source: { ...s, time: t } });
    };
    apply(e.clientX);
    const move = (ev: PointerEvent) => apply(ev.clientX);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const bars = waveform ? sliceWaveform(waveform, 0, duration, 400) : null;

  return (
    <div className="trimbar">
      <div className="trim-track" ref={ref} onPointerDown={(e) => drag(e, 'seek')}>
        {bars && (
          <svg className="trim-wave" viewBox={`0 0 ${bars.length} 100`} preserveAspectRatio="none">
            <path d={bars.map((v, i) => `M${i},${50 - (v / 255) * 48}V${50 + (v / 255) * 48}`).join('')} stroke="#9fb7ff" strokeWidth={0.8} />
          </svg>
        )}
        <div className="trim-range" style={{ left: pct(source.in), width: pct(source.out - source.in) }} />
        <div className="trim-handle" style={{ left: pct(source.in) }} onPointerDown={(e) => drag(e, 'in')} title="イン点をドラッグ" />
        <div className="trim-handle" style={{ left: pct(source.out) }} onPointerDown={(e) => drag(e, 'out')} title="アウト点をドラッグ" />
        <div className="trim-head" style={{ left: pct(source.time) }} />
      </div>
      <div className="trim-info">
        <span>IN {formatTime(source.in)}</span>
        <span>{formatTime(source.time)}</span>
        <span>OUT {formatTime(source.out)}</span>
      </div>
    </div>
  );
};
