import React from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';

const ViewerPage: React.FC = () => {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <ErrorBoundary>
        <div style={{ flex: 1, borderBottom: '1px solid #ccc' }}>Preview Area</div>
        <div style={{ height: '200px', padding: '20px' }}>Controls and Section Information</div>
      </ErrorBoundary>
    </div>
  );
};
export default ViewerPage;
