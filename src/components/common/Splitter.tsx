import React, { useState } from 'react';

interface Props {
  dir: 'v' | 'h';
  /** ドラッグ量 (px) を受け取り、新しい値を返す */
  onDrag: (delta: number) => void;
  onEnd?: () => void;
}

/** パネル間のリサイズ用バー */
export const Splitter: React.FC<Props> = ({ dir, onDrag, onEnd }) => {
  const [dragging, setDragging] = useState(false);
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    let last = dir === 'v' ? e.clientX : e.clientY;
    const move = (ev: PointerEvent) => {
      const cur = dir === 'v' ? ev.clientX : ev.clientY;
      onDrag(cur - last);
      last = cur;
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onEnd?.();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return <div className={`splitter-${dir}${dragging ? ' dragging' : ''}`} onPointerDown={onPointerDown} />;
};
