import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LuFlipHorizontal2, LuGrid3X3, LuPlus, LuRoute, LuUsers } from 'react-icons/lu';
import { useProject } from '../../store/projectStore';
import { useUi } from '../../store/uiStore';
import { formationAt, lineUp, mirrorPositions } from '../../lib/formation';
import { commands } from '../../lib/commands';
import { clamp, formatCount, timeToCount } from '../../lib/time';
import { clipEnd } from '../../lib/timeline';
import type { Clip, Member, Position, StageSettings } from '../../types';

/** 補間中など編集できない状態でも使える、純粋な描画コンポーネント */
export const StageCanvas: React.FC<{
  stage: StageSettings;
  members: Member[];
  positions: Position[];
  targets?: Position[];
  editable?: boolean;
  selected?: string[];
  nameSize?: number;
  showPaths?: boolean;
  width: number;
  onDotDown?: (e: React.PointerEvent, memberId: string) => void;
  onDotMenu?: (e: React.MouseEvent, memberId: string) => void;
  onBgDown?: () => void;
  stageRef?: React.Ref<HTMLDivElement>;
  light?: boolean;
}> = ({ stage, members, positions, targets, editable, selected = [], nameSize = 11, showPaths, width, onDotDown, onDotMenu, onBgDown, stageRef, light }) => {
  const height = (width * stage.depth) / stage.width;
  const dot = clamp(width * 0.065, 20, 44);
  const half = Math.floor(stage.width / 2);
  const lineColor = light ? '#d0d3da' : '#262a35';
  const centerColor = light ? '#9aa0ad' : '#3c4252';
  const labelColor = light ? '#888' : '#596073';

  return (
    <div
      ref={stageRef}
      className={`stage${light ? ' light' : ''}`}
      style={{ width, height }}
      onPointerDown={onBgDown}
    >
      <svg className="grid" viewBox={`0 0 ${stage.width} ${stage.depth}`} preserveAspectRatio="none">
        {Array.from({ length: half * 2 + 1 }, (_, i) => i - half).map((k) => {
          const x = stage.width / 2 + k;
          if (x < 0 || x > stage.width) return null;
          return <line key={`v${k}`} x1={x} x2={x} y1={0} y2={stage.depth} stroke={k === 0 ? centerColor : lineColor} strokeWidth={k === 0 ? 2 : 1} vectorEffect="non-scaling-stroke" />;
        })}
        {Array.from({ length: Math.floor(stage.depth) + 1 }, (_, i) => i).map((y) => (
          <line key={`h${y}`} x1={0} x2={stage.width} y1={y} y2={y} stroke={lineColor} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      {/* 場ミリ番号 (中央 0) */}
      {Array.from({ length: half * 2 + 1 }, (_, i) => i - half).map((k) => (
        <span key={k} style={{ position: 'absolute', bottom: 2, left: `${((stage.width / 2 + k) / stage.width) * 100}%`, transform: 'translateX(-50%)', fontSize: 9, color: labelColor, pointerEvents: 'none' }}>
          {Math.abs(k)}
        </span>
      ))}
      {showPaths && targets && (
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
          <defs>
            {members.map((m) => (
              <marker key={m.id} id={`arr-${m.id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={m.color} />
              </marker>
            ))}
          </defs>
          {positions.map((p) => {
            const q = targets.find((t) => t.memberId === p.memberId);
            const m = members.find((x) => x.id === p.memberId);
            if (!q || !m || (Math.abs(q.x - p.x) < 0.005 && Math.abs(q.y - p.y) < 0.005)) return null;
            return (
              <g key={p.memberId} opacity={0.75}>
                <line x1={p.x * width} y1={p.y * height} x2={q.x * width} y2={q.y * height} stroke={m.color} strokeWidth={2} strokeDasharray="5 4" markerEnd={`url(#arr-${m.id})`} />
                <circle cx={q.x * width} cy={q.y * height} r={dot / 2 - 1} fill="none" stroke={m.color} strokeWidth={1.5} strokeDasharray="3 3" />
              </g>
            );
          })}
        </svg>
      )}
      {positions.map((p) => {
        const m = members.find((x) => x.id === p.memberId);
        if (!m) return null;
        return (
          <div
            key={p.memberId}
            className={`dot${editable ? '' : ' readonly'}${selected.includes(p.memberId) ? ' sel' : ''}`}
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: dot, height: dot, background: m.color, fontSize: dot * 0.36 }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onDotDown?.(e, m.id);
            }}
            onContextMenu={(e) => onDotMenu?.(e, m.id)}
            title={m.name}
          >
            {m.short}
            {nameSize > 0 && <span className="dot-name" style={{ fontSize: nameSize }}>{m.name}</span>}
          </div>
        );
      })}
    </div>
  );
};

const useBoxSize = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
};

