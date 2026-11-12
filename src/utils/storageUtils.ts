import localforage from 'localforage';

localforage.config({
  name: 'dance-app-media',
  storeName: 'assets'
});

export const saveAssetFile = async (id: string, file: File | Blob) => {
  await localforage.setItem(id, file);
};

export const getAssetFile = async (id: string): Promise<File | Blob | null> => {
  return await localforage.getItem<File | Blob>(id);
};

export const deleteAssetFile = async (id: string) => {
  await localforage.removeItem(id);
};
