import React, { useEffect } from 'react';
import { useUi } from '../../store/uiStore';

export const Toast: React.FC = () => {
  const toast = useUi((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => useUi.setState({ toast: null }), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return (
    <div key={toast.id} className={`toast ${toast.tone}`} role="status">
      {toast.message}
    </div>
  );
};
