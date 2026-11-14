import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuCopy, LuDownload, LuPencil, LuPlus, LuSparkles, LuTrash2, LuUpload } from 'react-icons/lu';
import type { Project, ProjectSummary } from '../types';
import { deleteProject, downloadJson, listProjects, loadProject, normalizeProject, saveProject } from '../lib/persistence';
import { newProject, sampleProject } from '../lib/factory';
import { hasLegacyData, migrateLegacy } from '../lib/migration';
import { newId } from '../lib/id';
import { useUi } from '../store/uiStore';

const fmtDate = (t: number) =>
  new Date(t).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [legacy, setLegacy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const notify = useUi((s) => s.notify);

  const refresh = () => listProjects().then(setProjects);
  useEffect(() => {
    void refresh();
    setLegacy(hasLegacyData());
  }, []);

  const create = async (p: Project) => {
    await saveProject(p);
    navigate(`/p/${p.id}`);
  };

  const onNew = () => {
    const name = window.prompt('プロジェクト名 (例: 夏公演 Opening)', '新しいナンバー');
    if (name === null) return;
    void create(newProject(name.trim() || '新しいナンバー'));
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as Project;
      if (!data || data.version !== 2 || !Array.isArray(data.clips)) throw new Error('形式が違います');
      // ID が衝突しないよう新しいプロジェクトとして読み込む (メディア ID は再リンク用にそのまま)
      const p = normalizeProject({ ...data, id: newId('pj'), name: `${data.name} (読み込み)`, updatedAt: Date.now() });
      await create(p);
      notify('読み込みました。メディアはライブラリから「再リンク」してください');
    } catch (err) {
      notify(`読み込めませんでした: ${(err as Error).message}`, 'warn');
    }
  };

  const onDuplicate = async (id: string) => {
    const p = await loadProject(id);
    if (!p) return;
    await saveProject({ ...p, id: newId('pj'), name: `${p.name} のコピー`, createdAt: Date.now(), updatedAt: Date.now() });
    void refresh();
  };

  const onRename = async (id: string, current: string) => {
    const name = window.prompt('新しい名前', current);
    if (!name) return;
    const p = await loadProject(id);
    if (!p) return;
    await saveProject({ ...p, name, updatedAt: Date.now() });
    void refresh();
  };

  const onDelete = async (id: string, name: string) => {
    if (!window.confirm(`「${name}」を削除しますか？ この操作は元に戻せません。`)) return;
    await deleteProject(id);
    void refresh();
  };

  const onExport = async (id: string) => {
    const p = await loadProject(id);
    if (p) downloadJson(`${p.name}.dance.json`, p);
  };

  const onMigrate = async () => {
    const p = await migrateLegacy();
    if (!p) return notify('旧データが見つかりませんでした', 'warn');
    await create(p);
  };

  return (
    <div className="dash">
      <div className="dash-inner">
        <div className="dash-hero">
          <div style={{ flex: '1 1 420px' }}>
            <div className="brand" style={{ fontSize: 13, color: 'var(--text-2)' }}>
              <span className="brand-dot" /> Dance Studio
            </div>
            <h1>ナンバー制作</h1>
            <p>音源・振付動画・マーカー・隊形・メモを 1 本のタイムラインで。データはこのブラウザ内に自動保存されます。</p>
          </div>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <LuUpload /> 読み込み
          </button>
          <button className="btn" onClick={() => void create(sampleProject())}>
            <LuSparkles /> サンプルを開く
          </button>
          <button className="btn primary" onClick={onNew}>
            <LuPlus /> 新規作成
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onImport} />
        </div>

        {legacy && (
          <div className="notice">
            <div style={{ flex: 1, minWidth: 200 }}>
              <b>旧バージョンのデータが見つかりました。</b>
              <div className="hint">マーカー・隊形・メモ・メディアを新しい形式に変換して、新しいプロジェクトとして開きます (元のデータは消えません)。</div>
            </div>
            <button className="btn primary" onClick={onMigrate}>変換して開く</button>
          </div>
        )}

        <div className="cards">
          <div className="card new" onClick={onNew}>
            <LuPlus size={22} />
            <div>新しいナンバーを作る</div>
          </div>
          {projects?.map((p) => (
            <div key={p.id} className="card" onClick={() => navigate(`/p/${p.id}`)}>
              <h3>{p.name}</h3>
              <div className="card-meta">
                <span>更新 {fmtDate(p.updatedAt)}</span>
                <span>メンバー {p.memberCount}人</span>
                <span>クリップ {p.clipCount}</span>
              </div>
              <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                <button className="icon-btn sm" title="名前を変更" onClick={() => onRename(p.id, p.name)}><LuPencil /></button>
                <button className="icon-btn sm" title="複製" onClick={() => onDuplicate(p.id)}><LuCopy /></button>
                <button className="icon-btn sm" title="書き出し (JSON)" onClick={() => onExport(p.id)}><LuDownload /></button>
                <div className="spacer" />
                <button className="icon-btn sm" title="削除" onClick={() => onDelete(p.id, p.name)} style={{ color: 'var(--danger)' }}><LuTrash2 /></button>
              </div>
            </div>
          ))}
        </div>
        {projects && projects.length === 0 && (
          <p className="hint" style={{ marginTop: 18 }}>
            まだプロジェクトがありません。「新規作成」か、操作を試せる「サンプルを開く」から始めましょう。
          </p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
