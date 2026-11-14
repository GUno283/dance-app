import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Clip } from '../types';

export interface MenuItem {
  label: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: (MenuItem | 'sep')[];
}

export interface SourceState {
  assetId: string | null;
  in: number;
  out: number;
  time: number;
  /** 「素材モニターで開く」でクリップから開いた場合、そのクリップ */
  clipId: string | null;
}

interface UiState {
  // --- 再生 ---
  currentTime: number;
  isPlaying: boolean;
  playRate: number;
  loop: { on: boolean; start: number; end: number };
  metronome: boolean;

  // --- 選択 ---
  selectedClipId: string | null;
  selectedMarkerId: string | null;
  selectedMemberIds: string[];
  clipboard: Clip | null;

  // --- タイムライン ---
  pxPerSec: number;
  snap: boolean;
  autoFit: boolean;
  follow: boolean;
  snapGuide: number | null;

  // --- モニター ---
  monitorMode: 'timeline' | 'source';
  source: SourceState;
  mirror: boolean;
  videoLayout: 'single' | 'grid';
  showMemo: boolean;

  // --- ステージ ---
  showPaths: boolean;
  gridSnap: boolean;
  nameSize: number;

  // --- レイアウト ---
  mode: 'edit' | 'practice';
  leftW: number;
  rightW: number;
  timelineH: number;
  stageRatio: number;

  // --- その他 ---
  saveStatus: 'saved' | 'saving' | 'error';
  toast: { id: number; message: string; tone: 'info' | 'warn' } | null;
  contextMenu: ContextMenuState | null;
  helpOpen: boolean;

  set: (patch: Partial<UiState>) => void;
  setTime: (t: number) => void;
  selectClip: (id: string | null) => void;
  selectMarker: (id: string | null) => void;
  notify: (message: string, tone?: 'info' | 'warn') => void;
  openMenu: (e: { clientX: number; clientY: number }, items: (MenuItem | 'sep')[]) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      currentTime: 0,
      isPlaying: false,
      playRate: 1,
      loop: { on: false, start: 0, end: 0 },
      metronome: false,

      selectedClipId: null,
      selectedMarkerId: null,
      selectedMemberIds: [],
      clipboard: null,

      pxPerSec: 40,
      snap: true,
      autoFit: true,
      follow: true,
      snapGuide: null,

      monitorMode: 'timeline',
      source: { assetId: null, in: 0, out: 0, time: 0, clipId: null },
      mirror: false,
      videoLayout: 'single',
      showMemo: true,

      showPaths: true,
      gridSnap: true,
      nameSize: 11,

      mode: 'edit',
      leftW: 260,
      rightW: 360,
      timelineH: 300,
      stageRatio: 0.58,

      saveStatus: 'saved',
      toast: null,
      contextMenu: null,
      helpOpen: false,

      set: (patch) => set(patch),
      setTime: (t) => set({ currentTime: Number.isFinite(t) ? Math.max(0, t) : 0 }),
      selectClip: (id) => set({ selectedClipId: id, selectedMarkerId: null }),
      selectMarker: (id) => set({ selectedMarkerId: id, selectedClipId: null }),
      notify: (message, tone = 'info') => set({ toast: { id: Date.now(), message, tone } }),
      openMenu: (e, items) => set({ contextMenu: { x: e.clientX, y: e.clientY, items } }),
    }),
    {
      name: 'dance-studio-ui',
      version: 1,
      partialize: (s) => ({
        playRate: s.playRate,
        metronome: s.metronome,
        pxPerSec: s.pxPerSec,
        snap: s.snap,
        autoFit: s.autoFit,
        follow: s.follow,
        mirror: s.mirror,
        videoLayout: s.videoLayout,
        showMemo: s.showMemo,
        showPaths: s.showPaths,
        gridSnap: s.gridSnap,
        nameSize: s.nameSize,
        leftW: s.leftW,
        rightW: s.rightW,
        timelineH: s.timelineH,
        stageRatio: s.stageRatio,
      }),
    },
  ),
);
