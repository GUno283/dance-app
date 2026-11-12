import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { v4 as uuidv4 } from 'uuid';

const MembersLibrary: React.FC = () => {
  const { editorData, addMember, updateMember, deleteMember, commitHistory } = useStore();
  const [newMemberName, setNewMemberName] = useState('');

  if (!editorData) return null;

  const handleAddMember = () => {
    if (!newMemberName.trim()) return;
    const id = `u${Date.now()}`;
    addMember({
      id,
      name: newMemberName,
      color: '#007AFF', // default color
      avatarUrl: `https://i.pravatar.cc/150?u=${id}` // placeholder avatar
    });
    setNewMemberName('');
    commitHistory();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, memberId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      updateMember(memberId, { avatarUrl: url });
      commitHistory();
    }
  };

  return (
    <div style={{ padding: '10px', color: '#fff', height: '100%', overflowY: 'auto', background: '#1E1E1E' }}>
      <div style={{ marginBottom: '15px' }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>メンバー管理</h3>
        <div style={{ display: 'flex', gap: '5px' }}>
          <input 
            value={newMemberName}
            onChange={e => setNewMemberName(e.target.value)}
            placeholder="新しいメンバー名..."
            style={{ flex: 1, padding: '5px', background: '#2C2C2E', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}
          />
          <button 
            onClick={handleAddMember}
            style={{ padding: '5px 10px', background: '#007AFF', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            追加
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {(editorData.members || []).map(member => (
          <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#2C2C2E', padding: '10px', borderRadius: '6px' }}>
            <label style={{ cursor: 'pointer', position: 'relative' }}>
              <input 
                type="file" 
                accept="image/*" 
                style={{ display: 'none' }} 
                onChange={(e) => handleFileChange(e, member.id)}
              />
              <img 
                src={member.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`} 
                alt={member.name}
                style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${member.color}` }}
              />
            </label>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <input 
                type="text" 
                value={member.name}
                onChange={(e) => {
                  updateMember(member.id, { name: e.target.value });
                }}
                onBlur={() => commitHistory()}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 'bold' }}
              />
              <div style={{ display: 'flex', gap: '5px' }}>
                <input 
                  type="color" 
                  value={member.color}
                  onChange={(e) => updateMember(member.id, { color: e.target.value })}
                  onBlur={() => commitHistory()}
                  style={{ width: '20px', height: '20px', padding: 0, border: 'none', cursor: 'pointer' }}
                  title="テーマカラー"
                />
              </div>
            </div>
            <button 
              onClick={() => {
                if (window.confirm(`${member.name} を削除しますか？\n(フォーメーションからも削除されます)`)) {
                  deleteMember(member.id);
                  commitHistory();
                }
              }}
              style={{ background: 'transparent', border: 'none', color: '#FF3B30', cursor: 'pointer', fontSize: '16px' }}
              title="削除"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MembersLibrary;
