import { useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';
import type { Clip, Project } from '../types';
import { activeClipAt, mediaTimeAt, projectDuration } from './timeline';
import { getMediaUrl } from './media';
import { beatLength, clamp, timeToBeat } from './time';

/**
 * 再生エンジン
 * - 1本の requestAnimationFrame ループで、時間の進行とメディア要素の同期を行う
 * - 音源クリップが鳴っているときはその音声要素を「マスタークロック」にする
 *   (音が途切れたりピッチが揺れたりしないよう、音声側はシークしない)
 * - 動画は playbackRate をネイティブに合わせ、大きくズレたときだけシークする
 */

type MediaEl = HTMLMediaElement;

const timelineEls = new Map<string, MediaEl>(); // trackId -> element
let sourceEl: MediaEl | null = null;

export const registerTrackMedia = (trackId: string, el: MediaEl | null) => {
  if (el) timelineEls.set(trackId, el);
  else timelineEls.delete(trackId);
};
export const registerSourceMedia = (el: MediaEl | null) => {
  sourceEl = el;
};

const DRIFT_PLAYING = 0.15;
const DRIFT_PAUSED = 0.02;

// ---------------- メトロノーム ----------------
let audioCtx: AudioContext | null = null;
const click = (accent: boolean) => {
  try {
    audioCtx ??= new AudioContext();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = accent ? 1600 : 1000;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.07);
  } catch {
    /* noop */
  }
};

const setSrc = (el: MediaEl, assetId: string): boolean => {
  if (el.dataset.assetId === assetId) return true;
  const url = getMediaUrl(assetId);
  if (!url) return false;
  el.dataset.assetId = assetId;
  el.src = url;
  return true;
};

const deactivate = (el: MediaEl) => {
  if (!el.paused) el.pause();
  if (el.dataset.active !== '0') el.dataset.active = '0';
};

export const startEngine = (): (() => void) => {
  let raf = 0;
  let last = performance.now();
  let lastSet = useUi.getState().currentTime;
  let wasPlaying = false;
  let lastMode = useUi.getState().monitorMode;

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const ui = useUi.getState();
    const project = useProject.getState().project;
    if (!project) return;

    if (ui.monitorMode !== lastMode) {
      timelineEls.forEach(deactivate);
      if (sourceEl && !sourceEl.paused) sourceEl.pause();
      lastMode = ui.monitorMode;
    }

    if (ui.monitorMode === 'source') {
      runSource(ui);
      wasPlaying = ui.isPlaying;
      return;
    }

    // ---------- タイムライン ----------
    let t = ui.currentTime;
    const externalSeek = Math.abs(t - lastSet) > 1e-4;
    const justStarted = ui.isPlaying && !wasPlaying;
    const forceSeek = externalSeek || justStarted;
    const duration = projectDuration(project);

    if (ui.isPlaying) {
      if (justStarted) {
        // 最後まで再生し終わっていたら頭 (ループ中ならループ開始点) から
        if (ui.loop.on && ui.loop.end > ui.loop.start && (t >= ui.loop.end || t < ui.loop.start)) t = ui.loop.start;
        else if (duration > 0 && t >= duration - 0.01) t = 0;
      } else if (!externalSeek) {
        const master = findMaster(project);
        const prev = t;
        t = master ? master.time : t + dt * ui.playRate;
        if (ui.metronome) tickMetronome(project, prev, t);
      }
      if (ui.loop.on && ui.loop.end - ui.loop.start > 0.05 && t >= ui.loop.end) {
        t = ui.loop.start;
        syncAll(project, t, true, ui.playRate, true);
      } else if (!ui.loop.on && duration > 0 && t >= duration) {
        t = duration;
        useUi.setState({ isPlaying: false });
      }
    }

    syncAll(project, t, useUi.getState().isPlaying, ui.playRate, forceSeek);

    if (t !== ui.currentTime) useUi.setState({ currentTime: t });
    lastSet = t;
    wasPlaying = useUi.getState().isPlaying;
  };

  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    timelineEls.forEach(deactivate);
    if (sourceEl && !sourceEl.paused) sourceEl.pause();
  };
};

/** 音源トラックで再生中の要素からタイムライン時間を逆算 */
const findMaster = (p: Project): { time: number } | null => {
  for (const track of p.tracks) {
    if (track.kind !== 'audio' || track.muted) continue;
    const el = timelineEls.get(track.id);
    if (!el || el.paused || el.seeking || el.readyState < 3 || el.dataset.active !== '1') continue;
    const clipId = el.dataset.clipId;
    const clip = p.clips.find((c) => c.id === clipId);
    if (!clip) continue;
    const t = clip.start + (el.currentTime - clip.sourceIn) / clip.rate;
    // クリップの範囲外 (切り替わり直後など) は使わない
    if (t < clip.start - 0.05 || t > clip.start + clip.duration + 0.05) continue;
    return { time: t };
  }
  return null;
};

