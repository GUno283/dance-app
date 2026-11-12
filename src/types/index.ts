export type UserRole = 'admin' | 'leader' | 'member';

export interface User {
  id: string;
  name: string;
  year: number;
  genre: string[];
  photoUrl: string;
}

export interface Project {
  id: string;
  title: string;
  showcase: string;
  genre: string;
  leaderId: string;
  memberIds: string[];
  practiceSchedule: string;
}

// === V3 NLE Data Structure ===

export interface Member {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string;
}

export type TrackType = 'audio' | 'video' | 'formation' | 'memo' | 'section' | 'marker';

export interface FormationPosition {
  userId: string;
  x: number; // 0.0 - 1.0
  y: number; // 0.0 - 1.0
}

export interface FormationData {
  positions: FormationPosition[];
}

export interface AssetFolder {
  id: string;
  name: string;
  color?: string;
}

export interface Asset {
  id: string;
  projectId: string;
  type: 'audio' | 'video' | 'image' | 'formation';
  name: string;
  url: string; // ObjectURL or remote URL
  duration?: number;
  createdAt?: number; // アップロード日時
  thumbnailUrl?: string; // サムネイル画像(base64等)
  formationData?: FormationData; // フォーメーションアセット用の実データ
  folderId?: string; // フォルダ分類
  colorLabel?: string; // アセットごとの色付け
  
  // オーディオ解析データ
  waveformData?: number[]; // 波形描画用の振幅配列
  peaks?: number[]; // スナップ用のピーク時間（秒）配列
}

export interface Clip {
  id: string;
  trackId: string;
  name: string;
  startAt: number; // タイムライン上の開始時間 (秒)
  duration: number; // タイムライン上での表示の長さ (秒)
  color?: string; // タイムラインでの表示色

  // 音源・動画・フォーメーションクリップ用
  assetId?: string; 
  offsetInAsset?: number; // 素材のどこから再生するか (秒)
  playbackRate?: number; // 再生速度
  videoType?: 'front' | 'back' | 'mirror' | 'side'; // 動画の種別

  // メモ・セクションクリップ用
  textData?: string; 
}

export interface Track {
  id: string;
  projectId: string;
  name: string;
  type: TrackType;
  order: number; // 上からの並び順
  clips: Clip[];
}

export interface ProjectEditorData {
  projectId: string;
  bpm: number; // 1エイトの秒数計算用
  members: Member[];
  folders: AssetFolder[];
  assets: Asset[];
  tracks: Track[];
}
