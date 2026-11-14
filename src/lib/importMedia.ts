import type { Asset, Clip } from '../types';
import { useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';
import { detectKind, probeAudioDuration, probeVideo, putMedia, useMediaUrls } from './media';
import { analyzeAudioBlob } from './audio';
import { newId } from './id';
import { TRACK_COLORS, makeTrack } from './factory';

const stripExt = (name: string) => name.replace(/\.[^.]+$/, '');

/**
 * ファイルを取り込む。
 * - 書き出し/読み込みでメディアが欠けているアセットと名前・サイズが一致すれば自動で再リンク
 * - 最初の音源はタイムライン先頭に置き、BPM と 1 拍目を自動設定 (Undo で戻せる)
 */
export const importFiles = async (files: File[], place?: { trackId: string; start: number }): Promise<Asset[]> => {
  const out: Asset[] = [];
  const ui = useUi.getState();
  for (const file of files) {
    const kind = detectKind(file);
    if (!kind) {
      ui.notify(`${file.name} は対応していない形式です (動画・音声のみ)`, 'warn');
      continue;
    }
    const project = useProject.getState().project;
    if (!project) return out;

    const missing = useMediaUrls.getState().missing;
    const relink = project.assets.find((a) => missing[a.id] && a.name === stripExt(file.name) && (!a.size || a.size === file.size));
    if (relink) {
      await putMedia(relink.id, file);
      ui.notify(`「${relink.name}」を再リンクしました`);
      out.push(relink);
      continue;
    }

    const id = newId('as');
    const url = await putMedia(id, file);
    const asset: Asset = { id, kind, name: stripExt(file.name), duration: 0, mime: file.type, size: file.size, createdAt: Date.now() };
    let bpm: number | null = null;
    let beatOffset: number | null = null;

    if (kind === 'video') {
      const info = await probeVideo(url);
      asset.duration = info.duration;
      asset.thumbnail = info.thumbnail;
    } else {
      try {
        const a = await analyzeAudioBlob(file);
        asset.duration = a.duration;
        asset.waveform = a.waveform;
        bpm = a.bpm;
        beatOffset = a.beatOffset;
      } catch (e) {
        console.warn('audio analysis failed', e);
        asset.duration = await probeAudioDuration(url);
      }
    }
    if (!asset.duration) asset.duration = 10;

    const p = useProject.getState().project!;
    const firstAudio = kind === 'audio' && !p.clips.some((c) => p.assets.find((x) => x.id === c.assetId)?.kind === 'audio');
    useProject.getState().commit((d) => {
      d.assets.push(asset);
      let target = place ? d.tracks.find((t) => t.id === place.trackId && t.kind === kind) : undefined;
      if (!target && firstAudio && !place) {
        target = d.tracks.find((t) => t.kind === 'audio');
        if (!target) {
          target = makeTrack('audio');
          d.tracks.unshift(target);
        }
      }
      if (target) {
        const clip: Clip = {
          id: newId('cl'),
          trackId: target.id,
          start: place?.start ?? 0,
          duration: asset.duration,
          label: asset.name,
          assetId: asset.id,
          sourceIn: 0,
          rate: 1,
          color: TRACK_COLORS[kind],
        };
        d.clips.push(clip);
      }
      if (firstAudio && bpm) {
        d.bpm = bpm;
        d.beatOffset = beatOffset ?? 0;
      }
    });
    if (firstAudio && bpm) ui.notify(`BPM ${bpm} を検出し、カウントを合わせました (右の設定で調整できます)`);
    out.push(asset);
  }
  return out;
};
