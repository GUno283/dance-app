// ===== Dance Studio data model (v2) =====
// 時間はすべて「秒」。座標はステージに対する正規化座標 (0.0〜1.0)。

export type TrackKind = 'audio' | 'video' | 'formation' | 'memo';
export type AssetKind = 'audio' | 'video';

export interface Member {
  id: string;
  name: string;
  color: string;
  /** ステージ上の丸に表示する短い名前 (1〜3文字) */
  short: string;
}

export interface Position {
  memberId: string;
  /** 0 = 上手側(客席から見て左) … 1 = 下手側 */
  x: number;
  /** 0 = 奥 … 1 = 客席側(前) */
  y: number;
}

export interface Asset {
  id: string;
  kind: AssetKind;
  name: string;
  duration: number;
  mime: string;
  size: number;
  createdAt: number;
  /** 0〜255 に量子化した波形 (WAVEFORM_RATE 点/秒) */
  waveform?: number[];
  /** 小さなサムネイル (dataURL) */
  thumbnail?: string;
}

export interface Clip {
  id: string;
  trackId: string;
  /** タイムライン上の開始位置 */
  start: number;
  /** タイムライン上の長さ */
  duration: number;
  label: string;
  color?: string;
  // --- メディアクリップ ---
  assetId?: string;
  /** 素材のどこから再生するか */
  sourceIn: number;
  /** 再生速度。素材上の長さ = duration * rate */
  rate: number;
  // --- メモクリップ ---
  text?: string;
  // --- 隊形クリップ ---
  positions?: Position[];
}

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  muted?: boolean;
}

export interface Marker {
  id: string;
  time: number;
  label: string;
  color: string;
}

export interface StageSettings {
  /** ステージ幅 (m) */
  width: number;
  /** ステージ奥行き (m) */
  depth: number;
}

export interface Project {
  id: string;
  version: 2;
  name: string;
  createdAt: number;
  updatedAt: number;
  bpm: number;
  /** 1エイト目の「1」が鳴る時間 */
  beatOffset: number;
  members: Member[];
  assets: Asset[];
  tracks: Track[];
  clips: Clip[];
  markers: Marker[];
  stage: StageSettings;
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
  memberCount: number;
  clipCount: number;
}
