import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProjectEditorData, Project, UserRole, Clip, Track, Asset, Member, FormationPosition, AssetFolder } from '../types';
import { mockEditorData, mockProjects } from '../data/mockData';
import { v4 as uuidv4 } from 'uuid';

export interface ContextMenuOption {
  label: string;
  onClick: () => void;
  color?: string;
}

export interface ContextMenuState {
  x: number;
  y: number;
  options: ContextMenuOption[];
}

interface AppState {
  currentUserRole: UserRole;
  setCurrentUserRole: (role: UserRole) => void;
  
  projects: Project[];
  editorData: ProjectEditorData | null;
  setEditorData: (data: ProjectEditorData | null) => void;
  
  // Member Actions
  addMember: (member: Member) => void;
  updateMember: (memberId: string, updates: Partial<Member>) => void;
  deleteMember: (memberId: string) => void;

  // Folder Actions
  addFolder: (folder: AssetFolder) => void;
  updateFolder: (folderId: string, updates: Partial<AssetFolder>) => void;
  deleteFolder: (folderId: string) => void;

  // NLE Actions
  addAsset: (asset: Asset) => void;
  addTrack: (track: Track) => void;
  addClip: (trackId: string, clip: Clip) => void;
  updateClip: (clipId: string, updates: Partial<Clip>) => void;
  
  // Player State
  isPlaying: boolean;
  setIsPlaying: (isPlaying: boolean) => void;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  duration: number;
  setDuration: (duration: number) => void;
  
  // Selection & Copy
  selectedAssetId: string | null;
  setSelectedAssetId: (id: string | null) => void;
  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;
  copiedClip: Clip | null;
  setCopiedClip: (clip: Clip | null) => void;
  
  copiedFormation: FormationPosition[] | null;
  setCopiedFormation: (formation: FormationPosition[] | null) => void;
  
  // Preview Mode
  previewMode: 'timeline' | 'source';
  setPreviewMode: (mode: 'timeline' | 'source') => void;
  sourceAssetId: string | null;
  setSourceAssetId: (id: string | null) => void;
  sourceInPoint: number;
  setSourceInPoint: (val: number) => void;
  sourceOutPoint: number;
  setSourceOutPoint: (val: number) => void;

  contextMenu: ContextMenuState | null;
  setContextMenu: (menu: ContextMenuState | null) => void;
  
  splitClip: (clipId: string, time: number) => void;
  rippleDeleteClip: (clipId: string) => void;
  deleteClip: (clipId: string) => void;
  
  updateAsset: (assetId: string, updates: Partial<Asset>) => void;
  deleteAsset: (assetId: string) => void;

  // Timeline Zoom
  pixelsPerSecond: number;
  setPixelsPerSecond: (val: number | ((prev: number) => number)) => void;

  // Formation View
  nameFontSize: number;
  setNameFontSize: (size: number) => void;

  // Playback Control
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
  isLooping: boolean;
  setIsLooping: (loop: boolean) => void;

  // History (Undo/Redo)
  past: ProjectEditorData[];
  future: ProjectEditorData[];
  commitHistory: () => void;
  undo: () => void;
  redo: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      currentUserRole: 'admin',
      setCurrentUserRole: (role) => set({ currentUserRole: role }),
      
      projects: mockProjects,
      editorData: mockEditorData,
      setEditorData: (data) => set({ editorData: data }),
      
      addMember: (member) => set((state) => {
        if (!state.editorData) return state;
        return {
          editorData: {
            ...state.editorData,
            members: [...state.editorData.members, member]
          }
        };
      }),

      updateMember: (memberId, updates) => set((state) => {
        if (!state.editorData) return state;
        const newMembers = state.editorData.members.map(m => m.id === memberId ? { ...m, ...updates } : m);
        return { editorData: { ...state.editorData, members: newMembers } };
      }),

