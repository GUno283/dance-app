import type { User, Project, ProjectEditorData } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const currentUser: User = {
  id: "u1",
  name: "Taro (あなた)",
  year: 3,
  genre: ["HIPHOP"],
  photoUrl: "https://i.pravatar.cc/150?u=u1"
};

export const mockUsers: User[] = [
  currentUser,
  { id: "u2", name: "Jiro", year: 2, genre: ["HIPHOP"], photoUrl: "https://i.pravatar.cc/150?u=u2" },
  { id: "u3", name: "Hanako", year: 3, genre: ["JAZZ"], photoUrl: "https://i.pravatar.cc/150?u=u3" },
  { id: "u4", name: "Shiro", year: 1, genre: ["HIPHOP"], photoUrl: "https://i.pravatar.cc/150?u=u4" },
  { id: "u5", name: "Goro", year: 1, genre: ["HIPHOP", "LOCK"], photoUrl: "https://i.pravatar.cc/150?u=u5" },
];

export const mockProjects: Project[] = [
  {
    id: "p1",
    title: "Opening HIPHOP",
    showcase: "2026 夏公演",
    genre: "HIPHOP",
    leaderId: "u1",
    memberIds: ["u1", "u2", "u4", "u5"],
    practiceSchedule: "火・木 18:00-20:00",
  },
  {
    id: "p2",
    title: "Middle JAZZ",
    showcase: "2026 夏公演",
    genre: "JAZZ",
    leaderId: "u3",
    memberIds: ["u3", "u1"],
    practiceSchedule: "水・金 18:00-20:00",
  }
];

export const mockEditorData: ProjectEditorData = {
  projectId: "p1",
  bpm: 120,
  members: [
    { id: "u1", name: "Taro", color: "#FF3B30", avatarUrl: "https://i.pravatar.cc/150?u=u1" },
    { id: "u2", name: "Jiro", color: "#007AFF", avatarUrl: "https://i.pravatar.cc/150?u=u2" },
    { id: "u4", name: "Shiro", color: "#34C759", avatarUrl: "https://i.pravatar.cc/150?u=u4" },
    { id: "u5", name: "Goro", color: "#FF9500", avatarUrl: "https://i.pravatar.cc/150?u=u5" },
  ],
  folders: [
    { id: "fld-1", name: "参考動画", color: "#FF9500" },
    { id: "fld-2", name: "フォーメーション", color: "#34C759" }
  ],
  assets: [
    {
      id: "a1",
      projectId: "p1",
      type: "audio",
      name: "メイン音源",
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      duration: 360,
    },
    {
      id: "v1",
      projectId: "p1",
      type: "video",
      name: "参考振り動画",
      url: "https://www.w3schools.com/html/mov_bbb.mp4",
      duration: 10,
    },
    {
      id: "f-a1",
      projectId: "p1",
      type: "formation",
      name: "オープニング配置",
      url: "",
      formationData: {
        positions: [
          { userId: "u1", x: 0.5, y: 0.3 },
          { userId: "u2", x: 0.3, y: 0.5 },
          { userId: "u4", x: 0.7, y: 0.5 },
          { userId: "u5", x: 0.5, y: 0.7 },
        ]
      }
    },
    {
      id: "f-a2",
      projectId: "p1",
      type: "formation",
      name: "Aメロ開始",
      url: "",
      formationData: {
        positions: [
          { userId: "u1", x: 0.2, y: 0.2 },
          { userId: "u2", x: 0.8, y: 0.2 },
          { userId: "u4", x: 0.2, y: 0.8 },
          { userId: "u5", x: 0.8, y: 0.8 },
        ]
      }
    },
    {
      id: "f-a3",
      projectId: "p1",
      type: "formation",
      name: "Aメロ展開",
      url: "",
      formationData: {
        positions: [
          { userId: "u2", x: 0.2, y: 0.5 },
          { userId: "u1", x: 0.4, y: 0.5 },
          { userId: "u5", x: 0.6, y: 0.5 },
          { userId: "u4", x: 0.8, y: 0.5 },
        ]
      }
    }
  ],
  tracks: [
    {
      id: "tr-marker",
      projectId: "p1",
      name: "マーカー",
      type: "marker",
      order: 0,
      clips: [
        { id: "cl-m1", trackId: "tr-marker", name: "注意: 早着替え", startAt: 32, duration: 4, color: "#FF2D55", textData: "舞台袖にはける" }
      ]
    },
    {
      id: "tr-section",
      projectId: "p1",
      name: "セクション",
      type: "section",
      order: 1,
      clips: [
        { id: "cl-s1", trackId: "tr-section", name: "イントロ", startAt: 0, duration: 16, color: "#007AFF", textData: "全体で広がる" },
        { id: "cl-s2", trackId: "tr-section", name: "Aメロ", startAt: 16, duration: 32, color: "#34C759", textData: "細かく合わせる" },
        { id: "cl-s3", trackId: "tr-section", name: "サビ", startAt: 48, duration: 32, color: "#FF9500", textData: "一番大きく！" },
      ]
    },
    {
      id: "tr-audio",
      projectId: "p1",
      name: "マスター音源",
      type: "audio",
      order: 2,
      clips: [
        { id: "cl-a1", trackId: "tr-audio", name: "メイン音源", startAt: 0, duration: 360, assetId: "a1", offsetInAsset: 0, playbackRate: 1.0 }
      ]
    },
    {
      id: "tr-video",
      projectId: "p1",
      name: "振り動画 (正面)",
      type: "video",
      order: 3,
      clips: [
        { id: "cl-v1", trackId: "tr-video", name: "サビ振り", startAt: 48, duration: 10, assetId: "v1", offsetInAsset: 0, playbackRate: 1.0, videoType: "front" }
      ]
    },
    {
      id: "tr-formation",
      projectId: "p1",
      name: "フォーメーション",
      type: "formation",
      order: 4,
      clips: [
        { id: "cl-f1", trackId: "tr-formation", name: "オープニング配置", startAt: 0, duration: 8, assetId: "f-a1" },
        { id: "cl-f2", trackId: "tr-formation", name: "Aメロ開始", startAt: 8, duration: 8, assetId: "f-a2" },
        { id: "cl-f3", trackId: "tr-formation", name: "Aメロ展開", startAt: 16, duration: 16, assetId: "f-a3" }
      ]
    }
  ]
};
