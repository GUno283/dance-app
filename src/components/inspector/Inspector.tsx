import React, { useRef, useState } from 'react';
import { LuCrosshair, LuRepeat, LuScissors, LuTrash2, LuWandSparkles } from 'react-icons/lu';
import { useProject, actions } from '../../store/projectStore';
import { useUi } from '../../store/uiStore';
import { commands } from '../../lib/commands';
import { formatCount, formatTime, timeToCount } from '../../lib/time';
import { MAX_RATE, MIN_RATE, clipEnd, markerRangeAt, sortedMarkers } from '../../lib/timeline';
import { MARKER_COLORS } from '../../lib/factory';
import { getMediaBlob } from '../../lib/media';
import { analyzeAudioBlob } from '../../lib/audio';
import { NumberField, TextField } from '../common/Fields';
import { openInSource } from '../library/Library';
import type { Clip, Marker } from '../../types';

export const Inspector: React.FC = () => {
  const clipId = useUi((s) => s.selectedClipId);
  const markerId = useUi((s) => s.selectedMarkerId);
  const clip = useProject((s) => (clipId ? s.project!.clips.find((c) => c.id === clipId) : undefined));
  const marker = useProject((s) => (markerId ? s.project!.markers.find((m) => m.id === markerId) : undefined));

  return (
    <>
      <div className="panel-header">
        <span className="panel-title">{clip ? 'クリップ' : marker ? 'マーカー' : 'プロジェクト設定'}</span>
        <div className="spacer" />
        {(clip || marker) && (
          <button className="btn sm ghost" onClick={() => useUi.getState().set({ selectedClipId: null, selectedMarkerId: null })}>
            設定に戻る
          </button>
        )}
      </div>
      <div className="panel-body inspector">
        {clip ? <ClipInspector clip={clip} /> : marker ? <MarkerInspector marker={marker} /> : <ProjectSettings />}
      </div>
    </>
  );
};

const CountHint: React.FC<{ t: number }> = ({ t }) => {
  const bpm = useProject((s) => s.project!.bpm);
  const off = useProject((s) => s.project!.beatOffset);
  return <span className="muted" style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>{formatCount(timeToCount(t, bpm, off))}</span>;
};

const ClipInspector: React.FC<{ clip: Clip }> = ({ clip }) => {
  const track = useProject((s) => s.project!.tracks.find((t) => t.id === clip.trackId));
  const asset = useProject((s) => s.project!.assets.find((a) => a.id === clip.assetId));
  const memberCount = useProject((s) => s.project!.members.length);
  const hasRange = useProject((s) => !!markerRangeAt(s.project!.markers, clip.start + 0.001));
  const up = (patch: Partial<Clip>) => actions.updateClip(clip.id, patch);
  const kind = track?.kind;

  return (
    <>
      <div className="field">
        <label>名前</label>
        <TextField value={clip.label} onCommit={(v) => up({ label: v })} />
      </div>
      <div className="row">
        <div className="field">
          <label>開始 <CountHint t={clip.start} /></label>
          <NumberField value={clip.start} min={0} onCommit={(v) => up({ start: v })} suffix="秒" />
        </div>
        <div className="field">
          <label>長さ</label>
          <NumberField
            value={clip.duration}
            min={0.1}
            max={asset ? (asset.duration - clip.sourceIn) / clip.rate : undefined}
            onCommit={(v) => up({ duration: v })}
            suffix="秒"
          />
        </div>
      </div>

      {asset && (
        <>
          <div className="row">
            <div className="field">
              <label>速度 (×{MIN_RATE}〜×{MAX_RATE})</label>
              <NumberField
                value={clip.rate}
                min={MIN_RATE}
                max={MAX_RATE}
                step={0.05}
                digits={3}
                onCommit={(v) => up({ rate: v, duration: (clip.duration * clip.rate) / v })}
              />
            </div>
            <div className="field">
              <label>素材の開始位置</label>
              <NumberField
                value={clip.sourceIn}
                min={0}
                max={Math.max(0, asset.duration - 0.1)}
                onCommit={(v) => up({ sourceIn: v, duration: Math.min(clip.duration, (asset.duration - v) / clip.rate) })}
                suffix="秒"
              />
            </div>
          </div>
          <div className="row" style={{ flexWrap: 'wrap', marginBottom: 10 }}>
            <button className="btn sm" disabled={!hasRange} onClick={commands.fitSelected} title="開始位置を含むマーカー区間に収まるよう速度を調整 (F)">
              <LuWandSparkles /> マーカー区間にフィット
            </button>
            <button className="btn sm" disabled={Math.abs(clip.rate - 1) < 1e-3} onClick={commands.resetRate}>速度を ×1 に</button>
            <button className="btn sm" onClick={() => openInSource(asset, clip.id)} title="素材モニターでイン/アウト点を調整">
              <LuScissors /> 範囲を調整
            </button>
          </div>
          <div className="stat"><span>素材</span><b style={{ fontFamily: 'var(--font)' }}>{asset.name}</b></div>
          <div className="stat"><span>素材上の範囲</span><b>{formatTime(clip.sourceIn)} – {formatTime(clip.sourceIn + clip.duration * clip.rate)}</b></div>
          <div className="divider" />
        </>
      )}

      {kind === 'memo' && (
        <div className="field">
          <label>メモ (映像に重ねて表示されます)</label>
          <TextField multiline value={clip.text ?? ''} onCommit={(v) => up({ text: v })} placeholder="例: ここで右足から。目線は上手奥" />
        </div>
      )}

      {kind === 'formation' && (
        <>
          <div className="stat"><span>配置人数</span><b>{clip.positions?.length ?? 0} / {memberCount}</b></div>
          <p className="hint">ステージ上でメンバーをドラッグして編集します。Shift+クリックで複数選択、右クリックで外す/反転。隊形クリップ同士の隙間が「移動」の時間になります。</p>
          <div className="divider" />
        </>
      )}

      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: '0 0 auto' }}>
          <label>色</label>
          <input type="color" value={clip.color ?? '#3b82f6'} onChange={(e) => up({ color: e.target.value })} />
        </div>
        <div className="spacer" />
        <button className="btn sm" onClick={commands.duplicate} title="複製 (Ctrl+D)">複製</button>
        <button className="btn sm danger" onClick={commands.deleteSelection} title="削除 (Delete)"><LuTrash2 /> 削除</button>
      </div>
    </>
  );
};

