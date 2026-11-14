import { beforeEach, describe, expect, it } from 'vitest';
import { useProject, actions } from '../store/projectStore';
import { newProject } from '../lib/factory';

beforeEach(() => useProject.getState().load(newProject('t')));

describe('undo / redo', () => {
  it('1 回目の Undo で直前の操作が戻る (旧版のバグ)', () => {
    actions.addMarker(1);
    actions.addMarker(2);
    expect(useProject.getState().project!.markers).toHaveLength(2);
    useProject.getState().undo();
    expect(useProject.getState().project!.markers).toHaveLength(1);
    useProject.getState().redo();
    expect(useProject.getState().project!.markers).toHaveLength(2);
  });
  it('ドラッグ中の変更は 1 回の履歴にまとまる', () => {
    const id = actions.addMarker(1)!;
    const s = useProject.getState();
    s.beginGesture();
    for (let i = 0; i < 10; i++) s.preview((d) => void (d.markers.find((m) => m.id === id)!.time = 1 + i));
    s.endGesture();
    expect(useProject.getState().project!.markers[0].time).toBe(10);
    useProject.getState().undo();
    expect(useProject.getState().project!.markers[0].time).toBe(1);
  });
  it('ドラッグのキャンセルで元に戻り、履歴は増えない', () => {
    const id = actions.addMarker(1)!;
    const before = useProject.getState().past.length;
    const s = useProject.getState();
    s.beginGesture();
    s.preview((d) => void (d.markers.find((m) => m.id === id)!.time = 5));
    s.cancelGesture();
    expect(useProject.getState().project!.markers[0].time).toBe(1);
    expect(useProject.getState().past.length).toBe(before);
  });
  it('同じ位置にマーカーを重ねない', () => {
    actions.addMarker(1);
    expect(actions.addMarker(1.01)).toBeNull();
  });
});
