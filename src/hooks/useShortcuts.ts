import { useEffect } from 'react';
import { commands } from '../lib/commands';
import { useUi } from '../store/uiStore';

const isTyping = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) {
    // range / checkbox / color などは文字入力ではないのでショートカットを効かせる
    return !['range', 'checkbox', 'radio', 'color', 'button'].includes(el.type);
  }
  return false;
};

export const SHORTCUTS: { keys: string; desc: string; group: string }[] = [
  { group: '再生', keys: 'Space', desc: '再生 / 一時停止' },
  { group: '再生', keys: '← / →', desc: '1コマ戻る / 進む' },
  { group: '再生', keys: 'Shift + ← / →', desc: '1拍戻る / 進む' },
  { group: '再生', keys: '↑ / ↓', desc: '前 / 次のマーカーへ' },
  { group: '再生', keys: 'Home / End', desc: '先頭 / 末尾へ' },
  { group: '再生', keys: 'L', desc: 'ループ ON/OFF (区間がなければ今のマーカー区間)' },
  { group: '再生', keys: 'I / O', desc: 'ループ開始点 / 終了点 (素材モニターではイン点 / アウト点)' },
  { group: '編集', keys: 'M', desc: '再生ヘッドにマーカーを追加' },
  { group: '編集', keys: 'S', desc: '再生ヘッドで分割 (未選択なら全トラック)' },
  { group: '編集', keys: 'F', desc: '選択クリップをマーカー区間にフィット' },
  { group: '編集', keys: 'Delete / Backspace', desc: '削除' },
  { group: '編集', keys: 'Ctrl + C / X / V', desc: 'コピー / カット / 再生ヘッドに貼り付け' },
  { group: '編集', keys: 'Ctrl + D', desc: '複製 (直後に配置)' },
  { group: '編集', keys: 'Ctrl + Z / Ctrl + Shift + Z', desc: '元に戻す / やり直し' },
  { group: '編集', keys: 'Alt + 端をドラッグ', desc: '速度を変えて長さを変更' },
  { group: '編集', keys: 'Shift + ドラッグ', desc: 'スナップを一時的に無効化' },
  { group: '表示', keys: '+ / -', desc: 'タイムラインをズーム' },
  { group: '表示', keys: 'Ctrl + ホイール', desc: 'マウス位置を中心にズーム' },
  { group: '表示', keys: 'Tab', desc: '素材モニター / タイムライン切り替え' },
  { group: '表示', keys: '?', desc: 'このヘルプ' },
];

export const useShortcuts = () => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const ui = useUi.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key;
      const run = (fn: () => void) => {
        e.preventDefault();
        fn();
      };

      if (ui.helpOpen && key === 'Escape') return run(() => ui.set({ helpOpen: false }));
      if (key === 'Escape') return run(() => ui.set({ contextMenu: null, selectedClipId: null, selectedMarkerId: null, selectedMemberIds: [] }));

      if (mod) {
        switch (key.toLowerCase()) {
          case 'z':
            return run(e.shiftKey ? commands.redo : commands.undo);
          case 'y':
            return run(commands.redo);
          case 'c':
            return run(commands.copy);
          case 'x':
            return run(commands.cut);
          case 'v':
            return run(() => commands.paste());
          case 'd':
            return run(commands.duplicate);
        }
        return;
      }
      if (e.altKey) return;

      const source = ui.monitorMode === 'source';
      switch (key) {
        case ' ':
          // フォーカス中のボタンが Space で押されてしまうのを防ぐ
          return run(commands.togglePlay);
        case 'ArrowLeft':
          return run(() => (e.shiftKey && !source ? commands.stepBeat(-1) : commands.step(-1)));
        case 'ArrowRight':
          return run(() => (e.shiftKey && !source ? commands.stepBeat(1) : commands.step(1)));
        case 'ArrowUp':
          return run(() => commands.jumpMarker(-1));
        case 'ArrowDown':
          return run(() => commands.jumpMarker(1));
        case 'Home':
          return run(() => commands.seek(source ? ui.source.in : 0));
        case 'End':
          return run(() => commands.seek(source ? ui.source.out : Number.MAX_SAFE_INTEGER));
        case 'Delete':
        case 'Backspace':
          return run(commands.deleteSelection);
        case 'Tab':
          return run(() => ui.set({ monitorMode: source ? 'timeline' : 'source', isPlaying: false }));
        case '?':
          return run(() => ui.set({ helpOpen: !ui.helpOpen }));
        case '+':
        case '=':
          return run(() => commands.zoom(1.25));
        case '-':
          return run(() => commands.zoom(0.8));
      }
      switch (key.toLowerCase()) {
        case 'm':
          return run(commands.addMarker);
        case 's':
          return run(commands.split);
        case 'f':
          return run(commands.fitSelected);
        case 'l':
          return run(commands.toggleLoop);
        case 'i':
          return run(() => (source ? ui.set({ source: { ...ui.source, in: Math.min(ui.source.time, ui.source.out - 0.1) } }) : commands.setLoopIn()));
        case 'o':
          return run(() => (source ? ui.set({ source: { ...ui.source, out: Math.max(ui.source.time, ui.source.in + 0.1) } }) : commands.setLoopOut()));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
};
