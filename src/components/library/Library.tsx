import React, { useRef, useState } from 'react';
import { LuFilm, LuLink, LuMusic, LuPlus, LuScissors, LuTrash2, LuUpload } from 'react-icons/lu';
import { useProject } from '../../store/projectStore';
import { useUi } from '../../store/uiStore';
import { useMediaUrls } from '../../lib/media';
import { importFiles } from '../../lib/importMedia';
import { formatTime } from '../../lib/time';
import { newId } from '../../lib/id';
import { TRACK_COLORS } from '../../lib/factory';
import type { Asset } from '../../types';
import { MembersPanel } from './MembersPanel';

export const ASSET_MIME = 'application/x-dance-asset';

export const openInSource = (asset: Asset, clipId: string | null = null) => {
  const p = useProject.getState().project;
  const clip = clipId ? p?.clips.find((c) => c.id === clipId) : undefined;
  const inP = clip ? clip.sourceIn : 0;
  const outP = clip ? clip.sourceIn + clip.duration * clip.rate : asset.duration;
  useUi.setState({
    monitorMode: 'source',
    isPlaying: false,
    source: { assetId: asset.id, in: inP, out: outP, time: inP, clipId: clipId ?? null },
  });
};

export const addAssetAtPlayhead = (asset: Asset) => {
  const p = useProject.getState().project;
  const ui = useUi.getState();
  if (!p) return;
  const track = p.tracks.find((t) => t.kind === asset.kind);
  if (!track) return ui.notify(`${asset.kind === 'audio' ? '音源' : '動画'}トラックがありません`, 'warn');
  const id = newId('cl');
  useProject.getState().commit((d) =>
    void d.clips.push({ id, trackId: track.id, start: ui.currentTime, duration: asset.duration, label: asset.name, assetId: asset.id, sourceIn: 0, rate: 1, color: TRACK_COLORS[asset.kind] }),
  );
  ui.selectClip(id);
};

export const Library: React.FC = () => {
  const [tab, setTab] = useState<'media' | 'members'>('media');
  return (
    <>
      <div className="panel-header">
        <div className="seg">
          <button className={tab === 'media' ? 'on' : ''} onClick={() => setTab('media')}>メディア</button>
          <button className={tab === 'members' ? 'on' : ''} onClick={() => setTab('members')}>メンバー</button>
        </div>
      </div>
      {tab === 'media' ? <MediaPanel /> : <MembersPanel />}
    </>
  );
};

const MediaPanel: React.FC = () => {
  const assets = useProject((s) => s.project!.assets);
  const clips = useProject((s) => s.project!.clips);
  const missing = useMediaUrls((s) => s.missing);
  const sourceId = useUi((s) => s.source.assetId);
  const [filter, setFilter] = useState<'all' | 'video' | 'audio'>('all');
  const [query, setQuery] = useState('');
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const relinkRef = useRef<HTMLInputElement>(null);

  const run = async (files: File[]) => {
    if (!files.length) return;
    setBusy((n) => n + files.length);
    try {
      await importFiles(files);
    } finally {
      setBusy((n) => n - files.length);
    }
  };

  const remove = async (a: Asset) => {
    const used = clips.filter((c) => c.assetId === a.id).length;
    const msg = used ? `「${a.name}」を削除しますか？\nタイムライン上の ${used} 個のクリップも削除されます。` : `「${a.name}」を削除しますか？`;
    if (!window.confirm(msg)) return;
    useProject.getState().commit((d) => {
      d.assets = d.assets.filter((x) => x.id !== a.id);
      d.clips = d.clips.filter((c) => c.assetId !== a.id);
    });
    // メディア本体は Undo や複製したプロジェクトで使うため IndexedDB に残す
  };

  const list = assets
    .filter((a) => filter === 'all' || a.kind === filter)
    .filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div
      className="panel-body"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setOver(false);
        void run(Array.from(e.dataTransfer.files));
      }}
    >
      <div className={`drop-zone${over ? ' over' : ''}`} onClick={() => fileRef.current?.click()}>
        <LuUpload size={18} />
        <div style={{ marginTop: 4, whiteSpace: 'pre-line' }}>{busy ? `取り込み中… (${busy})` : '動画・音源をドロップ\nまたはクリックで選択'}</div>
      </div>
      <input ref={fileRef} type="file" multiple accept="video/*,audio/*" hidden onChange={(e) => { void run(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
      <input ref={relinkRef} type="file" accept="video/*,audio/*" hidden onChange={(e) => { void run(Array.from(e.target.files ?? [])); e.target.value = ''; }} />

      <div className="row" style={{ padding: '0 10px 8px' }}>
        <div className="seg">
          {(['all', 'video', 'audio'] as const).map((f) => (
            <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {{ all: 'すべて', video: '動画', audio: '音源' }[f]}
            </button>
          ))}
        </div>
        <input className="input" placeholder="検索" value={query} onChange={(e) => setQuery(e.target.value)} style={{ height: 26 }} />
      </div>

      {list.map((a) => {
        const isMissing = !!missing[a.id];
        const uses = clips.filter((c) => c.assetId === a.id).length;
        return (
          <div
            key={a.id}
            className={`asset${sourceId === a.id ? ' selected' : ''}${isMissing ? ' missing' : ''}`}
            draggable={!isMissing}
            onDragStart={(e) => {
              e.dataTransfer.setData(ASSET_MIME, a.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onDoubleClick={() => !isMissing && openInSource(a)}
            title={isMissing ? 'メディア本体がありません。再リンクしてください' : 'ドラッグでタイムラインへ / ダブルクリックで素材モニター'}
          >
            <div className="asset-thumb">
              {a.thumbnail ? <img src={a.thumbnail} alt="" /> : a.kind === 'audio' ? <LuMusic size={18} color={TRACK_COLORS.audio} /> : <LuFilm size={18} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="asset-name">{a.name}</div>
              <div className="asset-meta">
                <span>{formatTime(a.duration).slice(0, 5)}</span>
                {uses > 0 && <span>使用 {uses}</span>}
                {isMissing && <span className="badge warn">メディアなし</span>}
              </div>
            </div>
            <div className="asset-actions">
              {isMissing ? (
                <button className="icon-btn sm" title="ファイルを選んで再リンク" onClick={() => relinkRef.current?.click()}><LuLink /></button>
              ) : (
                <>
                  <button className="icon-btn sm" title="素材モニターで開く (イン/アウト点を決める)" onClick={() => openInSource(a)}><LuScissors /></button>
                  <button className="icon-btn sm" title="再生ヘッドの位置に追加" onClick={() => addAssetAtPlayhead(a)}><LuPlus /></button>
                </>
              )}
              <button className="icon-btn sm" title="削除" onClick={() => void remove(a)}><LuTrash2 /></button>
            </div>
          </div>
        );
      })}
      {assets.length === 0 && (
        <p className="hint" style={{ padding: '4px 14px' }}>
          まず音源を入れると、BPM とカウントが自動で設定されます。振付動画はタイムラインの「動画」トラックへドラッグしてください。
        </p>
      )}
    </div>
  );
};
