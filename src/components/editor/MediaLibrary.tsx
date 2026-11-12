import React, { useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { v4 as uuidv4 } from 'uuid';
import type { Asset } from '../../types';
import { analyzeAudio } from '../../utils/audioUtils';
import { saveAssetFile, deleteAssetFile } from '../../utils/storageUtils';
import { generateVideoThumbnail } from '../../utils/videoUtils';

const MediaLibrary: React.FC = () => {
  const { editorData, selectedAssetId, setSelectedAssetId, deleteAsset, updateAsset, addAsset, commitHistory, setPreviewMode, setSourceAssetId, setSourceInPoint, setSourceOutPoint } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'date_desc' | 'date_asc' | 'name_desc' | 'name_asc'>('date_desc');
  const [activeTab, setActiveTab] = useState<'video' | 'audio' | 'image'>('video');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  if (!editorData) return <div style={{ color: '#fff', padding: '20px' }}>Loading...</div>;

  const processFile = async (file: File) => {
    let type = 'image';
    if (file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|mov)$/i)) type = 'video';
    else if (file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|m4a)$/i)) type = 'audio';
    else if (file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) type = 'image';
    
    const objectUrl = URL.createObjectURL(file);
    const assetId = `a-${uuidv4()}`;

    // Store in IndexedDB
    await saveAssetFile(assetId, file);
    
    let thumbnailUrl = undefined;
    if (type === 'video') {
      try {
        thumbnailUrl = await generateVideoThumbnail(objectUrl, 0.5);
      } catch (err) {
        console.warn('Could not generate thumbnail', err);
      }
    }

    const newAsset: Asset = {
      id: assetId,
      projectId: editorData.projectId,
      type: type as any,
      name: file.name,
      url: objectUrl,
      duration: 30,
      createdAt: Date.now(),
      thumbnailUrl
    };

    addAsset(newAsset);

    if (type === 'audio') {
      try {
        const analysis = await analyzeAudio(objectUrl);
        updateAsset(newAsset.id, {
          duration: analysis.duration,
          waveformData: analysis.waveform,
          peaks: analysis.peaks
        });
      } catch (err) {
        console.error('Audio analysis failed:', err);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      await processFile(file);
    }
    commitHistory();
    e.target.value = '';
  };

  const handleRootDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        await processFile(file);
      }
      commitHistory();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragStart = (e: React.DragEvent, asset: Asset) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'asset', assetId: asset.id }));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDelete = async (e: React.MouseEvent, assetId: string) => {
    e.stopPropagation();
    if (window.confirm('このファイルを削除しますか？\n※タイムラインで使用中のクリップも同時に削除されます。')) {
      deleteAsset(assetId);
      await deleteAssetFile(assetId); // Delete from DB
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(assetId);
        return next;
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`${selectedIds.size}個のファイルを一括削除しますか？\n※タイムラインで使用中のクリップも同時に削除されます。`)) {
      for (const id of Array.from(selectedIds)) {
        deleteAsset(id);
        await deleteAssetFile(id);
      }
      setSelectedIds(new Set());
    }
  };

  const toggleSelection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleDoubleClick = (asset: any) => {
    if (asset.type === 'video' || asset.type === 'audio') {
      setSourceAssetId(asset.id);
      setSourceInPoint(0);
      setSourceOutPoint(asset.duration || 10);
      setPreviewMode('source');
    }
  };

  const filteredAssets = editorData.assets.filter(a => a.type === activeTab && a.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const renderAsset = (asset: Asset) => {
    const isSelected = selectedAssetId === asset.id;
    return (
      <div 
        key={asset.id}
        onClick={() => setSelectedAssetId(asset.id)}
        onDoubleClick={() => handleDoubleClick(asset)}
        draggable
        onDragStart={(e) => handleDragStart(e, asset)}
        style={{
          padding: '8px',
          background: isSelected ? '#007AFF' : '#2C2C2E',
          borderRadius: '4px',
          marginBottom: '6px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: isSelected ? '0 0 0 2px #fff' : 'none',
          borderLeft: asset.colorLabel ? `4px solid ${asset.colorLabel}` : '4px solid transparent'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginRight: '5px' }}>
          <input 
            type="checkbox" 
            checked={selectedIds.has(asset.id)}
            onChange={() => {}} // handled by onClick wrapper
            onClick={(e) => toggleSelection(e, asset.id)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          {(asset.type === 'video' || asset.type === 'audio') && (
            <button 
              onClick={(e) => { e.stopPropagation(); handleDoubleClick(asset); }}
              style={{ background: '#444', border: 'none', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '4px', cursor: 'pointer', marginLeft: '8px' }}
              title="素材を編集 (ダブルクリックでも可)"
            >
              ✂️ 編集
            </button>
          )}
        </div>
        
        <div style={{ width: '40px', height: '40px', background: '#111', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {asset.thumbnailUrl ? (
            <img src={asset.thumbnailUrl} alt="thumb" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : asset.type === 'audio' ? (
            <span style={{ fontSize: '18px' }}>🎵</span>
          ) : asset.type === 'image' && asset.url ? (
            <img src={asset.url} alt="img" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '18px' }}>🎬</span>
          )}
        </div>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{asset.name}</div>
          <div style={{ fontSize: '10px', color: '#aaa' }}>{new Date(asset.createdAt || 0).toLocaleString()}</div>
        </div>
        
        <button
          onClick={(e) => handleDelete(e, asset.id)}
          style={{ background: 'transparent', border: 'none', color: '#FF3B30', cursor: 'pointer', padding: '4px', fontSize: '14px', flexShrink: 0 }}
          title="削除"
        >
          ×
        </button>
      </div>
    );
  };

  const renderSortedView = () => {
    let sorted = [...filteredAssets];
    if (sortOrder === 'date_desc') {
      sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } else if (sortOrder === 'date_asc') {
      sorted.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    } else if (sortOrder === 'name_desc') {
      sorted.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortOrder === 'name_asc') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    if (sorted.length === 0) {
      return <div style={{ fontSize: '12px', color: '#666', textAlign: 'center', marginTop: '20px' }}>見つかりませんでした</div>;
    }
    
    return <div>{sorted.map(a => renderAsset(a))}</div>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1C1C1E', color: '#fff' }}>
      <div style={{ padding: '15px 15px 5px 15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>Library</h3>
          <div style={{ display: 'flex', gap: '5px' }}>
            {selectedIds.size > 0 && (
              <button 
                onClick={handleBulkDelete}
                style={{ padding: '6px 12px', fontSize: '12px', background: '#FF3B30', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                選択を削除 ({selectedIds.size})
              </button>
            )}
            <button 
              onClick={() => fileInputRef.current?.click()}
              style={{ padding: '6px 12px', fontSize: '12px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ＋ 追加
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', borderBottom: '1px solid #333', paddingBottom: '5px' }}>
          {[
            { id: 'video', label: '動画' },
            { id: 'audio', label: '音声' },
            { id: 'image', label: '写真' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                flex: 1,
                padding: '6px',
                fontSize: '12px',
                background: activeTab === tab.id ? '#333' : 'transparent',
                color: activeTab === tab.id ? '#fff' : '#888',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: activeTab === tab.id ? 'bold' : 'normal'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        <input 
          type="file" 
          ref={fileInputRef} 
          multiple
          style={{ display: 'none' }} 
          accept="image/*,video/*,audio/*" 
          onChange={handleFileUpload} 
        />

        <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
          <input 
            type="text" 
            placeholder="🔍 検索..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flex: 1, minWidth: 0, padding: '6px', background: '#2C2C2E', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '12px' }}
          />
          <select 
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            style={{ minWidth: '100px', padding: '6px', background: '#2C2C2E', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '12px' }}
          >
            <option value="date_desc">更新順 (降順)</option>
            <option value="date_asc">更新順 (昇順)</option>
            <option value="name_desc">名前順 (降順 Z-A)</option>
            <option value="name_asc">名前順 (昇順 A-Z)</option>
          </select>
        </div>
      </div>

      <div 
        style={{ flex: 1, overflowY: 'auto', padding: '0 15px 15px 15px', minHeight: '100px' }}
        onDrop={handleRootDrop}
        onDragOver={handleDragOver}
      >
        {renderSortedView()}
      </div>
    </div>
  );
};
export default MediaLibrary;