const rangeLabel = (c: Clip, bpm: number, offset: number) =>
  `${formatCount(timeToCount(c.start, bpm, offset))} 〜 ${formatCount(timeToCount(clipEnd(c) - 0.001, bpm, offset))}`;

export const StagePanel: React.FC<{ readOnly?: boolean }> = ({ readOnly }) => {
  const project = useProject((s) => s.project!);
  const t = useUi((s) => s.currentTime);
  const selected = useUi((s) => s.selectedMemberIds);
  const showPaths = useUi((s) => s.showPaths);
  const gridSnap = useUi((s) => s.gridSnap);
  const nameSize = useUi((s) => s.nameSize);
  const set = useUi((s) => s.set);
  const [wrapRef, box] = useBoxSize();
  const stageEl = useRef<HTMLDivElement>(null);

  const { stage, members } = project;
  const fTrack = project.tracks.find((x) => x.kind === 'formation');
  const fClips = useMemo(() => project.clips.filter((c) => c.trackId === fTrack?.id && c.positions), [project.clips, fTrack?.id]);
  const st = formationAt(fClips, t);
  const editable = !readOnly && st.kind === 'hold';
  const positions = st.kind === 'empty' ? [] : st.positions;

  // 動線: 今の位置 → 次の隊形
  let targets: Position[] | undefined;
  if (st.kind === 'hold') {
    const next = fClips.filter((c) => c.start > st.clip.start).sort((a, b) => a.start - b.start)[0];
    targets = next?.positions;
  } else if (st.kind === 'transition') targets = st.to.positions;
  else if (st.kind === 'before') targets = undefined;

  // 24 = 余白, 22 = 「客席」ラベル
  const stageW = Math.max(120, Math.min(box.w - 24, ((box.h - 24 - 22) * stage.width) / stage.depth));
  const unplaced = members.filter((m) => !positions.some((p) => p.memberId === m.id));

  const editClip = (recipe: (ps: Position[]) => Position[], gesture = false) => {
    if (st.kind !== 'hold') return;
    const id = st.clip.id;
    const fn = gesture ? useProject.getState().preview : useProject.getState().commit;
    fn((d) => {
      const c = d.clips.find((x) => x.id === id);
      if (c?.positions) c.positions = recipe(c.positions as Position[]);
    });
  };

  const onDotDown = (e: React.PointerEvent, memberId: string) => {
    if (!editable || e.button !== 0) return;
    let sel = selected;
    if (e.shiftKey) {
      sel = selected.includes(memberId) ? selected.filter((x) => x !== memberId) : [...selected, memberId];
      set({ selectedMemberIds: sel });
      return;
    }
    if (!selected.includes(memberId)) {
      sel = [memberId];
      set({ selectedMemberIds: sel });
    }
    const rect = stageEl.current!.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const starts = positions.filter((p) => sel.includes(p.memberId)).map((p) => ({ ...p }));
    const sx = 0.5 / stage.width; // 0.5m 単位
    const sy = 0.5 / stage.depth;
    let moved = false;
    useProject.getState().beginGesture();
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / rect.width;
      const dy = (ev.clientY - startY) / rect.height;
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 3) return;
      moved = true;
      const snap = gridSnap && !ev.shiftKey;
      // 掴んだメンバーをグリッドに合わせ、他の選択メンバーは相対位置を保つ
      const lead = starts.find((s) => s.memberId === memberId)!;
      let nx = lead.x + dx;
      let ny = lead.y + dy;
      if (snap) {
        nx = Math.round((nx - 0.5) / sx) * sx + 0.5;
        ny = Math.round(ny / sy) * sy;
      }
      const ddx = nx - lead.x;
      const ddy = ny - lead.y;
      editClip(
        (ps) =>
          ps.map((p) => {
            const s0 = starts.find((s) => s.memberId === p.memberId);
            return s0 ? { ...p, x: clamp(s0.x + ddx, 0, 1), y: clamp(s0.y + ddy, 0, 1) } : p;
          }),
        true,
      );
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      useProject.getState().endGesture();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onDotMenu = (e: React.MouseEvent, memberId: string) => {
    e.preventDefault();
    if (!editable) return;
    const ids = selected.includes(memberId) ? selected : [memberId];
    useUi.getState().openMenu(e, [
      { label: ids.length > 1 ? `${ids.length}人をこの隊形から外す` : 'この隊形から外す', onClick: () => editClip((ps) => ps.filter((p) => !ids.includes(p.memberId))) },
      { label: '左右反転 (選択メンバー)', onClick: () => editClip((ps) => ps.map((p) => (ids.includes(p.memberId) ? { ...p, x: 1 - p.x } : p))) },
    ]);
  };

  const addMember = (m: Member) => {
    // 前列の空いている所へ
    const taken = positions.map((p) => p.x);
    let x = 0.5;
    for (let k = 0; k < 20; k++) {
      const cand = 0.5 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (1 / stage.width);
      if (!taken.some((tx) => Math.abs(tx - cand) < 0.5 / stage.width)) {
        x = cand;
        break;
      }
    }
    editClip((ps) => [...ps, { memberId: m.id, x: clamp(x, 0.05, 0.95), y: 0.85 }]);
    set({ selectedMemberIds: [m.id] });
  };

  let status: React.ReactNode;
  if (st.kind === 'hold')
    status = (
      <>
        <span className="pill hold">編集中</span>
        <b>{st.clip.label}</b>
        <span className="muted">{rangeLabel(st.clip, project.bpm, project.beatOffset)}</span>
      </>
    );
  else if (st.kind === 'transition')
    status = (
      <>
        <span className="pill move">移動中 {Math.round(st.progress * 100)}%</span>
        <span className="muted">{st.from.label} → {st.to.label}</span>
      </>
    );
  else status = <span className="pill none">{st.kind === 'empty' ? '隊形がまだありません' : st.kind === 'before' ? '最初の隊形の前' : '最後の隊形の後'}</span>;

  return (
    <>
      {!readOnly && (
        <div className="panel-header">
          <span className="panel-title">ステージ</span>
          <div className="spacer" />
          <button className={`icon-btn sm${showPaths ? ' active' : ''}`} title="次の隊形への動線を表示" onClick={() => set({ showPaths: !showPaths })}><LuRoute /></button>
          <button className={`icon-btn sm${gridSnap ? ' active' : ''}`} title="0.5m グリッドに吸着 (Shift で一時解除)" onClick={() => set({ gridSnap: !gridSnap })}><LuGrid3X3 /></button>
          <button className="icon-btn sm" title="この隊形を左右反転" disabled={!editable} onClick={() => editClip(mirrorPositions)}><LuFlipHorizontal2 /></button>
          <button className="icon-btn sm" title="全員を横一列に並べ直す" disabled={!editable || !members.length} onClick={() => window.confirm('この隊形を横一列に並べ直しますか？') && editClip(() => lineUp(members))}><LuUsers /></button>
        </div>
      )}
      <div className="stage-wrap" ref={wrapRef} onPointerDown={() => set({ selectedMemberIds: [] })}>
        {box.w > 0 && (
          <div style={{ position: 'relative', paddingBottom: 20 }}>
            <StageCanvas
              stage={stage}
              members={members}
              positions={positions}
              targets={targets}
              editable={editable}
              selected={selected}
              nameSize={nameSize}
              showPaths={showPaths}
              width={stageW}
              onDotDown={onDotDown}
              onDotMenu={onDotMenu}
              stageRef={stageEl}
            />
            <div className="stage-audience">客 席 (正面)</div>
          </div>
        )}
      </div>
      {!readOnly && (
        <>
          <div className="stage-status">
            {status}
            <div className="spacer" />
            {st.kind !== 'hold' && (
              <button className="btn sm primary" onClick={() => commands.addFormation()} disabled={!members.length} title={members.length ? '再生ヘッドの位置に、今の並びで隊形を作る' : '先にメンバーを追加してください'}>
                <LuPlus /> ここに隊形を追加
              </button>
            )}
          </div>
          {editable && unplaced.length > 0 && (
            <div className="tray">
              <span className="hint" style={{ alignSelf: 'center', marginRight: 4 }}>未配置:</span>
              {unplaced.map((m) => (
                <button key={m.id} className="member-dot" style={{ background: m.color, border: 0 }} title={`${m.name} をステージに出す`} onClick={() => addMember(m)}>
                  {m.short}
                </button>
              ))}
            </div>
          )}
          {!members.length && <div className="hint" style={{ padding: '0 10px 8px' }}>左の「メンバー」タブで出演者を追加してください。</div>}
        </>
      )}
    </>
  );
};
