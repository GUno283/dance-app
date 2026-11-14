import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Project } from '../types';
import { loadProject } from '../lib/persistence';
import { formatCount, formatTime, timeToCount } from '../lib/time';
import { clipEnd } from '../lib/timeline';
import { StageCanvas } from '../components/stage/StagePanel';

/** 隊形を一覧にした印刷用シート */
const FormationSheet: React.FC = () => {
  const { projectId } = useParams();
  const [p, setP] = useState<Project | null>(null);
  useEffect(() => {
    if (projectId) void loadProject(projectId).then(setP);
  }, [projectId]);
  if (!p) return <div style={{ padding: 40 }}>読み込み中…</div>;

  const clips = p.clips.filter((c) => c.positions).sort((a, b) => a.start - b.start);
  const markerAt = (t: number) => [...p.markers].sort((a, b) => a.time - b.time).filter((m) => m.time <= t + 0.01).pop();

  return (
    <div className="sheet">
      <div className="sheet-inner">
        <div className="sheet-toolbar">
          <Link to={`/p/${p.id}`} className="btn" style={{ color: '#111', background: '#fff', borderColor: '#ccc', textDecoration: 'none' }}>← エディタへ</Link>
          <button className="btn primary" onClick={() => window.print()}>印刷 / PDF 保存</button>
        </div>
        <h2 style={{ margin: '0 0 4px' }}>{p.name} — 隊形シート</h2>
        <p style={{ margin: '0 0 16px', color: '#666', fontSize: 12 }}>
          BPM {p.bpm} / メンバー {p.members.length}人 / 隊形 {clips.length} / ステージ {p.stage.width}m × {p.stage.depth}m (下が客席)
        </p>
        <div className="sheet-grid">
          {clips.map((c, i) => (
            <div key={c.id} className="sheet-card">
              <h4>
                <span>{i + 1}. {c.label}</span>
                <span style={{ color: '#666', fontWeight: 500 }}>
                  {formatCount(timeToCount(c.start, p.bpm, p.beatOffset))}〜{formatCount(timeToCount(clipEnd(c) - 0.001, p.bpm, p.beatOffset))}
                </span>
              </h4>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>
                {formatTime(c.start)} {markerAt(c.start) ? `・${markerAt(c.start)!.label}` : ''}
              </div>
              <StageCanvas stage={p.stage} members={p.members} positions={c.positions!} width={268} nameSize={9} light />
            </div>
          ))}
        </div>
        {clips.length === 0 && <p>隊形がまだありません。</p>}
        <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12 }}>
          {p.members.map((m) => (
            <span key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: m.color, display: 'inline-block' }} /> {m.short} = {m.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FormationSheet;
