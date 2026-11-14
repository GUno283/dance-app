import React from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import FormationSheet from './pages/FormationSheet';
import { ContextMenu } from './components/common/ContextMenu';
import { Toast } from './components/common/Toast';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// HashRouter: 静的ホスティング (GitHub Pages など) でもリロードで 404 にならない
const App: React.FC = () => (
  <ErrorBoundary>
    <HashRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/p/:projectId" element={<Editor />} />
        <Route path="/p/:projectId/sheet" element={<FormationSheet />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
    <ContextMenu />
    <Toast />
  </ErrorBoundary>
);

export default App;
