import React from 'react';
import { useProject } from '../../store/projectStore';
import { useUi } from '../../store/uiStore';
import { commands } from '../../lib/commands';
import { projectDuration, sortedMarkers } from '../../lib/timeline';
import { formatCount, timeToCount } from '../../lib/time';
import { VideoView } from './MediaView';
import { Transport } from './Transport';
import { StagePanel } from '../stage/StagePanel';
import { LuFlipHorizontal2 } from 'react-icons/lu';

/** 通し練習用: 大きな映像・カウント・隊形・区間ループ */
export const PracticeView: React.FC = () => {
  const mirror = useUi((s) => s.mirror);
  const set = useUi((s) => s.set);
  return (
    <div className="practice">
      <div className="col monitor" style={{ minHeight: 280 }}>
        <div className="monitor-modebar">
          <span className="panel-title">練習モード</span>
          <div className="spacer" />
          <button className={`btn sm${mirror ? ' active' : ''}`} onClick={() => set({ mirror: !mirror })}>
            <LuFlipHorizontal2 /> 鏡にする
          </button>
        </div>
        <VideoView showCount={false} />
        <Progress />
        <Transport compact />
      </div>
      <div className="practice-side">
        <BigCount />
        <div className="col" style={{ flex: 1, minHeight: 220 }}>
          <StagePanel readOnly />
        </div>
        <Sections />
      </div>
    </div>
  );
};

const BigCount: React.FC = () => {
  const bpm = useProject((s) => s.project!.bpm);
  const off = useProject((s) => s.project!.beatOffset);
  const key = useUi((s) => {
    const c = timeToCount(s.currentTime, bpm, off);
    return `${c.eight}|${c.count}`;
  });
  const [eight, count] = key.split('|').map(Number);
  return (
    <div>
      <div className="big-count">
        {formatCount({ eight, count, phase: 0 })}
        <small>エイト - カウント (BPM {bpm})</small>
      </div>
      <div className="beat-dots">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className={i + 1 === count ? 'on' : ''} />
        ))}
      </div>
    </div>
  );
};

/** 再生位置バー (マーカー区間つき)。クリックで移動 */
const Progress: React.FC = () => {
  const p = useProject((s) => s.project!);
  const t = useUi((s) => s.currentTime);
  const loop = useUi((s) => s.loop);
  const dur = Math.max(1, projectDuration(p));
  const ms = sortedMarkers(p.markers);
  return (
    <div
      style={{ height: 22, position: 'relative', background: 'var(--bg-2)', cursor: 'pointer', borderTop: '1px solid var(--line)' }}
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        commands.seek(((e.clientX - r.left) / r.width) * dur);
      }}
    >
      {loop.on && loop.end > loop.start && (
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(loop.start / dur) * 100}%`, width: `${((loop.end - loop.start) / dur) * 100}%`, background: 'rgba(79,140,255,.25)' }} />
      )}
      {ms.map((m) => (
        <div key={m.id} title={m.label} style={{ position: 'absolute', top: 0, bottom: 0, width: 2, left: `${(m.time / dur) * 100}%`, background: m.color }} />
      ))}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${(t / dur) * 100}%`, background: 'rgba(255,255,255,.08)', borderRight: '2px solid var(--playhead)' }} />
    </div>
  );
};

const Sections: React.FC = () => {
  const markers = useProject((s) => s.project!.markers);
  const dur = useProject((s) => projectDuration(s.project!));
  const loop = useUi((s) => s.loop);
  const ms = sortedMarkers(markers);
  if (!ms.length) return <div className="hint" style={{ padding: 10, borderTop: '1px solid var(--line)' }}>マーカーを打つと、ここから区間を選んでループ練習できます。</div>;
  return (
    <div className="section-chips">
      {ms.map((m, i) => {
        const end = ms[i + 1]?.time ?? dur;
        const on = loop.on && Math.abs(loop.start - m.time) < 0.01 && Math.abs(loop.end - end) < 0.01;
        return (
          <button
            key={m.id}
            className={`section-chip${on ? ' on' : ''}`}
            onClick={() => (on ? useUi.getState().set({ loop: { ...loop, on: false } }) : commands.loopRange(m.time, end))}
            title={on ? 'ループを解除' : 'この区間をループ再生'}
          >
            <i style={{ background: m.color }} />
            {m.label}
          </button>
        );
      })}
    </div>
  );
};
