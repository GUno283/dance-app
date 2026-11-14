import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  LuBookmarkPlus, LuCrosshair, LuMagnet, LuMaximize2, LuPlus, LuScissors, LuWandSparkles, LuZoomIn, LuZoomOut,
} from 'react-icons/lu';
import { useProject } from '../../store/projectStore';
import { useUi } from '../../store/uiStore';
import { commands } from '../../lib/commands';
import { beatLength, clamp, formatShort } from '../../lib/time';
import { clipEnd, findSnap, projectDuration, stretchEnd, stretchStart, type SnapTarget } from '../../lib/timeline';
import { makeTrack, defaultTrackName } from '../../lib/factory';
import type { Clip, Marker, TrackKind } from '../../types';
import { TrackRow } from './TrackRow';
import { HEAD_W, SNAP_PX, beatTargets } from './geometry';

interface View {
  left: number;
  width: number;
}

export const Timeline: React.FC = () => {
  const project = useProject((s) => s.project!);
  const pps = useUi((s) => s.pxPerSec);
  const selectedClipId = useUi((s) => s.selectedClipId);
  const snap = useUi((s) => s.snap);
  const autoFit = useUi((s) => s.autoFit);
  const follow = useUi((s) => s.follow);
  const set = useUi((s) => s.set);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ left: 0, width: 1000 });
  const zoomAnchor = useRef<{ time: number; x: number } | null>(null);
  const prevPps = useRef(pps);

  const duration = projectDuration(project);
  const viewSec = (view.width - HEAD_W) / pps;
  const contentW = (Math.max(duration, viewSec) + 30) * pps;

  // スクロール位置の追跡 (表示範囲だけルーラーを描く)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setView({ left: el.scrollLeft, width: el.clientWidth }));
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  // Ctrl + ホイールでマウス位置を中心にズーム
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const cur = useUi.getState().pxPerSec;
      zoomAnchor.current = { time: (el.scrollLeft + x - HEAD_W) / cur, x };
      set({ pxPerSec: clamp(cur * Math.exp(-e.deltaY * 0.002), 2, 400) });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [set]);

  // ズーム後に基準点がずれないようスクロールを補正
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let a = zoomAnchor.current;
    if (!a) {
      // ボタン/キーでのズームは再生ヘッドを基準に (ズーム前の表示位置を保つ)
      const t = useUi.getState().currentTime;
      a = { time: t, x: clamp(HEAD_W + t * prevPps.current - el.scrollLeft, HEAD_W, el.clientWidth) };
    }
    prevPps.current = pps;
    el.scrollLeft = Math.max(0, a.time * pps + HEAD_W - a.x);
    zoomAnchor.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pps]);

  // 再生中は再生ヘッドを追いかける
  useEffect(() => {
    return useUi.subscribe((s, prev) => {
      if (!s.isPlaying || !s.follow || s.currentTime === prev.currentTime) return;
      const el = scrollRef.current;
      if (!el) return;
      const x = s.currentTime * s.pxPerSec;
      const visible = el.clientWidth - HEAD_W;
      if (x < el.scrollLeft || x > el.scrollLeft + visible - 40) el.scrollLeft = Math.max(0, x - 40);
    });
  }, []);

  const fitAll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const w = el.clientWidth - HEAD_W - 30;
    zoomAnchor.current = { time: 0, x: HEAD_W };
    set({ pxPerSec: clamp(w / Math.max(10, duration), 2, 400) });
  };

  const addTrack = (kind: TrackKind) => {
    const n = project.tracks.filter((t) => t.kind === kind).length + 1;
    const tr = makeTrack(kind, defaultTrackName(kind, n));
    useProject.getState().commit((d) => {
      // 同じ種類のトラックの直後に入れる
      const last = d.tracks.map((t) => t.kind).lastIndexOf(kind);
      d.tracks.splice(last >= 0 ? last + 1 : d.tracks.length, 0, tr);
    });
  };

  const trackMenu = (e: React.MouseEvent) =>
    useUi.getState().openMenu(e, [
      { label: '動画トラック (別アングル)', onClick: () => addTrack('video') },
      { label: '音源トラック', onClick: () => addTrack('audio') },
      { label: 'メモトラック', onClick: () => addTrack('memo') },
      { label: '隊形トラック', disabled: project.tracks.some((t) => t.kind === 'formation'), onClick: () => addTrack('formation') },
    ]);

  return (
    <>
      <div className="tl-toolbar" onMouseDown={(e) => e.target instanceof HTMLButtonElement && e.preventDefault()}>
        <button className="btn sm" onClick={commands.addMarker} title="再生ヘッドにマーカーを追加 (M)。再生中でも打てます"><LuBookmarkPlus /> マーカー</button>
        <button className="icon-btn" onClick={commands.split} title="再生ヘッドで分割 (S)"><LuScissors /></button>
        <button className="icon-btn" onClick={commands.fitSelected} disabled={!selectedClipId} title="選択クリップをマーカー区間にフィット (F)"><LuWandSparkles /></button>
        <div className="sep" />
        <button className={`icon-btn${snap ? ' active' : ''}`} onClick={() => set({ snap: !snap })} title="スナップ (マーカー・再生ヘッド・拍・クリップ端)。Shift で一時解除"><LuMagnet /></button>
        <button className={`btn sm${autoFit ? ' active' : ''}`} onClick={() => set({ autoFit: !autoFit })} title="動画の先頭をマーカーに合わせたとき、次のマーカーまでに収まるよう速度を自動調整">
          自動フィット {autoFit ? 'ON' : 'OFF'}
        </button>
        <button className={`icon-btn${follow ? ' active' : ''}`} onClick={() => set({ follow: !follow })} title="再生中に再生ヘッドを追いかける"><LuCrosshair /></button>
        <div className="sep" />
        <button className="icon-btn" onClick={() => commands.zoom(0.8)} title="縮小 (-)"><LuZoomOut /></button>
        <input
          type="range"
          min={Math.log(2)}
          max={Math.log(400)}
          step={0.01}
          value={Math.log(pps)}
          onChange={(e) => set({ pxPerSec: Math.exp(parseFloat(e.target.value)) })}
          style={{ width: 110 }}
          aria-label="ズーム"
        />
        <button className="icon-btn" onClick={() => commands.zoom(1.25)} title="拡大 (+)"><LuZoomIn /></button>
        <button className="icon-btn" onClick={fitAll} title="全体を表示"><LuMaximize2 /></button>
        <div className="spacer" />
        <span className="hint hide-narrow" style={{ marginRight: 6 }}>右クリックでメニュー / ? でショートカット</span>
        <button className="btn sm" onClick={trackMenu}><LuPlus /> トラック</button>
      </div>

      <div className="tl-scroll" ref={scrollRef}>
        <div className="tl-inner" style={{ width: HEAD_W + contentW }}>
          <div className="tl-sticky-top">
            <div className="tl-row">
              <div className="tl-head" style={{ height: 36, fontSize: 11, color: 'var(--text-3)' }}>
                BPM {project.bpm} <span style={{ marginLeft: 6 }}>エイト ▸</span>
              </div>
              <Ruler pps={pps} view={view} />
            </div>
            <div className="tl-row">
              <div className="tl-head" style={{ height: 26, fontSize: 11, color: 'var(--text-3)' }}>
                マーカー
                <div className="spacer" />
                <button className="icon-btn sm" title="マーカーを追加 (M)" onClick={commands.addMarker}><LuPlus /></button>
              </div>
              <MarkerLane pps={pps} />
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <BackgroundGrid pps={pps} width={contentW} />
            {project.tracks.map((t, i) => (
              <TrackRow
                key={t.id}
                track={t}
                clips={project.clips.filter((c) => c.trackId === t.id)}
                assets={project.assets}
                pps={pps}
                selectedClipId={selectedClipId}
                index={i}
                count={project.tracks.length}
              />
            ))}
            <div className="add-track">
              <button className="btn sm ghost" onClick={() => addTrack('video')}><LuPlus /> 動画トラック</button>
              <button className="btn sm ghost" onClick={() => addTrack('memo')}><LuPlus /> メモトラック</button>
              <button className="btn sm ghost" onClick={() => addTrack('audio')}><LuPlus /> 音源トラック</button>
            </div>
            <Foreground pps={pps} />
          </div>
        </div>
      </div>
    </>
  );
};

