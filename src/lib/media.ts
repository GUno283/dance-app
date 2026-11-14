import localforage from 'localforage';
import { create } from 'zustand';

/** メディア本体 (Blob) は IndexedDB に保存し、実行時に ObjectURL を作る。
 *  ObjectURL はリロードで無効になるので、プロジェクトには保存しない。 */
const blobStore = localforage.createInstance({ name: 'dance-studio', storeName: 'media' });

interface MediaUrlState {
  urls: Record<string, string>;
  missing: Record<string, true>;
}

export const useMediaUrls = create<MediaUrlState>(() => ({ urls: {}, missing: {} }));

export const getMediaUrl = (assetId: string): string | undefined => useMediaUrls.getState().urls[assetId];

const setUrl = (assetId: string, blob: Blob) => {
  const prev = useMediaUrls.getState().urls[assetId];
  if (prev) URL.revokeObjectURL(prev);
  const url = URL.createObjectURL(blob);
  useMediaUrls.setState((s) => {
    const missing = { ...s.missing };
    delete missing[assetId];
    return { urls: { ...s.urls, [assetId]: url }, missing };
  });
  return url;
};

export const putMedia = async (assetId: string, blob: Blob): Promise<string> => {
  await blobStore.setItem(assetId, blob);
  return setUrl(assetId, blob);
};

export const getMediaBlob = (assetId: string): Promise<Blob | null> => blobStore.getItem<Blob>(assetId);

export const deleteMedia = async (assetId: string): Promise<void> => {
  const prev = useMediaUrls.getState().urls[assetId];
  if (prev) URL.revokeObjectURL(prev);
  useMediaUrls.setState((s) => {
    const urls = { ...s.urls };
    delete urls[assetId];
    return { urls };
  });
  await blobStore.removeItem(assetId);
};

/** プロジェクトを開いたときに、必要なメディアの ObjectURL を用意する */
export const loadMediaUrls = async (assetIds: string[]): Promise<void> => {
  const missing: Record<string, true> = {};
  await Promise.all(
    assetIds.map(async (id) => {
      if (useMediaUrls.getState().urls[id]) return;
      try {
        const blob = await blobStore.getItem<Blob>(id);
        if (blob) setUrl(id, blob);
        else missing[id] = true;
      } catch {
        missing[id] = true;
      }
    }),
  );
  useMediaUrls.setState((s) => ({ missing: { ...s.missing, ...missing } }));
};

// ---------------- メディア情報の取得 ----------------

export const detectKind = (file: File): 'audio' | 'video' | null => {
  if (file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv)$/i.test(file.name)) return 'video';
  if (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)) return 'audio';
  return null;
};

export const probeVideo = (url: string): Promise<{ duration: number; thumbnail?: string }> =>
  new Promise((resolve) => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.src = url;
    let duration = 0;
    const done = (thumbnail?: string) => {
      v.removeAttribute('src');
      v.load();
      resolve({ duration, thumbnail });
    };
    v.onloadedmetadata = () => {
      duration = Number.isFinite(v.duration) ? v.duration : 0;
      v.currentTime = Math.min(1, duration / 3);
    };
    v.onseeked = () => {
      try {
        const w = 160;
        const h = Math.round((w * (v.videoHeight || 9)) / (v.videoWidth || 16));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d')?.drawImage(v, 0, 0, w, h);
        done(c.toDataURL('image/jpeg', 0.6));
      } catch {
        done();
      }
    };
    v.onerror = () => done();
    setTimeout(() => done(), 8000);
  });

export const probeAudioDuration = (url: string): Promise<number> =>
  new Promise((resolve) => {
    const a = document.createElement('audio');
    a.preload = 'metadata';
    a.src = url;
    a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? a.duration : 0);
    a.onerror = () => resolve(0);
  });
