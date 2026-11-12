import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
// Pages
import DashboardPage from './pages/DashboardPage';
import EditorPage from './pages/EditorPage';
import ViewerPage from './pages/ViewerPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import ContextMenu from './components/ui/ContextMenu';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ContextMenu />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="projects/:projectId/editor" element={<EditorPage />} />
            <Route path="projects/:projectId/viewer" element={<ViewerPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
