import { useEffect } from 'react';
import { useProject } from '../store/projectStore';
import { useUi } from '../store/uiStore';
import { saveProject } from '../lib/persistence';

/** 変更から 600ms 後に IndexedDB へ自動保存。ドラッグ中は保存しない */
export const useAutosave = () => {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending = false;

    const flush = async () => {
      const { project, gestureBase } = useProject.getState();
      if (!project) return;
      if (gestureBase) {
        timer = setTimeout(flush, 300);
        return;
      }
      pending = false;
      try {
        await saveProject(project);
        if (!pending) useUi.setState({ saveStatus: 'saved' });
      } catch (e) {
        console.error(e);
        useUi.setState({ saveStatus: 'error' });
      }
    };

    const unsub = useProject.subscribe((s, prev) => {
      if (!s.project || s.project === prev.project || prev.project === null || s.project.id !== prev.project.id) return;
      pending = true;
      useUi.setState({ saveStatus: 'saving' });
      clearTimeout(timer);
      timer = setTimeout(flush, 600);
    });

    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (pending) {
        void flush();
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      unsub();
      clearTimeout(timer);
      window.removeEventListener('beforeunload', beforeUnload);
      if (pending) void flush();
    };
  }, []);
};