      deleteMember: (memberId) => set((state) => {
        if (!state.editorData) return state;
        const newMembers = state.editorData.members.filter(m => m.id !== memberId);
        // Remove member from all formations
        const newAssets = state.editorData.assets.map(asset => {
          if (asset.type === 'formation' && asset.formationData) {
            return {
              ...asset,
              formationData: {
                positions: asset.formationData.positions.filter(p => p.userId !== memberId)
              }
            };
          }
          return asset;
        });
        return { editorData: { ...state.editorData, members: newMembers, assets: newAssets } };
      }),

      addFolder: (folder) => set((state) => {
        if (!state.editorData) return state;
        return { editorData: { ...state.editorData, folders: [...state.editorData.folders, folder] } };
      }),

      updateFolder: (folderId, updates) => set((state) => {
        if (!state.editorData) return state;
        const newFolders = state.editorData.folders.map(f => f.id === folderId ? { ...f, ...updates } : f);
        return { editorData: { ...state.editorData, folders: newFolders } };
      }),

      deleteFolder: (folderId) => set((state) => {
        if (!state.editorData) return state;
        const newFolders = state.editorData.folders.filter(f => f.id !== folderId);
        // Remove folder assignment from assets
        const newAssets = state.editorData.assets.map(a => a.folderId === folderId ? { ...a, folderId: undefined } : a);
        return { editorData: { ...state.editorData, folders: newFolders, assets: newAssets } };
      }),

      addAsset: (asset) => set((state) => {
        if (!state.editorData) return state;
        return {
          editorData: {
            ...state.editorData,
            assets: [...state.editorData.assets, asset]
          }
        };
      }),

      updateAsset: (assetId, updates) => set((state) => {
        if (!state.editorData) return state;
        const newAssets = state.editorData.assets.map(a => a.id === assetId ? { ...a, ...updates } : a);
        return { editorData: { ...state.editorData, assets: newAssets } };
      }),
      deleteAsset: (assetId) => set((state) => {
        if (!state.editorData) return state;
        const newAssets = state.editorData.assets.filter(a => a.id !== assetId);
        // アセットを参照しているクリップも削除
        const newTracks = state.editorData.tracks.map(track => ({
          ...track,
          clips: track.clips.filter(c => c.assetId !== assetId)
        }));
        return { 
          editorData: { ...state.editorData, assets: newAssets, tracks: newTracks },
          selectedAssetId: state.selectedAssetId === assetId ? null : state.selectedAssetId
        };
      }),

      addTrack: (track) => set((state) => {
        if (!state.editorData) return state;
        return { editorData: { ...state.editorData, tracks: [track, ...state.editorData.tracks] } };
      }),

      addClip: (trackId, clip) => set((state) => {
        if (!state.editorData) return state;
        const newTracks = state.editorData.tracks.map(track => 
          track.id === trackId 
            ? { ...track, clips: [...track.clips, clip] } 
            : track
        );
        return { editorData: { ...state.editorData, tracks: newTracks } };
      }),

      updateClip: (clipId, updates) => set((state) => {
        if (!state.editorData) return state;
        const newTracks = state.editorData.tracks.map(track => ({
          ...track,
          clips: track.clips.map(c => c.id === clipId ? { ...c, ...updates } : c)
        }));
        return { editorData: { ...state.editorData, tracks: newTracks } };
      }),
      
      deleteClip: (clipId) => set((state) => {
        if (!state.editorData) return state;
        const newTracks = state.editorData.tracks.map(track => ({
          ...track,
          clips: track.clips.filter(c => c.id !== clipId)
        }));
        return { 
          editorData: { ...state.editorData, tracks: newTracks },
          selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId
        };
      }),
      
      isPlaying: false,
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      currentTime: 0,
      setCurrentTime: (time) => set({ 
        currentTime: (typeof time !== 'number' || isNaN(time)) ? 0 : time 
      }),
      duration: 360,
      setDuration: (duration) => set({ duration }),
      
      selectedAssetId: null,
      setSelectedAssetId: (id) => set({ selectedAssetId: id }),
      selectedClipId: null,
      setSelectedClipId: (id) => set({ selectedClipId: id }),
      copiedClip: null,
      setCopiedClip: (clip) => set({ copiedClip: clip }),
      
      copiedFormation: null,
      setCopiedFormation: (formation) => set({ copiedFormation: formation }),
      
