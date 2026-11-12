import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import type { FormationPosition, Member } from '../../types';

const FormationEditor: React.FC<{ assetId: string, positions: FormationPosition[] }> = ({ assetId, positions }) => {
  const { editorData, setEditorData, nameFontSize, setNameFontSize, commitHistory, copiedFormation, setCopiedFormation } = useStore();
  const [draggingUserId, setDraggingUserId] = useState<string | null>(null);

  if (!editorData) return null;

  const handlePointerDown = (userId: string) => {
    setDraggingUserId(userId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingUserId || !editorData) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const newAssets = editorData.assets.map(a => {
      if (a.id === assetId && a.formationData) {
        return {
          ...a,
          formationData: {
            ...a.formationData,
            positions: a.formationData.positions.map(p => 
              p.userId === draggingUserId ? { ...p, x, y } : p
            )
          }
        };
      }
      return a;
    });

    setEditorData({ ...editorData, assets: newAssets });
  };

  const handlePointerUp = () => {
    if (draggingUserId) {
      commitHistory();
      setDraggingUserId(null);
    }
  };

  const toggleMember = (member: Member) => {
    const isIncluded = positions.some(p => p.userId === member.id);
    const newAssets = editorData.assets.map(a => {
      if (a.id === assetId && a.formationData) {
        const newPositions = isIncluded 
          ? a.formationData.positions.filter(p => p.userId !== member.id)
          : [...a.formationData.positions, { userId: member.id, x: 0.5, y: 0.5 }];
        return { ...a, formationData: { ...a.formationData, positions: newPositions } };
      }
      return a;
    });
    setEditorData({ ...editorData, assets: newAssets });
    commitHistory();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div 
        style={{ width: '100%', aspectRatio: '16/9', background: '#222', position: 'relative', border: '1px solid #555', touchAction: 'none', overflow: 'hidden' }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Center lines */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '1px', background: '#444' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: '1px', background: '#444' }} />
        
        {positions.map(pos => {
          const member = (editorData.members || []).find(m => m.id === pos.userId);
          if (!member) return null;
          
          return (
            <div
              key={pos.userId}
              onPointerDown={() => handlePointerDown(pos.userId)}
              style={{
                position: 'absolute',
                left: `${pos.x * 100}%`,
                top: `${pos.y * 100}%`,
                transform: 'translate(-50%, -50%)',
                cursor: 'grab',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                zIndex: draggingUserId === pos.userId ? 100 : 10
              }}
            >
              <img 
                src={member.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`} 
                alt={member.name}
                style={{ 
                  width: '30px', 
                  height: '30px', 
                  borderRadius: '50%', 
                  objectFit: 'cover', 
                  border: `2px solid ${member.color}`,
                  boxShadow: draggingUserId === pos.userId ? `0 0 10px ${member.color}` : '0 2px 4px rgba(0,0,0,0.5)',
                  pointerEvents: 'none'
                }}
              />
              <div style={{ 
                marginTop: '2px', 
                fontSize: `${nameFontSize}px`, 
                color: '#fff', 
                textShadow: '1px 1px 2px #000',
                pointerEvents: 'none',
                whiteSpace: 'nowrap'
              }}>
                {member.name}
              </div>
            </div>
          );
        })}
      </div>

      {/* Font Size Control */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <label style={{ fontSize: '12px', color: '#888' }}>名前サイズ:</label>
        <input 
          type="range" 
          min="8" max="24" 
          value={nameFontSize} 
          onChange={(e) => setNameFontSize(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ fontSize: '12px', width: '20px' }}>{nameFontSize}</span>
      </div>

      {/* Member Selection */}
      <div style={{ marginTop: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
          <label style={{ fontSize: '12px', color: '#888' }}>配置するメンバー</label>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button 
              onClick={() => setCopiedFormation(positions)}
              style={{ padding: '2px 8px', fontSize: '10px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}
            >
              コピー
            </button>
            <button 
              onClick={() => {
                if (!copiedFormation) return;
                const newAssets = editorData.assets.map(a => {
                  if (a.id === assetId && a.formationData) {
                    return { ...a, formationData: { ...a.formationData, positions: copiedFormation } };
                  }
                  return a;
                });
                setEditorData({ ...editorData, assets: newAssets });
                commitHistory();
              }}
              disabled={!copiedFormation}
              style={{ padding: '2px 8px', fontSize: '10px', background: copiedFormation ? '#007AFF' : '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: copiedFormation ? 'pointer' : 'not-allowed', opacity: copiedFormation ? 1 : 0.5 }}
            >
              ペースト
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {(editorData.members || []).map(member => {
            const isIncluded = positions.some(p => p.userId === member.id);
            return (
              <button
                key={member.id}
                onClick={() => toggleMember(member)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '15px',
                  border: `1px solid ${isIncluded ? member.color : '#444'}`,
                  background: isIncluded ? `${member.color}33` : '#222',
                  color: isIncluded ? '#fff' : '#888',
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <img 
                  src={member.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`} 
                  style={{ width: '16px', height: '16px', borderRadius: '50%', filter: isIncluded ? 'none' : 'grayscale(100%)' }}
                />
                {member.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const InspectorPanel: React.FC = () => {
  const { editorData, selectedAssetId, selectedClipId, updateClip, updateAsset, commitHistory } = useStore();

  const selectedAsset = editorData?.assets.find(a => a.id === selectedAssetId);
  const selectedClip = editorData?.tracks.flatMap(t => t.clips).find(c => c.id === selectedClipId);

  // If a clip is selected and it's a formation clip, we should allow editing the asset too
  const effectiveAsset = selectedAsset || (selectedClip?.assetId ? editorData?.assets.find(a => a.id === selectedClip.assetId) : null);

  return (
    <div style={{ padding: '15px', height: '100%', overflowY: 'auto' }}>
      <h3 style={{ marginBottom: '15px', fontSize: '14px', borderBottom: '1px solid #444', paddingBottom: '10px' }}>インスペクタ</h3>
      
      {!selectedAsset && !selectedClip && (
        <p style={{ fontSize: '12px', color: '#666' }}>クリップまたはアセットを選択してください</p>
      )}

      {selectedClip && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '5px' }}>クリップ名</label>
            <input 
              type="text" 
              value={selectedClip.name} 
              onChange={e => updateClip(selectedClip.id, { name: e.target.value })}
              onBlur={() => commitHistory()}
              style={{ width: '100%', padding: '5px', background: '#333', color: '#fff', border: '1px solid #555' }} 
            />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '5px' }}>開始 (秒)</label>
              <input type="number" value={selectedClip.startAt.toFixed(2)} readOnly style={{ width: '100%', padding: '5px', background: '#333', color: '#fff', border: '1px solid #555' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '5px' }}>長さ (秒)</label>
              <input type="number" value={selectedClip.duration.toFixed(2)} readOnly style={{ width: '100%', padding: '5px', background: '#333', color: '#fff', border: '1px solid #555' }} />
            </div>
          </div>
          <div style={{ marginBottom: '10px', marginTop: '10px' }}>
            <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '5px' }}>表示色</label>
            <input 
              type="color" 
              value={selectedClip.color || '#007AFF'} 
              onChange={e => updateClip(selectedClip.id, { color: e.target.value })}
              onBlur={() => commitHistory()}
              style={{ width: '100%', height: '30px', padding: '0', border: 'none', cursor: 'pointer' }} 
            />
          </div>
          
          {(selectedClip.textData !== undefined || !selectedClip.assetId) && (
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '5px' }}>メモ (テキスト)</label>
              <textarea 
                value={selectedClip.textData || ''}
                onChange={e => updateClip(selectedClip.id, { textData: e.target.value })}
                onBlur={() => commitHistory()}
                style={{ width: '100%', padding: '5px', background: '#333', color: '#fff', border: '1px solid #555', height: '60px', resize: 'vertical' }}
              />
            </div>
          )}
        </div>
      )}

      {effectiveAsset && (
        <div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '5px' }}>参照アセット名</label>
            <input 
              type="text" 
              value={effectiveAsset.name} 
              onChange={e => updateAsset(effectiveAsset.id, { name: e.target.value })}
              onBlur={() => commitHistory()}
              style={{ width: '100%', padding: '5px', background: '#333', color: '#fff', border: '1px solid #555' }} 
            />
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '5px' }}>アセットラベルカラー</label>
            <input 
              type="color" 
              value={effectiveAsset.colorLabel || '#888888'} 
              onChange={e => updateAsset(effectiveAsset.id, { colorLabel: e.target.value })}
              onBlur={() => commitHistory()}
              style={{ width: '100%', height: '30px', padding: '0', border: 'none', cursor: 'pointer' }} 
            />
          </div>
          
          {effectiveAsset.type === 'formation' && effectiveAsset.formationData && (
            <div style={{ background: '#1A1A1A', padding: '10px', borderRadius: '8px', border: '1px solid #333' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#fff', marginBottom: '10px', fontWeight: 'bold' }}>
                隊形エディタ
              </label>
              <FormationEditor assetId={effectiveAsset.id} positions={effectiveAsset.formationData.positions} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default InspectorPanel;
