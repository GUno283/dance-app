import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';

localforage.config({
  name: 'DanceApp',
  storeName: 'assets'
});

export const storageService = {
  saveAsset: async (file: File): Promise<{ id: string; url: string }> => {
    const id = uuidv4();
    await localforage.setItem(id, file);
    const url = URL.createObjectURL(file);
    return { id, url };
  },

  getAssetUrl: async (id: string): Promise<string | null> => {
    try {
      const file = await localforage.getItem<File>(id);
      if (file) {
        return URL.createObjectURL(file);
      }
      return null;
    } catch (e) {
      console.error("Failed to load asset", e);
      return null;
    }
  },

  deleteAsset: async (id: string): Promise<void> => {
    await localforage.removeItem(id);
  }
};
