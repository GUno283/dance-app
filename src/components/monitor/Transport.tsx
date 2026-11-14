import React from 'react';
import { LuChevronLeft, LuChevronRight, LuPause, LuPlay, LuRepeat, LuSkipBack, LuSkipForward, LuTimer } from 'react-icons/lu';
import { useUi } from '../../store/uiStore';
import { useProject } from '../../store/projectStore';
import { commands } from '../../lib/commands';
import { formatCount, formatTime } from '../../lib/time';
import { projectDuration } from '../../lib/timeline';
import { useCount } from './MediaView';

export const RATES = [0.25, 0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 2];

const Timecode: React.FC = () => {
  const mode = useUi((s) => s.monitorMode);
  const time = useUi((s) => Math.floor((s.monitorMode === 'source' ? s.source.time : s.currentTime) * 100));
  const total = useProject((s) => projectDuration(s.project!));
  const srcTotal = useUi((s) => s.source.out - s.source.in);
  return (
    <div className="timecode">
      <b>{formatTime(time / 100)}</b> / {formatTime(mode === 'source' ? srcTotal : total)}
    </div>
  );
};

const Count: React.FC = () => {
  const key = useCount();
  const [eight, count] = key.split('|').map(Number);
  return (
    <div className="count-display" title="エイト-カウント">
      {formatCount({ eight, count, phase: 0 })}
      <small>エイト-カウント</small>
    </div>
  );
};

export const Transport: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const isPlaying = useUi((s) => s.isPlaying);
  const mode = useUi((s) => s.monitorMode);
  const playRate = useUi((s) => s.playRate);
  const loopOn = useUi((s) => s.loop.on);
  const metronome = useUi((s) => s.metronome);
  const set = useUi((s) => s.set);

  return (
    <div className="transport" onMouseDown={(e) => e.target instanceof HTMLButtonElement && e.preventDefault()}>
      {mode === 'timeline' && !compact && <Count />}
      <button className="icon-btn" title="前のマーカー (↑)" onClick={() => commands.jumpMarker(-1)} disabled={mode === 'source'}><LuSkipBack /></button>
      <button className="icon-btn" title="1コマ戻る (←)  Shift: 1拍" onClick={() => commands.step(-1)}><LuChevronLeft /></button>
      <button className="play-btn" title="再生 / 一時停止 (Space)" onClick={commands.togglePlay}>
        {isPlaying ? <LuPause /> : <LuPlay style={{ marginLeft: 2 }} />}
      </button>
      <button className="icon-btn" title="1コマ進む (→)  Shift: 1拍" onClick={() => commands.step(1)}><LuChevronRight /></button>
      <button className="icon-btn" title="次のマーカー (↓)" onClick={() => commands.jumpMarker(1)} disabled={mode === 'source'}><LuSkipForward /></button>
      <Timecode />
      <button className={`icon-btn${loopOn ? ' active' : ''}`} title="ループ (L)" onClick={commands.toggleLoop}><LuRepeat /></button>
      <select
        className="select"
        style={{ width: 76, height: 28 }}
        value={playRate}
        onChange={(e) => set({ playRate: parseFloat(e.target.value) })}
        title="再生速度 (練習用。クリップの速度とは別)"
      >
        {RATES.map((r) => (
          <option key={r} value={r}>
            ×{r}
          </option>
        ))}
      </select>
      {mode === 'timeline' && (
        <button className={`icon-btn${metronome ? ' active' : ''}`} title="クリック音 (拍ごとに鳴らす)" onClick={() => set({ metronome: !metronome })}>
          <LuTimer />
        </button>
      )}
    </div>
  );
};
