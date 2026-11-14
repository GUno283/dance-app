import { create } from 'zustand';
import { produce, type Draft } from 'immer';
import type { Clip, Project } from '../types';
import { newId } from '../lib/id';
import { splitClip as splitPure } from '../lib/timeline';

const HISTORY_LIMIT = 100;

interface ProjectState {
  project: Project | null;
  past: Project[];
  future: Project[];
  /** ドラッグ中の操作は 1 回の履歴にまとめる */
  gestureBase: Project | null;

  load: (p: Project | null) => void;
  /** 履歴に残る変更 */
  commit: (recipe: (d: Draft<Project>) => void) => void;
  beginGesture: () => void;
  /** ジェスチャー中の途中経過 (履歴に残らない) */
  preview: (recipe: (d: Draft<Project>) => void) => void;
  endGesture: () => void;
  cancelGesture: () => void;
  undo: () => void;
  redo: () => void;
}

const touch = (p: Project, recipe: (d: Draft<Project>) => void): Project =>
  produce(p, (d) => {
    recipe(d);
    d.updatedAt = Date.now();
  });

export const useProject = create<ProjectState>((set, get) => ({
  project: null,
  past: [],
  future: [],
  gestureBase: null,

  load: (p) => set({ project: p, past: [], future: [], gestureBase: null }),

  commit: (recipe) => {
    const { project, past, gestureBase } = get();
    if (!project) return;
    const next = touch(project, recipe);
    if (next === project) return;
    // ジェスチャー中に commit された場合はジェスチャーに含める
    if (gestureBase) return set({ project: next });
    set({ project: next, past: [...past, project].slice(-HISTORY_LIMIT), future: [] });
  },

  beginGesture: () => {
    const { project, gestureBase } = get();
    if (project && !gestureBase) set({ gestureBase: project });
  },

  preview: (recipe) => {
    const { project } = get();
    if (!project) return;
    set({ project: touch(project, recipe) });
  },

  endGesture: () => {
    const { project, gestureBase, past } = get();
    if (!gestureBase) return;
    if (project && project !== gestureBase) {
      set({ past: [...past, gestureBase].slice(-HISTORY_LIMIT), future: [], gestureBase: null });
    } else {
      set({ gestureBase: null });
    }
  },

  cancelGesture: () => {
    const { gestureBase } = get();
    if (gestureBase) set({ project: gestureBase, gestureBase: null });
  },

  undo: () => {
    const { project, past, future, gestureBase } = get();
    if (!project || past.length === 0 || gestureBase) return;
    set({ project: past[past.length - 1], past: past.slice(0, -1), future: [project, ...future] });
  },

  redo: () => {
    const { project, past, future, gestureBase } = get();
    if (!project || future.length === 0 || gestureBase) return;
    set({ project: future[0], future: future.slice(1), past: [...past, project] });
  },
}));

// ---------------- よく使う操作 ----------------

const commit = (r: (d: Draft<Project>) => void) => useProject.getState().commit(r);

export const actions = {
  updateClip: (id: string, patch: Partial<Clip>) =>
    commit((d) => {
      const c = d.clips.find((x) => x.id === id);
      if (c) Object.assign(c, patch);
    }),

  addClip: (clip: Clip) => commit((d) => void d.clips.push(clip)),

  removeClips: (ids: string[]) =>
    commit((d) => {
      d.clips = d.clips.filter((c) => !ids.includes(c.id));
    }),

  /** 再生ヘッド位置で分割。分割できたら右側の id を返す */
  splitAt: (id: string, t: number): string | null => {
    const p = useProject.getState().project;
    const c = p?.clips.find((x) => x.id === id);
    if (!c) return null;
    const res = splitPure(c, t, newId('cl'));
    if (!res) return null;
    commit((d) => {
      const i = d.clips.findIndex((x) => x.id === id);
      d.clips.splice(i, 1, res[0], res[1]);
    });
    return res[1].id;
  },

  /** 選択トラック上の再生ヘッドにあるクリップをまとめて分割 */
  splitAllAt: (t: number) => {
    const p = useProject.getState().project;
    if (!p) return 0;
    const targets = p.clips.filter((c) => t > c.start && t < c.start + c.duration);
    if (!targets.length) return 0;
    let n = 0;
    commit((d) => {
      for (const c of targets) {
        const res = splitPure(c, t, newId('cl'));
        if (!res) continue;
        const i = d.clips.findIndex((x) => x.id === c.id);
        d.clips.splice(i, 1, res[0], res[1]);
        n++;
      }
    });
    return n;
  },

  addMarker: (time: number, label?: string, color = '#ff9f1c'): string | null => {
    const p = useProject.getState().project;
    // 同じ位置に重ねて打たない
    if (!p || p.markers.some((m) => Math.abs(m.time - time) < 0.02)) return null;
    const id = newId('mk');
    commit((d) => {
      const n = d.markers.length + 1;
      d.markers.push({ id, time: Math.max(0, time), label: label ?? `M${n}`, color });
    });
    return id;
  },
};