const MarkerInspector: React.FC<{ marker: Marker }> = ({ marker }) => {
  const markers = useProject((s) => s.project!.markers);
  const commit = useProject((s) => s.commit);
  const up = (patch: Partial<Marker>) =>
    commit((d) => {
      const m = d.markers.find((x) => x.id === marker.id);
      if (m) Object.assign(m, patch);
    });
  const sorted = sortedMarkers(markers);
  const next = sorted[sorted.findIndex((m) => m.id === marker.id) + 1];

  return (
    <>
      <div className="field">
        <label>名前 (例: サビ、2番、ソロ)</label>
        <TextField value={marker.label} onCommit={(v) => up({ label: v })} />
      </div>
      <div className="field">
        <label>位置 <CountHint t={marker.time} /></label>
        <NumberField value={marker.time} min={0} onCommit={(v) => up({ time: v })} suffix="秒" />
      </div>
      <div className="field">
        <label>色</label>
        <div className="row">
          {MARKER_COLORS.map((c) => (
            <button key={c} onClick={() => up({ color: c })} style={{ width: 24, height: 24, borderRadius: 6, background: c, border: marker.color === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer' }} aria-label={c} />
          ))}
        </div>
      </div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn sm" onClick={() => up({ time: useUi.getState().currentTime })} title="再生ヘッドの位置に移動"><LuCrosshair /> 再生ヘッドへ</button>
        {next && (
          <button className="btn sm" onClick={() => commands.loopRange(marker.time, next.time)}><LuRepeat /> 次のマーカーまでループ</button>
        )}
        <div className="spacer" />
        <button className="btn sm danger" onClick={commands.deleteSelection}><LuTrash2 /> 削除</button>
      </div>
      {next && <p className="hint" style={{ marginTop: 10 }}>区間の長さ: {(next.time - marker.time).toFixed(2)} 秒。動画クリップの先頭をこのマーカーに合わせると、次のマーカーまでに収まるよう速度が自動調整されます。</p>}
    </>
  );
};

const ProjectSettings: React.FC = () => {
  const p = useProject((s) => s.project!);
  const commit = useProject((s) => s.commit);
  const nameSize = useUi((s) => s.nameSize);
  const autoFit = useUi((s) => s.autoFit);
  const set = useUi((s) => s.set);
  const [taps, setTaps] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const tapBpm = (() => {
    if (taps.length < 4) return null;
    const iv = taps.slice(1).map((t, i) => t - taps[i]);
    const avg = iv.reduce((a, b) => a + b, 0) / iv.length;
    return Math.round((60000 / avg) * 10) / 10;
  })();

  const tap = () => {
    const now = performance.now();
    setTaps((ts) => (ts.length && now - ts[ts.length - 1] > 2000 ? [now] : [...ts, now].slice(-12)));
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setTaps([]), 4000);
  };

  const redetect = async () => {
    const audioIds = new Set(p.assets.filter((a) => a.kind === 'audio').map((a) => a.id));
    const clip = p.clips.filter((c) => c.assetId && audioIds.has(c.assetId)).sort((a, b) => a.start - b.start)[0];
    if (!clip) return useUi.getState().notify('タイムラインに音源がありません', 'warn');
    setBusy(true);
    try {
      const blob = await getMediaBlob(clip.assetId!);
      if (!blob) throw new Error('メディアがありません');
      const r = await analyzeAudioBlob(blob);
      if (!r.bpm) throw new Error('テンポを検出できませんでした');
      // 素材上の拍をタイムライン上に変換 (クリップの位置・速度を考慮)
      const bpm = Math.round(r.bpm * clip.rate * 10) / 10;
      const beat = 60 / r.bpm;
      let off = r.beatOffset ?? 0;
      while (off < clip.sourceIn) off += beat;
      const tlOffset = clip.start + (off - clip.sourceIn) / clip.rate;
      commit((d) => {
        d.bpm = bpm;
        d.beatOffset = tlOffset;
      });
      useUi.getState().notify(`BPM ${bpm} を検出しました`);
    } catch (e) {
      useUi.getState().notify((e as Error).message, 'warn');
    } finally {
      setBusy(false);
    }
  };

  const lastEnd = p.clips.reduce((m, c) => Math.max(m, clipEnd(c)), 0);

  return (
    <>
      <div className="section-title">テンポとカウント</div>
      <div className="row">
        <div className="field">
          <label>BPM</label>
          <NumberField value={p.bpm} min={30} max={300} step={0.5} digits={1} onCommit={(v) => commit((d) => void (d.bpm = v))} />
        </div>
        <div className="field">
          <label>1拍目の位置</label>
          <NumberField value={p.beatOffset} min={0} step={0.01} digits={3} onCommit={(v) => commit((d) => void (d.beatOffset = v))} suffix="秒" />
        </div>
      </div>
      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 6 }}>
        <button className="btn sm" onClick={tap} title="曲に合わせて 4 回以上タップ">
          タップ {taps.length ? `(${taps.length})` : ''}
        </button>
        {tapBpm && (
          <button className="btn sm active" onClick={() => { commit((d) => void (d.bpm = tapBpm)); setTaps([]); }}>
            {tapBpm} を使う
          </button>
        )}
        <button className="btn sm" onClick={() => commit((d) => void (d.beatOffset = useUi.getState().currentTime))} title="曲の「1」の瞬間で止めて押す">
          <LuCrosshair /> 再生ヘッドを 1 拍目に
        </button>
        <button className="btn sm" disabled={busy} onClick={() => void redetect()}>
          <LuWandSparkles /> {busy ? '解析中…' : '音源から自動検出'}
        </button>
      </div>
      <p className="hint">ルーラーの数字が「エイト」、プレビューの <b>3-5</b> は「3 エイト目の 5 カウント」です。</p>

      <div className="divider" />
      <div className="section-title">編集</div>
      <label className="toggle" style={{ marginBottom: 6 }}>
        <input type="checkbox" checked={autoFit} onChange={(e) => set({ autoFit: e.target.checked })} />
        マーカー自動フィット
      </label>
      <p className="hint">ON のとき、動画クリップの先頭をマーカーにスナップさせると、次のマーカーまでぴったり収まるよう速度を自動調整します。</p>

      <div className="divider" />
      <div className="section-title">ステージ</div>
      <div className="row">
        <div className="field">
          <label>幅</label>
          <NumberField value={p.stage.width} min={2} max={40} step={0.5} digits={1} onCommit={(v) => commit((d) => void (d.stage.width = v))} suffix="m" />
        </div>
        <div className="field">
          <label>奥行き</label>
          <NumberField value={p.stage.depth} min={2} max={30} step={0.5} digits={1} onCommit={(v) => commit((d) => void (d.stage.depth = v))} suffix="m" />
        </div>
      </div>
      <div className="field">
        <label>名前の表示サイズ ({nameSize ? `${nameSize}px` : '非表示'})</label>
        <input type="range" min={0} max={20} value={nameSize} onChange={(e) => set({ nameSize: Number(e.target.value) })} />
      </div>

      <div className="divider" />
      <div className="section-title">概要</div>
      <div className="stat"><span>長さ</span><b>{formatTime(lastEnd)}</b></div>
      <div className="stat"><span>メンバー</span><b>{p.members.length}人</b></div>
      <div className="stat"><span>マーカー</span><b>{p.markers.length}</b></div>
      <div className="stat"><span>隊形</span><b>{p.clips.filter((c) => c.positions).length}</b></div>
    </>
  );
};
