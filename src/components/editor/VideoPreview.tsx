import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { v4 as uuidv4 } from 'uuid';

const VideoPreview: React.FC = () => {
  const { 
    editorData, currentTime, isPlaying, setIsPlaying, duration, setCurrentTime,
    playbackRate, setPlaybackRate, isLooping, setIsLooping,
    previewMode, setPreviewMode, sourceAssetId, sourceInPoint, sourceOutPoint,
    setSourceInPoint, setSourceOutPoint, addClip, commitHistory, setSourceAssetId,
    selectedClipId, splitClip, copiedClip, setCopiedClip, deleteClip, undo, redo, updateClip
  } = useStore();
  
  const [sourceTime, setSourceTime] = useState(0);
  const reqRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  
  useEffect(() => {
    if (isNaN(currentTime) || typeof currentTime !== 'number') setCurrentTime(0);
  }, [currentTime, setCurrentTime]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const sourceVideoRef = useRef<HTMLVideoElement>(null);

  const sourceAsset = sourceAssetId ? editorData?.assets.find(a => a.id === sourceAssetId) : null;

  // Playback engine
  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      const loop = (time: number) => {
        const delta = (time - lastTimeRef.current) / 1000;
        lastTimeRef.current = time;
        const state = useStore.getState();
        const rate = state.playbackRate ?? 1.0;
        
        if (state.previewMode === 'timeline') {
          let curr = state.currentTime;
          if (isNaN(curr)) curr = 0;
          const newTime = curr + (delta * rate);
          if (newTime >= duration) {
            if (state.isLooping) {
              setCurrentTime(0);
              reqRef.current = requestAnimationFrame(loop);
            } else {
              setCurrentTime(duration);
              setIsPlaying(false);
            }
          } else {
            setCurrentTime(Math.max(0, newTime));
            reqRef.current = requestAnimationFrame(loop);
          }
        } else {
          setSourceTime(prev => {
            const next = prev + (delta * rate);
            const maxDuration = sourceAsset?.duration || 10;
            if (next >= maxDuration) {
              if (state.isLooping) {
                 reqRef.current = requestAnimationFrame(loop);
                 return 0;
              } else {
                 setIsPlaying(false);
                 return maxDuration;
              }
            }
            reqRef.current = requestAnimationFrame(loop);
            return next;
          });
        }
      };
      reqRef.current = requestAnimationFrame(loop);
    } else {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    }
    return () => { if (reqRef.current) cancelAnimationFrame(reqRef.current); };
  }, [isPlaying, duration, setCurrentTime, setIsPlaying, previewMode, sourceAsset]);

  // Frame Stepping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (useStore.getState().previewMode === 'timeline') {
          setCurrentTime(Math.min(duration, useStore.getState().currentTime + (1/30)));
        } else {
          setSourceTime(prev => Math.min(sourceAsset?.duration || 10, prev + (1/30)));
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (useStore.getState().previewMode === 'timeline') {
          setCurrentTime(Math.max(0, useStore.getState().currentTime - (1/30)));
        } else {
          setSourceTime(prev => Math.max(0, prev - (1/30)));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [duration, setCurrentTime, sourceAsset]);

  const videoTrack = editorData?.tracks.find(t => t.type === 'video');
  const activeVideoClip = videoTrack?.clips.find(c => c.startAt <= currentTime && c.startAt + c.duration > currentTime);
  const videoAsset = activeVideoClip ? editorData?.assets.find(a => a.id === activeVideoClip.assetId) : null;

  const audioTrack = editorData?.tracks.find(t => t.type === 'audio');
  const activeAudioClip = audioTrack?.clips.find(c => c.startAt <= currentTime && c.startAt + c.duration > currentTime);
  const audioAsset = activeAudioClip ? editorData?.assets.find(a => a.id === activeAudioClip.assetId) : null;

  // Sync Timeline Video
  useEffect(() => {
    if (previewMode !== 'timeline' || !videoRef.current || !activeVideoClip) return;
    const clipRate = activeVideoClip.playbackRate || 1.0;
    const targetRate = (playbackRate ?? 1.0) * clipRate;
    if (videoRef.current.playbackRate !== targetRate) videoRef.current.playbackRate = targetRate;
    
    let curr = currentTime;
    if (isNaN(curr)) curr = 0;
    
    const expectedMediaTime = (curr - activeVideoClip.startAt) * (activeVideoClip.playbackRate || 1.0) + (activeVideoClip.offsetInAsset || 0);
    
    if (!isNaN(expectedMediaTime)) {
      const drift = Math.abs(videoRef.current.currentTime - expectedMediaTime);
      if (drift > 0.5 || (!isPlaying && drift > 0.05)) {
        videoRef.current.currentTime = expectedMediaTime;
      }
    }
    if (isPlaying && videoRef.current.paused) videoRef.current.play().catch(e => console.warn(e));
    if (!isPlaying && !videoRef.current.paused) videoRef.current.pause();
  }, [currentTime, isPlaying, activeVideoClip, playbackRate, previewMode]);

  // Sync Timeline Audio
  useEffect(() => {
    if (previewMode !== 'timeline' || !audioRef.current || !activeAudioClip) return;
    const clipRate = activeAudioClip.playbackRate || 1.0;
    const targetRate = (playbackRate ?? 1.0) * clipRate;
    if (audioRef.current.playbackRate !== targetRate) audioRef.current.playbackRate = targetRate;
    
    let curr = currentTime;
    if (isNaN(curr)) curr = 0;
    
    const expectedMediaTime = (curr - activeAudioClip.startAt) * (activeAudioClip.playbackRate || 1.0) + (activeAudioClip.offsetInAsset || 0);
    
    if (!isNaN(expectedMediaTime)) {
      const drift = Math.abs(audioRef.current.currentTime - expectedMediaTime);
      if (drift > 0.5 || (!isPlaying && drift > 0.05)) {
        audioRef.current.currentTime = expectedMediaTime;
      }
    }
    if (isPlaying && audioRef.current.paused) audioRef.current.play().catch(e => console.warn(e));
    if (!isPlaying && !audioRef.current.paused) audioRef.current.pause();
  }, [currentTime, isPlaying, activeAudioClip, playbackRate, previewMode]);

  // Sync Source Video
  useEffect(() => {
    if (previewMode !== 'source' || !sourceVideoRef.current || !sourceAsset) return;
    const targetRate = playbackRate ?? 1.0;
    if (sourceVideoRef.current.playbackRate !== targetRate) sourceVideoRef.current.playbackRate = targetRate;
    
    if (!isNaN(sourceTime)) {
      const drift = Math.abs(sourceVideoRef.current.currentTime - sourceTime);
      if (drift > 0.5 || (!isPlaying && drift > 0.05)) {
        sourceVideoRef.current.currentTime = sourceTime;
      }
    }
    if (isPlaying && sourceVideoRef.current.paused) sourceVideoRef.current.play().catch(e => console.warn(e));
    if (!isPlaying && !sourceVideoRef.current.paused) sourceVideoRef.current.pause();
  }, [sourceTime, isPlaying, sourceAsset, playbackRate, previewMode]);

  const safeCurrentTime = isNaN(currentTime) ? 0 : currentTime;
  const displayTime = previewMode === 'timeline' ? safeCurrentTime : sourceTime;

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return '00:00.00';
    const m = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
    const s = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
    const ms = Math.floor((timeInSeconds % 1) * 100).toString().padStart(2, '0');
    return `${m}:${s}.${ms}`;
  };

  const displayDuration = previewMode === 'timeline' ? duration : (sourceAsset?.duration || 10);

  const handleAddToTimeline = () => {
    if (!sourceAsset) return;
    const track = editorData?.tracks.find(t => t.type === sourceAsset.type);
    if (!track) {
      alert(`${sourceAsset.type} トラックが見つかりません`);
      return;
    }
    
    const dur = Math.max(0.5, sourceOutPoint - sourceInPoint);
    const newClip = {
      id: `cl-${uuidv4()}`,
      trackId: track.id,
      assetId: sourceAsset.id,
      name: sourceAsset.name,
      startAt: safeCurrentTime,
      duration: dur,
      offsetInAsset: sourceInPoint,
      playbackRate: 1.0
    };
    
    addClip(track.id, newClip);
    commitHistory();
    setPreviewMode('timeline');
  };

  const handleUpdateClip = () => {
    if (!selectedClipId || !sourceAsset) return;
    const clip = editorData?.tracks.flatMap(t => t.clips).find(c => c.id === selectedClipId);
    if (!clip) return;
    
    const dur = Math.max(0.5, sourceOutPoint - sourceInPoint);
    updateClip(selectedClipId, {
      assetId: sourceAsset.id,
      name: sourceAsset.name,
      offsetInAsset: sourceInPoint,
      duration: dur / (clip.playbackRate || 1.0)
    });
    commitHistory();
    setPreviewMode('timeline');
  };

  const handleSplit = () => {
    if (selectedClipId) { splitClip(selectedClipId, currentTime); commitHistory(); }
  };
  const handleCopy = () => {
    if (selectedClipId && editorData) {
      for (const t of editorData.tracks) {
        const c = t.clips.find(clip => clip.id === selectedClipId);
        if (c) { setCopiedClip(c); break; }
      }
    }
  };
  const handlePaste = () => {
    if (copiedClip && editorData && editorData.tracks.length > 0) {
      addClip(copiedClip.trackId || editorData.tracks[0].id, { ...copiedClip, id: `clip_${Date.now()}`, startAt: currentTime });
      commitHistory();
    }
  };
  const handleDelete = () => {
    if (selectedClipId) { deleteClip(selectedClipId); commitHistory(); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#000', color: '#fff' }}>
      
      {/* Tabs */}
      <div style={{ display: 'flex', background: '#111', borderBottom: '1px solid #333' }}>
        <button 
          onClick={() => { setPreviewMode('timeline'); setIsPlaying(false); }}
          style={{ flex: 1, padding: '8px', background: previewMode === 'timeline' ? '#222' : 'transparent', color: previewMode === 'timeline' ? '#fff' : '#888', border: 'none', borderBottom: previewMode === 'timeline' ? '2px solid #007AFF' : 'none', cursor: 'pointer', fontWeight: 'bold' }}
        >
          タイムライン
        </button>
        <button 
          onClick={() => { 
            const state = useStore.getState();
            if (state.selectedClipId) {
              const clip = state.editorData?.tracks.flatMap(t => t.clips).find(c => c.id === state.selectedClipId);
              if (clip && clip.assetId) {
                setSourceAssetId(clip.assetId);
                setSourceInPoint(clip.offsetInAsset || 0);
                setSourceOutPoint((clip.offsetInAsset || 0) + clip.duration * (clip.playbackRate || 1.0));
              }
            }
            setPreviewMode('source'); 
            setIsPlaying(false); 
          }}
          style={{ flex: 1, padding: '8px', background: previewMode === 'source' ? '#222' : 'transparent', color: previewMode === 'source' ? '#fff' : '#888', border: 'none', borderBottom: previewMode === 'source' ? '2px solid #007AFF' : 'none', cursor: 'pointer', fontWeight: 'bold' }}
        >
          素材 (ソース)
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {previewMode === 'timeline' ? (
          <>
            {videoAsset ? (
              <video 
                ref={videoRef}
                src={videoAsset.url} 
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <p style={{ color: '#444' }}>No video at this time</p>
            )}
            {audioAsset && <audio ref={audioRef} src={audioAsset.url} />}
          </>
        ) : (
          <>
            {sourceAsset ? (
              sourceAsset.type === 'video' ? (
                <video 
                  ref={sourceVideoRef}
                  src={sourceAsset.url} 
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : sourceAsset.type === 'audio' ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                  <div style={{ fontSize: '48px' }}>🎵</div>
                  <div>{sourceAsset.name}</div>
                  <audio ref={sourceVideoRef} src={sourceAsset.url} />
                </div>
              ) : (
                <p style={{ color: '#444' }}>Cannot preview this asset type</p>
              )
            ) : (
              <p style={{ color: '#444' }}>メディアライブラリから動画をダブルクリックして表示</p>
            )}
            
            {/* Source In/Out visualization overlay */}
            {sourceAsset && (
              <div style={{ position: 'absolute', bottom: 10, left: 20, right: 20, height: '10px', background: 'rgba(255,255,255,0.3)' }}>
                <input 
                  type="range" 
                  min={0} max={sourceAsset.duration || 10} step="0.01"
                  value={sourceTime}
                  onChange={(e) => setSourceTime(parseFloat(e.target.value))}
                  style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10, margin: 0 }}
                />
                <div style={{ 
                  position: 'absolute', left: `${(sourceInPoint / (sourceAsset.duration || 10)) * 100}%`,
                  width: `${((sourceOutPoint - sourceInPoint) / (sourceAsset.duration || 10)) * 100}%`,
                  height: '100%', background: '#007AFF', pointerEvents: 'none'
                }} />
                <div style={{ 
                  position: 'absolute', left: `${(sourceTime / (sourceAsset.duration || 10)) * 100}%`, 
                  top: -5, bottom: -5, width: '2px', background: 'red', pointerEvents: 'none' 
                }} />
              </div>
            )}
          </>
        )}
      </div>
      
      <div style={{ padding: '10px', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '14px', width: '160px', textAlign: 'center', color: '#007AFF' }}>
          {formatTime(displayTime)} <span style={{ color: '#888' }}>/ {formatTime(displayDuration)}</span>
        </div>
        
        {previewMode === 'source' && (
          <button 
            onClick={() => setSourceInPoint(sourceTime)}
            style={{ padding: '4px 8px', background: '#444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            title="イン点を設定 ( { )"
          >
            &#123; In
          </button>
        )}

        <button 
          onClick={() => {
            const newVal = Math.max(0, displayTime - (1/30));
            if (previewMode === 'timeline') setCurrentTime(newVal); else setSourceTime(newVal);
          }} 
          style={{ padding: '4px 8px', background: '#444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          title="1コマ戻る"
        >
          &lt;I
        </button>
        
        <button 
          onClick={() => setIsPlaying(!isPlaying)} 
          style={{ padding: '8px 24px', background: isPlaying ? '#FF3B30' : '#34C759', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          title="再生/一時停止 (Space)"
        >
          {isPlaying ? 'PAUSE' : 'PLAY'}
        </button>

        <button 
          onClick={() => {
            if (previewMode === 'timeline') {
              setCurrentTime(Math.min(duration, displayTime + (1/30)));
            } else {
              setSourceTime(Math.min(sourceAsset?.duration || 10, displayTime + (1/30)));
            }
          }} 
          style={{ padding: '4px 8px', background: '#444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          title="1コマ進む"
        >
          I&gt;
        </button>

        {previewMode === 'source' && (
          <button 
            onClick={() => setSourceOutPoint(sourceTime)}
            style={{ padding: '4px 8px', background: '#444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            title="アウト点を設定 ( } )"
          >
            Out &#125;
          </button>
        )}
        
        <div style={{ width: '1px', height: '20px', background: '#444', margin: '0 5px' }} />

        {previewMode === 'source' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <button 
              onClick={handleAddToTimeline}
              disabled={!sourceAsset}
              style={{ padding: '4px 12px', background: sourceAsset ? '#007AFF' : '#555', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              新規追加
            </button>
            {selectedClipId && (
              <button 
                onClick={handleUpdateClip}
                style={{ padding: '4px 12px', background: '#34C759', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                選択中クリップを更新
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={() => setIsLooping(!isLooping)} style={{ padding: '4px 8px', background: isLooping ? '#007AFF' : '#444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>LOOP</button>
            <select value={playbackRate ?? 1.0} onChange={(e) => setPlaybackRate(parseFloat(e.target.value))} style={{ padding: '4px', background: '#444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
              <option value={0.5}>0.5x</option>
              <option value={1.0}>1.0x</option>
              <option value={1.5}>1.5x</option>
              <option value={2.0}>2.0x</option>
            </select>
          </div>
        )}
      </div>

      {/* Editing Toolbar */}
      <div style={{ display: 'flex', padding: '5px 10px', background: '#2C2C2E', borderTop: '1px solid #444', gap: '10px', justifyContent: 'center' }}>
        <button onClick={undo} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '14px' }} title="元に戻す (Ctrl+Z)">↩️ 戻る</button>
        <button onClick={redo} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '14px' }} title="やり直す (Ctrl+Shift+Z)">↪️ やり直し</button>
        <div style={{ width: '1px', background: '#555', margin: '0 5px' }} />
        <button onClick={handleSplit} disabled={!selectedClipId} style={{ background: 'transparent', border: 'none', color: selectedClipId ? '#fff' : '#555', cursor: selectedClipId ? 'pointer' : 'default', fontSize: '14px' }} title="分割">✂️ 分割</button>
        <button onClick={handleCopy} disabled={!selectedClipId} style={{ background: 'transparent', border: 'none', color: selectedClipId ? '#fff' : '#555', cursor: selectedClipId ? 'pointer' : 'default', fontSize: '14px' }} title="コピー">📋 コピー</button>
        <button onClick={handlePaste} disabled={!copiedClip} style={{ background: 'transparent', border: 'none', color: copiedClip ? '#fff' : '#555', cursor: copiedClip ? 'pointer' : 'default', fontSize: '14px' }} title="ペースト">📥 ペースト</button>
        <button onClick={handleDelete} disabled={!selectedClipId} style={{ background: 'transparent', border: 'none', color: selectedClipId ? '#FF3B30' : '#555', cursor: selectedClipId ? 'pointer' : 'default', fontSize: '14px' }} title="削除">🗑️ 削除</button>
      </div>

    </div>
  );
};
export default VideoPreview;
