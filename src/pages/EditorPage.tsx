import React, { useState } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Layout, Model, TabNode } from 'flexlayout-react';
import type { IJsonModel } from 'flexlayout-react';
import { useNavigate } from 'react-router-dom';
import MediaLibrary from '../components/editor/MediaLibrary';
import MembersLibrary from '../components/editor/MembersLibrary';
import VideoPreview from '../components/editor/VideoPreview';
import FormationPreview from '../components/editor/FormationPreview';
import InspectorPanel from '../components/editor/InspectorPanel';
import TimelinePanel from '../components/editor/TimelinePanel';
import 'flexlayout-react/style/dark.css';

const NavigationPanel: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <button 
        onClick={() => navigate('/dashboard')}
        style={{ padding: '10px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
      >
        <span>🏠</span> ダッシュボードに戻る
      </button>
      <div style={{ fontSize: '12px', color: '#888' }}>
        ※ このナビゲーションパネルも、ドラッグして好きな場所に移動・タブ化できます。
      </div>
    </div>
  );
};

const json: IJsonModel = {
  global: {
    tabEnableClose: false,
    rootOrientationVertical: true, // This makes the top-level row a vertical split (Top / Bottom)
  },
  borders: [
    {
      type: "border",
      location: "left",
      size: 200,
      children: [
        { type: "tab", name: "ナビ", component: "navigation" }
      ]
    }
  ],
  layout: {
    type: "row", // Since rootOrientationVertical is true, this row splits Top and Bottom
    weight: 100,
    children: [
      {
        type: "row", // This nested row splits Left to Right
        weight: 60,
        children: [
          { 
            type: "tabset", 
            weight: 15, 
            children: [
              { type: "tab", name: "メディア", component: "media" },
              { type: "tab", name: "メンバー", component: "members" }
            ] 
          },
          { type: "tabset", weight: 45, children: [{ type: "tab", name: "動画プレビュー", component: "video" }] },
          { type: "tabset", weight: 25, children: [{ type: "tab", name: "隊形プレビュー", component: "formation" }] },
          { type: "tabset", weight: 15, children: [{ type: "tab", name: "インスペクタ", component: "inspector" }] }
        ]
      },
      {
        type: "tabset",
        weight: 40,
        children: [{ type: "tab", name: "タイムライン", component: "timeline" }]
      }
    ]
  }
};

const EditorPage: React.FC = () => {
  const [model] = useState<Model>(Model.fromJson(json));

  const factory = (node: TabNode) => {
    const component = node.getComponent();
    switch (component) {
      case 'media': return <MediaLibrary />;
      case 'members': return <MembersLibrary />;
      case 'video': return <VideoPreview />;
      case 'formation': return <FormationPreview />;
      case 'inspector': return <InspectorPanel />;
      case 'timeline': return <TimelinePanel />;
      case 'navigation': return <NavigationPanel />;
      default: return <div>Not Found</div>;
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', width: '100%', position: 'relative' }}>
      <ErrorBoundary>
        <Layout model={model} factory={factory} />
      </ErrorBoundary>
    </div>
  );
};
export default EditorPage;
