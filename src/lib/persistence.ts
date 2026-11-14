import localforage from 'localforage';
import type { Project, ProjectSummary } from '../types';

const projectStore = localforage.createInstance({ name: 'dance-studio', storeName: 'projects' });

export const saveProject = async (p: Project): Promise<void> => {
  await projectStore.setItem(p.id, p);
};

export const loadProject = async (id: string): Promise<Project | null> => {
  const p = await projectStore.getItem<Project>(id);
  return p ? normalizeProject(p) : null;
};

export const deleteProject = (id: string): Promise<void> => projectStore.removeItem(id);

export const listProjects = async (): Promise<ProjectSummary[]> => {
  const out: ProjectSummary[] = [];
  await projectStore.iterate<Project, void>((p) => {
    out.push({
      id: p.id,
      name: p.name,
      updatedAt: p.updatedAt,
      createdAt: p.createdAt,
      memberCount: p.members.length,
      clipCount: p.clips.length,
    });
  });
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
};

/** 古い/不完全なデータでも落ちないように補完する */
export const normalizeProject = (p: Project): Project => ({
  ...p,
  version: 2,
  bpm: p.bpm || 120,
  beatOffset: p.beatOffset || 0,
  members: p.members ?? [],
  assets: p.assets ?? [],
  tracks: p.tracks ?? [],
  clips: (p.clips ?? []).map((c) => ({ ...c, rate: c.rate || 1, sourceIn: c.sourceIn || 0, label: c.label ?? '' })),
  markers: p.markers ?? [],
  stage: p.stage ?? { width: 10, depth: 6 },
});

export const downloadJson = (filename: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
