import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LuArrowLeft, LuCheck, LuCircleAlert, LuDownload, LuFileText, LuKeyboard, LuLoader, LuRedo2, LuUndo2 } from 'react-icons/lu';
import { useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';
import { loadProject, downloadJson } from '../lib/persistence';
import { loadMediaUrls } from '../lib/media';
import { startEngine } from '../lib/engine';
import { commands } from '../lib/commands';
import { useShortcuts } from '../hooks/useShortcuts';
import { useAutosave } from '../hooks/useAutosave';
import { Splitter } from '../components/common/Splitter';
import { HelpModal } from '../components/common/HelpModal';
import { Library } from '../components/library/Library';
import { Monitor } from '../components/monitor/Monitor';
import { StagePanel } from '../components/stage/StagePanel';
import { Inspector } from '../components/inspector/Inspector';
import { Timeline } from '../components/timeline/Timeline';
import { PracticeView } from '../components/monitor/PracticeView';
import { AudioElements } from '../components/monitor/MediaView';
import { clamp } from '../lib/time';
import { TextField } from '../components/common/Fields';

const Editor: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const project = useProject((s) => s.project);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading');

  useEffect(() => {
    let alive = true;
    setState('loading');
    void (async () => {
      const p = projectId ? await loadProject(projectId) : null;
      if (!alive) return;
      if (!p) return setState('notfound');
      useProject.getState().load(p);
      useUi.setState({
        currentTime: 0,
        isPlaying: false,
        selectedClipId: null,
        selectedMarkerId: null,
        selectedMemberIds: [],
        monitorMode: 'timeline',
        loop: { on: false, start: 0, end: 0 },
        source: { assetId: null, in: 0, out: 0, time: 0, clipId: null },
        saveStatus: 'saved',
        // スマホなど狭い画面では練習モードで開く
        ...(window.innerWidth < 900 ? { mode: 'practice' as const } : {}),
      });
      setState('ready');
      void loadMediaUrls(p.assets.map((a) => a.id));
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (state !== 'ready') return;
    return startEngine();
  }, [state]);

  useShortcuts();
  useAutosave();

  if (state === 'notfound')
    return (
      <div style={{ padding: 40 }}>
        <h2>プロジェクトが見つかりません</h2>
        <button className="btn" onClick={() => navigate('/')}>一覧へ戻る</button>
      </div>
    );
  if (state === 'loading' || !project) return <div style={{ padding: 40 }} className="muted">読み込み中…</div>;

  return (
    <div className="editor">
      <TopBar />
      <Workspace />
      <AudioElements />
      <HelpModal />
    </div>
  );
};

const TopBar: React.FC = () => {
  const name = useProject((s) => s.project!.name);
  const id = useProject((s) => s.project!.id);
  const canUndo = useProject((s) => s.past.length > 0);
  const canRedo = useProject((s) => s.future.length > 0);
  const saveStatus = useUi((s) => s.saveStatus);
  const mode = useUi((s) => s.mode);
  const set = useUi((s) => s.set);

  return (
    <div className="topbar">
      <Link to="/" className="icon-btn" title="プロジェクト一覧へ">
        <LuArrowLeft />
      </Link>
      <div className="brand hide-narrow">
        <span className="brand-dot" />
      </div>
      <TextField
        className="project-name"
        value={name}
        onCommit={(v) => useProject.getState().commit((d) => void (d.name = v.trim() || d.name))}
        ariaLabel="プロジェクト名"
      />
      <span className={`save-status hide-narrow ${saveStatus === 'error' ? 'error' : ''}`}>
        {saveStatus === 'saved' && <><LuCheck /> 保存済み</>}
        {saveStatus === 'saving' && <><LuLoader /> 保存中…</>}
        {saveStatus === 'error' && <><LuCircleAlert /> 保存に失敗しました</>}
      </span>
      <div className="spacer" />
      <button className="icon-btn hide-narrow" title="元に戻す (Ctrl+Z)" disabled={!canUndo} onClick={commands.undo}><LuUndo2 /></button>
      <button className="icon-btn hide-narrow" title="やり直し (Ctrl+Shift+Z)" disabled={!canRedo} onClick={commands.redo}><LuRedo2 /></button>
      <div className="seg" role="tablist" aria-label="画面モード">
        <button className={mode === 'edit' ? 'on' : ''} onClick={() => set({ mode: 'edit' })}>編集</button>
        <button className={mode === 'practice' ? 'on' : ''} onClick={() => set({ mode: 'practice' })}>練習</button>
      </div>
      <Link className="btn ghost hide-narrow" to={`/p/${id}/sheet`} title="隊形を一覧にして印刷"><LuFileText /> 隊形シート</Link>
      <button
        className="icon-btn hide-narrow"
        title="プロジェクトを書き出し (JSON)"
        onClick={() => {
          const p = useProject.getState().project;
          if (p) downloadJson(`${p.name}.dance.json`, p);
        }}
      >
        <LuDownload />
      </button>
      <button className="icon-btn hide-narrow" title="使い方とショートカット (?)" onClick={() => set({ helpOpen: true })}><LuKeyboard /></button>
    </div>
  );
};

const Workspace: React.FC = () => {
  const mode = useUi((s) => s.mode);
  const leftW = useUi((s) => s.leftW);
  const rightW = useUi((s) => s.rightW);
  const timelineH = useUi((s) => s.timelineH);
  const stageRatio = useUi((s) => s.stageRatio);
  const set = useUi((s) => s.set);
  const [rightH, setRightH] = useState(0);
  const rightRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rightRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRightH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  if (mode === 'practice') return <PracticeView />;

  return (
    <div className="workspace">
      <div className="upper">
        <div className="col panel" style={{ width: leftW }}>
          <Library />
        </div>
        <Splitter dir="v" onDrag={(d) => set({ leftW: clamp(useUi.getState().leftW + d, 200, 480) })} />
        <div className="col panel monitor" style={{ flex: 1 }}>
          <Monitor />
        </div>
        <Splitter dir="v" onDrag={(d) => set({ rightW: clamp(useUi.getState().rightW - d, 280, 640) })} />
        <div className="col" style={{ width: rightW }} ref={rightRef}>
          <div className="col panel" style={{ height: `${stageRatio * 100}%` }}>
            <StagePanel />
          </div>
          <Splitter
            dir="h"
            onDrag={(d) => rightH && set({ stageRatio: clamp(useUi.getState().stageRatio + d / rightH, 0.25, 0.85) })}
          />
          <div className="col panel" style={{ flex: 1 }}>
            <Inspector />
          </div>
        </div>
      </div>
      <Splitter dir="h" onDrag={(d) => set({ timelineH: clamp(useUi.getState().timelineH - d, 160, window.innerHeight - 260) })} />
      <div className="col panel tl" style={{ height: timelineH }}>
        <Timeline />
      </div>
    </div>
  );
};

export default Editor;