      previewMode: 'timeline',
      setPreviewMode: (mode) => set({ previewMode: mode }),
      sourceAssetId: null,
      setSourceAssetId: (id) => set({ sourceAssetId: id }),
      sourceInPoint: 0,
      setSourceInPoint: (val) => set({ sourceInPoint: val }),
      sourceOutPoint: 10,
      setSourceOutPoint: (val) => set({ sourceOutPoint: val }),

      contextMenu: null,
      setContextMenu: (menu) => set({ contextMenu: menu }),

      splitClip: (clipId, time) => set((state) => {
        if (!state.editorData) return state;
        let newTracks = [...state.editorData.tracks];
        let didSplit = false;
        
        newTracks = newTracks.map(track => {
          const clipIndex = track.clips.findIndex(c => c.id === clipId);
          if (clipIndex === -1) return track;
          
          const clip = track.clips[clipIndex];
          if (time <= clip.startAt || time >= clip.startAt + clip.duration) return track; // cannot split outside clip
          
          didSplit = true;
          const leftDuration = time - clip.startAt;
          const rightDuration = clip.duration - leftDuration;
          
          const leftClip = { ...clip, duration: leftDuration };
          const rightClip = { 
            ...clip, 
            id: `cl-${uuidv4()}`, 
            startAt: time, 
            duration: rightDuration, 
            offsetInAsset: (clip.offsetInAsset || 0) + (leftDuration * (clip.playbackRate || 1.0))
          };
          
          const newClips = [...track.clips];
          newClips.splice(clipIndex, 1, leftClip, rightClip);
          
          return { ...track, clips: newClips };
        });
        
        return didSplit ? { editorData: { ...state.editorData, tracks: newTracks } } : state;
      }),

      rippleDeleteClip: (clipId) => set((state) => {
        if (!state.editorData) return state;
        const newTracks = state.editorData.tracks.map(track => {
          const clip = track.clips.find(c => c.id === clipId);
          if (!clip) return track;
          
          const durationToRipple = clip.duration;
          const deleteStartAt = clip.startAt;
          
          const newClips = track.clips
            .filter(c => c.id !== clipId)
            .map(c => {
              // Shift clips that start after this clip to the left
              if (c.startAt >= deleteStartAt) {
                return { ...c, startAt: Math.max(0, c.startAt - durationToRipple) };
              }
              return c;
            });
            
          return { ...track, clips: newClips };
        });
        return { 
          editorData: { ...state.editorData, tracks: newTracks },
          selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId
        };
      }),

      pixelsPerSecond: 10,
      setPixelsPerSecond: (val) => set((state) => ({
        pixelsPerSecond: typeof val === 'function' ? val(state.pixelsPerSecond) : val
      })),

      nameFontSize: 12,
      setNameFontSize: (size) => set({ nameFontSize: size }),
      
      playbackRate: 1.0,
      setPlaybackRate: (rate) => set({ playbackRate: rate }),
      isLooping: false,
      setIsLooping: (loop) => set({ isLooping: loop }),

      past: [],
      future: [],
      commitHistory: () => set((state) => {
        if (!state.editorData) return state;
        const newPast = [...state.past, state.editorData];
        // limit history to 50 steps
        if (newPast.length > 50) newPast.shift();
        return { past: newPast, future: [] };
      }),
      undo: () => set((state) => {
        if (state.past.length === 0 || !state.editorData) return state;
        const previous = state.past[state.past.length - 1];
        const newPast = state.past.slice(0, -1);
        return {
          past: newPast,
          future: [state.editorData, ...state.future],
          editorData: previous,
          selectedClipId: null
        };
      }),
      redo: () => set((state) => {
        if (state.future.length === 0 || !state.editorData) return state;
        const next = state.future[0];
        const newFuture = state.future.slice(1);
        return {
          past: [...state.past, state.editorData],
          future: newFuture,
          editorData: next,
          selectedClipId: null
        };
      }),
    }),
    {
      name: 'dance-app-storage-v3',
      partialize: (state) => ({ 
        currentUserRole: state.currentUserRole,
        editorData: state.editorData
      }),
    }
  )
);