// ---------------- ルーラー ----------------

const Ruler: React.FC<{ pps: number; view: View }> = ({ pps, view }) => {
  const bpm = useProject((s) => s.project!.bpm);
  const offset = useProject((s) => s.project!.beatOffset);
  const loop = useUi((s) => s.loop);
  const bl = beatLength(bpm);
  const el = bl * 8;
  const t0 = Math.max(0, view.left / pps - 2);
  const t1 = (view.left + view.width) / pps + 2;

  // エイト番号: 狭いときは間引く
  const eightPx = el * pps;
  const labelEvery = eightPx >= 30 ? 1 : eightPx >= 15 ? 2 : eightPx >= 7 ? 4 : 8;
  const k0 = Math.floor((t0 - offset) / el);
  const k1 = Math.ceil((t1 - offset) / el);
  const eights: React.ReactNode[] = [];
  for (let k = k0; k <= k1; k++) {
    const t = offset + k * el;
    if (t < 0) continue;
    const show = k % labelEvery === 0;
    eights.push(<div key={`e${k}`} className="tick" style={{ left: t * pps, height: show ? 36 : 14, background: show ? 'var(--line-2)' : undefined }} />);
    if (show) eights.push(<div key={`l${k}`} className="eight-label" style={{ left: t * pps }}>{k + 1}</div>);
    if (bl * pps >= 9) {
      for (let b = 1; b < 8; b++) {
        const tb = t + b * bl;
        eights.push(<div key={`b${k}-${b}`} className="tick" style={{ left: tb * pps, height: b === 4 ? 9 : 5 }} />);
      }
    }
  }
  // 秒表示
  const steps = [1, 2, 5, 10, 15, 30, 60, 120];
  const step = steps.find((s) => s * pps >= 70) ?? 300;
  const times: React.ReactNode[] = [];
  for (let s = Math.floor(t0 / step) * step; s <= t1; s += step) {
    if (s < 0) continue;
    times.push(<div key={`t${s}`} className="time-label" style={{ left: s * pps }}>{formatShort(s)}</div>);
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const at = (x: number) => Math.max(0, (x - rect.left) / pps);
    const startT = at(e.clientX);
    const ui = useUi.getState();
    // Shift + ドラッグでループ範囲を作る
    if (e.shiftKey) {
      const move = (ev: PointerEvent) => {
        const t = at(ev.clientX);
        useUi.setState({ loop: { on: true, start: Math.min(startT, t), end: Math.max(startT, t) } });
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      return;
    }
    ui.setTime(startT);
    const move = (ev: PointerEvent) => useUi.getState().setTime(at(ev.clientX));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const dragLoopEdge = (e: React.PointerEvent, edge: 'start' | 'end') => {
    e.stopPropagation();
    e.preventDefault();
    const lane = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      const t = Math.max(0, (ev.clientX - lane.left) / pps);
      const l = useUi.getState().loop;
      useUi.setState({ loop: edge === 'start' ? { ...l, start: Math.min(t, l.end - 0.1) } : { ...l, end: Math.max(t, l.start + 0.1) } });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const hasLoop = loop.end - loop.start > 0.05;

  return (
    <div className="tl-lane tl-ruler" onPointerDown={onPointerDown} title="クリック / ドラッグで移動。Shift + ドラッグでループ範囲">
      {hasLoop && (
        <div className={`loop-band${loop.on ? '' : ' off'}`} style={{ left: loop.start * pps, width: (loop.end - loop.start) * pps }}>
          <div className="loop-edge" style={{ left: 0 }} onPointerDown={(e) => dragLoopEdge(e, 'start')} />
          <div className="loop-edge" style={{ left: '100%' }} onPointerDown={(e) => dragLoopEdge(e, 'end')} />
        </div>
      )}
      {eights}
      {times}
      <RulerHead pps={pps} />
    </div>
  );
};

const RulerHead: React.FC<{ pps: number }> = ({ pps }) => {
  const t = useUi((s) => s.currentTime);
  return <div className="playhead" style={{ left: t * pps }} />;
};

// ---------------- マーカー ----------------

const MarkerLane: React.FC<{ pps: number }> = ({ pps }) => {
  const markers = useProject((s) => s.project!.markers);
  const selected = useUi((s) => s.selectedMarkerId);

  const dragMarker = (e: React.PointerEvent, m: Marker) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    useUi.getState().selectMarker(m.id);
    const ps = useProject.getState();
    const p = ps.project!;
    const ui = useUi.getState();
    const startX = e.clientX;
    // このマーカーにぴったり合わせてある動画クリップは一緒に追従させる (速度を再計算)
    const eps = 0.02;
    const attachedStart = ui.autoFit ? p.clips.filter((c) => c.assetId && Math.abs(c.start - m.time) < eps) : [];
    const attachedEnd = ui.autoFit ? p.clips.filter((c) => c.assetId && Math.abs(clipEnd(c) - m.time) < eps) : [];
    const targets: SnapTarget[] = [
      { time: ui.currentTime, kind: 'playhead' },
      ...p.markers.filter((x) => x.id !== m.id).map((x) => ({ time: x.time, kind: 'marker' as const })),
    ];
    let moved = false;
    ps.beginGesture();
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (!moved && Math.abs(dx) < 3) return;
      moved = true;
      let t = Math.max(0, m.time + dx / pps);
      const s = useUi.getState().snap && !ev.shiftKey ? findSnap([t], [...targets, ...beatTargets(p, [t], pps)], SNAP_PX / pps) : null;
      if (s) t += s.delta;
      useUi.setState({ snapGuide: s ? s.target.time : null });
      useProject.getState().preview((d) => {
        const dm = d.markers.find((x) => x.id === m.id);
        if (dm) dm.time = t;
        for (const c0 of attachedStart) {
          const c = d.clips.find((x) => x.id === c0.id);
          if (c) Object.assign(c, pick(stretchStart(c0, t)));
        }
        for (const c0 of attachedEnd) {
          const c = d.clips.find((x) => x.id === c0.id);
          if (c) Object.assign(c, pick(stretchEnd(c0, t)));
        }
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      useProject.getState().endGesture();
      useUi.setState({ snapGuide: null });
      if (!moved) useUi.getState().setTime(m.time);
      else if (attachedStart.length + attachedEnd.length) useUi.getState().notify(`${attachedStart.length + attachedEnd.length} 個のクリップの速度を再調整しました`);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const markerMenu = (e: React.MouseEvent, m: Marker) => {
    e.preventDefault();
    e.stopPropagation();
    useUi.getState().selectMarker(m.id);
    const sorted = [...markers].sort((a, b) => a.time - b.time);
    const next = sorted[sorted.findIndex((x) => x.id === m.id) + 1];
    useUi.getState().openMenu(e, [
      { label: '名前・色を編集', onClick: () => useUi.getState().selectMarker(m.id) },
      { label: '次のマーカーまでループ', disabled: !next, onClick: () => next && commands.loopRange(m.time, next.time) },
      { label: '再生ヘッドの位置へ移動', onClick: () => useProject.getState().commit((d) => void (d.markers.find((x) => x.id === m.id)!.time = useUi.getState().currentTime)) },
      'sep',
      { label: '削除', shortcut: 'Del', danger: true, onClick: () => useProject.getState().commit((d) => void (d.markers = d.markers.filter((x) => x.id !== m.id))) },
    ]);
  };

  return (
    <div
      className="tl-lane tl-markers"
      onDoubleClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        useUi.getState().setTime(Math.max(0, (e.clientX - r.left) / pps));
        commands.addMarker();
      }}
      title="ダブルクリックでマーカーを追加"
    >
      {markers.map((m) => (
        <div
          key={m.id}
          className={`marker-pin${selected === m.id ? ' sel' : ''}`}
          style={{ left: m.time * pps, background: m.color }}
          onPointerDown={(e) => dragMarker(e, m)}
          onDoubleClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => markerMenu(e, m)}
          title={`${m.label} (${m.time.toFixed(2)}秒)\nドラッグで移動 / 右クリックでメニュー`}
        >
          {m.label}
        </div>
      ))}
    </div>
  );
};

const pick = (c: Clip) => ({ start: c.start, duration: c.duration, rate: c.rate });

// ---------------- 背景 (エイトの縦線・マーカー線・ループ範囲) ----------------

const BackgroundGrid: React.FC<{ pps: number; width: number }> = ({ pps, width }) => {
  const bpm = useProject((s) => s.project!.bpm);
  const offset = useProject((s) => s.project!.beatOffset);
  const markers = useProject((s) => s.project!.markers);
  const loop = useUi((s) => s.loop);
  const el = beatLength(bpm) * 8 * pps;
  const bl = beatLength(bpm) * pps;
  const bgs = ['linear-gradient(to right, rgba(255,255,255,.07) 1px, transparent 1px)'];
  const sizes = [`${el}px 100%`];
  if (bl >= 12) {
    bgs.push('linear-gradient(to right, rgba(255,255,255,.025) 1px, transparent 1px)');
    sizes.push(`${bl}px 100%`);
  }
  const pos = `${(offset * pps) % el}px 0`;
  return (
    <div className="grid-lines" style={{ left: HEAD_W, width, backgroundImage: el >= 6 ? bgs.join(',') : undefined, backgroundSize: sizes.join(','), backgroundPosition: bgs.map(() => pos).join(',') }}>
      {loop.on && loop.end > loop.start && (
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: loop.start * pps, width: (loop.end - loop.start) * pps, background: 'rgba(79,140,255,.06)' }} />
      )}
      {markers.map((m) => (
        <div key={m.id} className="marker-line" style={{ left: m.time * pps, background: m.color }} />
      ))}
    </div>
  );
};

const Foreground: React.FC<{ pps: number }> = ({ pps }) => {
  const t = useUi((s) => s.currentTime);
  const guide = useUi((s) => s.snapGuide);
  return (
    <div style={{ position: 'absolute', top: 0, bottom: 0, left: HEAD_W, right: 0, pointerEvents: 'none', zIndex: 20 }}>
      <div className="playhead" style={{ left: t * pps }} />
      {guide !== null && <div className="snap-guide" style={{ left: guide * pps }} />}
    </div>
  );
};