const syncAll = (p: Project, t: number, playing: boolean, playRate: number, forceSeek: boolean) => {
  // 単一表示用: 上にあるトラックが優先
  let visibleVideo: string | null = null;
  for (const track of p.tracks) {
    const el = timelineEls.get(track.id);
    if (!el) continue;
    const clip = activeClipAt(p.clips, track.id, t);
    if (!clip || !clip.assetId || !setSrc(el, clip.assetId)) {
      deactivate(el);
      continue;
    }
    if (track.kind === 'video' && !visibleVideo) visibleVideo = track.id;
    syncElement(el, clip, t, playing, playRate, forceSeek, track.kind === 'audio');
    el.muted = !!track.muted;
  }
  for (const [trackId, el] of timelineEls) {
    if (el instanceof HTMLVideoElement) el.dataset.primary = trackId === visibleVideo ? '1' : '0';
  }
};

const syncElement = (
  el: MediaEl,
  clip: Clip,
  t: number,
  playing: boolean,
  playRate: number,
  forceSeek: boolean,
  isAudio: boolean,
) => {
  const switched = el.dataset.clipId !== clip.id;
  el.dataset.clipId = clip.id;
  el.dataset.active = '1';
  const target = mediaTimeAt(clip, t);
  const rate = clamp(clip.rate * playRate, 0.0625, 16);
  if (el.readyState < 1) {
    if (Math.abs(el.playbackRate - rate) > 1e-3) el.playbackRate = rate;
    return; // メタデータ待ち
  }
  const signed = target - el.currentTime; // 正 = 映像が遅れている
  const drift = Math.abs(signed);
  // 小さなズレはシークせず、再生速度をわずかに上下させて滑らかに追いつかせる
  let want = rate;
  if (playing && !isAudio && !forceSeek && !switched && drift > 0.02 && drift <= DRIFT_PLAYING) {
    want = clamp(rate * (1 + clamp(signed * 0.8, -0.08, 0.08)), 0.0625, 16);
  }
  if (Math.abs(el.playbackRate - want) > 1e-3) el.playbackRate = want;
  if (playing) {
    if (forceSeek || switched || el.paused) {
      if (drift > 0.01) el.currentTime = target;
      if (el.paused) el.play().catch(() => {});
    } else if (!isAudio && drift > DRIFT_PLAYING && !el.seeking) {
      el.currentTime = target;
    } else if (isAudio && drift > 0.5 && !el.seeking) {
      // マスター以外の音声 (2本目の音源など) や大きなズレのみ補正
      el.currentTime = target;
    }
  } else {
    if (!el.paused) el.pause();
    if (drift > DRIFT_PAUSED && !el.seeking) el.currentTime = target;
  }
};

const runSource = (ui: ReturnType<typeof useUi.getState>) => {
  const el = sourceEl;
  const { source } = ui;
  if (!el || !source.assetId) return;
  if (!setSrc(el, source.assetId)) return;
  el.muted = false;
  if (Math.abs(el.playbackRate - ui.playRate) > 1e-3) el.playbackRate = ui.playRate;
  if (el.readyState < 1) return;
  const out = source.out > source.in ? source.out : el.duration || source.out;
  if (ui.isPlaying) {
    if (el.paused) {
      if (source.time >= out - 0.02 || source.time < source.in - 0.01) el.currentTime = source.in;
      else el.currentTime = source.time;
      el.play().catch(() => {});
    }
    let t = el.currentTime;
    if (t >= out) {
      if (ui.loop.on) {
        el.currentTime = source.in;
        t = source.in;
      } else {
        el.pause();
        t = out;
        useUi.setState({ isPlaying: false });
      }
    }
    if (t !== source.time) useUi.setState({ source: { ...useUi.getState().source, time: t } });
  } else {
    if (!el.paused) el.pause();
    if (Math.abs(el.currentTime - source.time) > DRIFT_PAUSED && !el.seeking) el.currentTime = source.time;
  }
};

const tickMetronome = (p: Project, prev: number, t: number) => {
  if (t <= prev) return;
  const b0 = Math.floor(timeToBeat(prev, p.bpm, p.beatOffset));
  const b1 = Math.floor(timeToBeat(t, p.bpm, p.beatOffset));
  if (b1 > b0 && t - prev < beatLength(p.bpm)) click(((b1 % 8) + 8) % 8 === 0);
};
