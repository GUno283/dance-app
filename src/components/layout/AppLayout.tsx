import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { FiHome, FiMusic, FiCalendar, FiBell, FiUser, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useStore } from '../../store/useStore';
import type { UserRole } from '../../types';
import { getAssetFile } from '../../utils/storageUtils';
import styles from './AppLayout.module.css';

const AppLayout: React.FC = () => {
  const { currentUserRole, setCurrentUserRole } = useStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const isEditor = location.pathname.includes('/editor');

  React.useEffect(() => {
    const hydrateAssets = async () => {
      const state = useStore.getState();
      if (!state.editorData) return;

      const updatedAssets = await Promise.all(
        state.editorData.assets.map(async (asset) => {
          if (asset.type === 'formation') return asset;
          try {
            const file = await getAssetFile(asset.id);
            if (file) {
              const url = URL.createObjectURL(file as File);
              return { ...asset, url };
            }
          } catch (err) {
            console.error('Failed to load asset from storage:', err);
          }
          return asset;
        })
      );
      
      useStore.getState().setEditorData({
        ...state.editorData,
        assets: updatedAssets
      });
    };

    hydrateAssets();
  }, []);

  return (
    <div className={styles.appContainer}>
      {!isEditor && (
        <nav className={`${styles.sidebar} ${isSidebarOpen ? '' : styles.collapsed}`}>
          <div className={styles.logoContainer}>
            <div className={styles.logo}>{isSidebarOpen ? 'DanceApp' : 'D'}</div>
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
            >
              {isSidebarOpen ? <FiChevronLeft size={20}/> : <FiChevronRight size={20}/>}
            </button>
          </div>
          <ul className={styles.navList}>
            <li>
              <NavLink to="/dashboard" className={({isActive}) => isActive ? styles.active : ''}>
                <FiHome size={20} title="Dashboard" /> {isSidebarOpen && <span>Dashboard</span>}
              </NavLink>
            </li>
            <li>
              <NavLink 
                to={`/projects/p1/${currentUserRole === 'admin' || currentUserRole === 'leader' ? 'editor' : 'viewer'}`} 
                className={({isActive}) => isActive ? styles.active : ''}
              >
                <FiMusic size={20} title="Workspace" /> {isSidebarOpen && <span>Workspace</span>}
              </NavLink>
            </li>
          </ul>
        </nav>
      )}
      <div className={styles.mainWrapper}>
        <header className={styles.topbar}>
          <div className={styles.roleSwitcher}>
            <span className={styles.roleLabel}>表示権限: </span>
            <select 
              value={currentUserRole} 
              onChange={(e) => setCurrentUserRole(e.target.value as UserRole)}
              className={styles.roleSelect}
            >
              <option value="admin">管理者 (全機能)</option>
              <option value="leader">リーダー (作品編集)</option>
              <option value="member">一般メンバー (閲覧のみ)</option>
            </select>
          </div>
        </header>
        <main className={styles.mainContent}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
