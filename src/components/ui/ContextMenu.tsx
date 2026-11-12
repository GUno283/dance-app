import React, { useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';

const ContextMenu: React.FC = () => {
  const { contextMenu, setContextMenu } = useStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    
    // Global esc listener
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };

    if (contextMenu) {
      window.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu, setContextMenu]);

  if (!contextMenu) return null;

  // 画面端で見切れないように調整
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${Math.min(contextMenu.x, window.innerWidth - 200)}px`,
    top: `${Math.min(contextMenu.y, window.innerHeight - 200)}px`,
    width: '200px',
    backgroundColor: '#2C2C2E',
    border: '1px solid #444',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    zIndex: 9999,
    padding: '4px 0',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'sans-serif'
  };

  return (
    <div ref={menuRef} style={menuStyle}>
      {contextMenu.options.map((opt, i) => (
        <button
          key={i}
          onClick={(e) => {
            e.stopPropagation();
            opt.onClick();
            setContextMenu(null);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: opt.color || '#FFF',
            padding: '10px 15px',
            textAlign: 'left',
            cursor: 'pointer',
            fontSize: '13px',
            width: '100%',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#007AFF'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

export default ContextMenu;
