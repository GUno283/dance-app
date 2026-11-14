import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useUi } from '../../store/uiStore';

export const ContextMenu: React.FC = () => {
  const menu = useUi((s) => s.contextMenu);
  const set = useUi((s) => s.set);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({
      x: Math.min(menu.x, window.innerWidth - r.width - 8),
      y: Math.min(menu.y, window.innerHeight - r.height - 8),
    });
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return;
      set({ contextMenu: null });
    };
    const t = setTimeout(() => {
      window.addEventListener('pointerdown', close);
      window.addEventListener('blur', close);
      window.addEventListener('resize', close);
    });
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
    };
  }, [menu, set]);

  if (!menu) return null;
  return (
    <div className="ctx-menu" ref={ref} style={{ left: pos.x, top: pos.y }} onContextMenu={(e) => e.preventDefault()}>
      {menu.items.map((it, i) =>
        it === 'sep' ? (
          <div key={i} className="ctx-sep" />
        ) : (
          <button
            key={i}
            className={`ctx-item${it.danger ? ' danger' : ''}`}
            disabled={it.disabled}
            onClick={() => {
              set({ contextMenu: null });
              it.onClick();
            }}
          >
            {it.label}
            {it.shortcut && <span className="sc">{it.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
};
