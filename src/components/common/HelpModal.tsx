import React from 'react';
import { useUi } from '../../store/uiStore';
import { SHORTCUTS } from '../../hooks/useShortcuts';

export const HelpModal: React.FC = () => {
  const open = useUi((s) => s.helpOpen);
  const set = useUi((s) => s.set);
  if (!open) return null;
  const groups = [...new Set(SHORTCUTS.map((s) => s.group))];
  return (
    <div className="modal-bg" onPointerDown={() => set({ helpOpen: false })}>
      <div className="modal" onPointerDown={(e) => e.stopPropagation()}>
        <div className="row" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>使い方とショートカット</h2>
          <div className="spacer" />
          <button className="btn sm" onClick={() => set({ helpOpen: false })}>閉じる</button>
        </div>
        <ol className="hint" style={{ fontSize: 12, color: 'var(--text-2)', paddingLeft: 18, lineHeight: 1.8 }}>
          <li>左の「メディア」に音源と振付動画をドラッグ＆ドロップで追加します。音源を入れると BPM と 1 拍目を自動で推定します。</li>
          <li>素材はタイムラインのトラックへドラッグ。ダブルクリックすると素材モニターでイン点 / アウト点を決めてから追加できます。</li>
          <li>再生しながら <span className="kbd">M</span> でマーカーを打ち、動画クリップの先頭をマーカーに合わせると、次のマーカーまでぴったり収まるよう速度が自動調整されます (自動フィット)。</li>
          <li>右の「ステージ」でメンバーをドラッグして隊形を作ります。隊形と隊形の間は自動で移動アニメーションになります。</li>
          <li>「練習」モードでは大きな映像・カウント・区間ループで通し練習ができます。</li>
        </ol>
        {groups.map((g) => (
          <div key={g} style={{ marginTop: 14 }}>
            <div className="section-title">{g}</div>
            <div className="help-grid">
              {SHORTCUTS.filter((s) => s.group === g).map((s) => (
                <div key={s.keys} className="help-row">
                  <span>{s.desc}</span>
                  <span className="kbd">{s.keys}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
