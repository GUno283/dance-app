import React, { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import type { ContextMenuOption } from '../../store/useStore';
import type { Track, Clip } from '../../types';
import { v4 as uuidv4 } from 'uuid';

const TimelineClip: React.FC<{ clip: Clip; track: Track }> = ({ clip, track }) => {
  const { updateClip, selectedClipId, setSelectedClipId, pixelsPerSecond, commitHistory, editorData, setContextMenu, deleteClip, setCopiedClip, splitClip, rippleDeleteClip } = useStore();
  const isSelected = selectedClipId === clip.id;

  const asset = editorData?.assets.find(a => a.id === clip.assetId);
  const waveformData = asset?.waveformData;
  const peaks = asset?.peaks || [];

  const handlePointerDown = (e: React.PointerEvent, dragType: 'move' | 'left' | 'right') => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedClipId(clip.id);

    const startX = e.clientX;
    const initialStartAt = clip.startAt;
    const initialDuration = clip.duration;
    let didMove = false;
    
    // Snapping boundaries
    const snapPoints = editorData?.tracks.flatMap(t => 
      t.clips.flatMap(c => c.id !== clip.id ? [c.startAt, c.startAt + c.duration] : [])
    ) || [];
    snapPoints.push(useStore.getState().currentTime); // Snap to playhead
    
    // Add Audio Peaks to snap points (adjusted by clip start offset)
    if (asset?.type === 'audio') {
      const offset = clip.offsetInAsset || 0;
      peaks.forEach(p => {
        const timeInTimeline = clip.startAt + (p - offset);
        if (timeInTimeline >= clip.startAt && timeInTimeline <= clip.startAt + clip.duration) {
          snapPoints.push(timeInTimeline);
        }
      });
    }

    const handlePointerMove = (moveEvent: PointerEvent) => {
      didMove = true;
      const deltaX = moveEvent.clientX - startX;
      let deltaTime = deltaX / useStore.getState().pixelsPerSecond;

      const applySnap = (time: number) => {
        const threshold = 10 / useStore.getState().pixelsPerSecond; // 10px snap threshold
        let closestSnap = time;
        let minDiff = threshold;
        for (const snap of snapPoints) {
          const diff = Math.abs(time - snap);
          if (diff < minDiff) {
            minDiff = diff;
            closestSnap = snap;
          }
        }
        return closestSnap;
      };

      if (dragType === 'move') {
        const rawNewStartAt = Math.max(0, initialStartAt + deltaTime);
        const snappedStartAt = applySnap(rawNewStartAt);
        updateClip(clip.id, { startAt: snappedStartAt });
      } else if (dragType === 'left') {
        const rawNewStartAt = Math.max(0, Math.min(initialStartAt + deltaTime, initialStartAt + initialDuration - 0.5));
        const snappedStartAt = applySnap(rawNewStartAt);
        const timeDiff = snappedStartAt - initialStartAt;
        const newDuration = Math.max(0.5, initialDuration - timeDiff);
        
        if (moveEvent.altKey) {
           const newRate = (initialDuration * (clip.playbackRate || 1.0)) / newDuration;
           updateClip(clip.id, { startAt: snappedStartAt, duration: newDuration, playbackRate: newRate });
        } else {
           const initialOffset = clip.offsetInAsset || 0;
           updateClip(clip.id, { 
             startAt: snappedStartAt, 
             duration: newDuration,
             offsetInAsset: initialOffset + timeDiff
           });
        }
      } else if (dragType === 'right') {
        const rawEnd = initialStartAt + initialDuration + deltaTime;
        const snappedEnd = applySnap(rawEnd);
        const newDuration = Math.max(0.5, snappedEnd - initialStartAt);
        
        if (moveEvent.altKey) {
           const newRate = (initialDuration * (clip.playbackRate || 1.0)) / newDuration;
           updateClip(clip.id, { duration: newDuration, playbackRate: newRate });
        } else {
           updateClip(clip.id, { duration: newDuration });
        }
      }
    };

    const handlePointerUp = () => {
      if (didMove) commitHistory();
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedClipId(clip.id);
    
    const options: ContextMenuOption[] = [
      { label: 'コピー (Copy)', onClick: () => setCopiedClip(clip) },
      { label: 'カット (Cut)', onClick: () => { setCopiedClip(clip); deleteClip(clip.id); commitHistory(); } },
      { label: '削除 (Delete)', onClick: () => { deleteClip(clip.id); commitHistory(); } },
      { label: '再生ヘッドで分割 (Split)', onClick: () => { splitClip(clip.id, useStore.getState().currentTime); commitHistory(); } }
    ];

    const markerTrack = editorData?.tracks.find(t => t.type === 'marker');
    if (markerTrack && markerTrack.clips.length > 0) {
      options.push({
        label: '前後のマーカーに合わせる (Fit to Markers)',
        onClick: () => {
          const markers = [...markerTrack.clips].sort((a, b) => a.startAt - b.startAt);
          const before = markers.slice().reverse().find(m => m.startAt <= clip.startAt + 0.1);
          const after = markers.find(m => m.startAt > clip.startAt + 0.1);
          if (before && after) {
             const newDur = after.startAt - before.startAt;
             const newRate = (clip.duration * (clip.playbackRate || 1.0)) / newDur;
             updateClip(clip.id, { startAt: before.startAt, duration: newDur, playbackRate: newRate });
             commitHistory();
          } else {
             alert("クリップを挟むように前後にマーカーを配置してください。");
          }
        }
      });
    }

    options.push({ label: 'リップル削除 (Ripple Delete)', color: '#FF3B30', onClick: () => { rippleDeleteClip(clip.id); commitHistory(); } });

    setContextMenu({ x: e.clientX, y: e.clientY, options });
  };

  // Render Waveform SVG
  const renderWaveform = () => {
    if (!waveformData || waveformData.length === 0) return null;
    const points = waveformData.length;
    // Map waveform points to SVG coordinates
    // We want to draw it as a filled polygon centered vertically
    const width = clip.duration * pixelsPerSecond;
    // We only draw the portion of the waveform that corresponds to the clip's offset and duration
    const assetDuration = asset?.duration || 1;
    const startIndex = Math.floor(((clip.offsetInAsset || 0) / assetDuration) * points);
    const endIndex = Math.floor((((clip.offsetInAsset || 0) + clip.duration) / assetDuration) * points);
    
    const slice = waveformData.slice(startIndex, endIndex);
    if (slice.length === 0) return null;

    const stepX = width / slice.length;
    const height = 40; // max height of waveform
    const midY = 20;

    const topPoints = slice.map((val, i) => `${i * stepX},${midY - (val * midY)}`).join(' ');
    const bottomPoints = slice.slice().reverse().map((val, i) => `${(slice.length - 1 - i) * stepX},${midY + (val * midY)}`).join(' ');
    
    const svgPath = `${topPoints} ${bottomPoints}`;

    return (
      <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, opacity: 0.5, pointerEvents: 'none' }} preserveAspectRatio="none">
        <polygon points={svgPath} fill="#000" />
      </svg>
    );
  };

  return (
    <div 
      onPointerDown={(e) => handlePointerDown(e, 'move')}
      onContextMenu={handleContextMenu}
      style={{
        position: 'absolute',
        left: `${clip.startAt * pixelsPerSecond}px`,
        width: `${clip.duration * pixelsPerSecond}px`,
        height: '80%',
        top: '10%',
        backgroundColor: clip.color || '#007AFF',
        borderRadius: '4px',
        padding: '2px 5px',
        fontSize: '12px',
        color: '#fff',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        cursor: 'grab',
        boxShadow: isSelected ? '0 0 0 2px #FFF' : '0 1px 3px rgba(0,0,0,0.3)',
        userSelect: 'none',
        touchAction: 'none'
      }}
    >
      {renderWaveform()}
      <div style={{ position: 'relative', zIndex: 5, pointerEvents: 'none' }}>{clip.name}</div>
      
      <div 
        onPointerDown={(e) => handlePointerDown(e, 'left')}
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: '8px',
          cursor: 'col-resize', background: isSelected ? 'rgba(255,255,255,0.3)' : 'transparent', zIndex: 10
        }} 
      />
      <div 
        onPointerDown={(e) => handlePointerDown(e, 'right')}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: '8px',
          cursor: 'col-resize', background: isSelected ? 'rgba(255,255,255,0.3)' : 'transparent', zIndex: 10
        }} 
      />
    </div>
  );
};

const TimelineTrack: React.FC<{ track: Track }> = ({ track }) => {
  const { addClip, addTrack, editorData, commitHistory, copiedClip, setContextMenu, pixelsPerSecond } = useStore();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) return;
    const data = JSON.parse(dataStr);

    if (data.type === 'asset' && editorData) {
      const asset = editorData.assets.find(a => a.id === data.assetId);
      if (asset) {
        const rect = e.currentTarget.getBoundingClientRect();
        // Adjust for panel scroll in parent if necessary, but here we can just use offset
        const dropX = e.clientX - rect.left; 
        
        // As requested by user: added clips should start at currentTime (red bar), and duration should match asset
        const state = useStore.getState();
        const startAt = state.currentTime;
        const duration = asset.duration || (asset.type === 'formation' ? 5 : 10);

        const newClip: Clip = {
          id: `clip_${Date.now()}`,
          trackId: track.id,
          assetId: asset.id,
          name: asset.name,
          startAt: startAt,
          duration: duration,
          color: asset.type === 'formation' ? '#4CD964' : (asset.type === 'audio' ? '#FF9500' : '#007AFF')
        };
        addClip(track.id, newClip);
        commitHistory();
      }
    }
  };

  const handleTrackContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickTime = (e.clientX - rect.left) / pixelsPerSecond;
    
    const options: ContextMenuOption[] = [];
    if (copiedClip) {
      options.push({
        label: 'ここにペースト (Paste)',
        onClick: () => {
          const newClip = { ...copiedClip, id: `cl-${uuidv4()}`, trackId: track.id, startAt: clickTime };
          addClip(track.id, newClip);
          commitHistory();
        }
      });
    }
    options.push({
      label: 'マーカーを追加 (Add Marker)',
      onClick: () => {
        let markerTrackId = editorData?.tracks.find(t => t.type === 'marker')?.id;
        if (!markerTrackId) {
          markerTrackId = `tr-marker-${uuidv4()}`;
          addTrack({
            id: markerTrackId,
            projectId: editorData!.projectId,
            name: 'マーカー',
            type: 'marker',
            order: -1,
            clips: []
          });
        }
        const newMarker = {
          id: `m-${uuidv4()}`,
          trackId: markerTrackId,
          name: 'マーク',
          startAt: clickTime,
          duration: 2,
          assetId: '',
          color: '#FF9500'
        };
        addClip(markerTrackId, newMarker);
        commitHistory();
      }
    });

    setContextMenu({ x: e.clientX, y: e.clientY, options });
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onContextMenu={handleTrackContextMenu}
      style={{
        display: 'flex',
        height: '60px',
        borderBottom: '1px solid #333',
        background: '#222'
      }}
    >
      <div style={{
        width: '150px',
        background: '#111',
        borderRight: '1px solid #444',
        padding: '10px',
        display: 'flex',
        alignItems: 'center',
        color: '#ccc',
        fontSize: '12px',
        fontWeight: 'bold',
        position: 'sticky',
        left: 0,
        zIndex: 20
      }}>
        {track.name}
      </div>
      
      <div style={{ flex: 1, position: 'relative' }}>
        {track.clips.map(clip => (
          <TimelineClip key={clip.id} clip={clip} track={track} />
        ))}
      </div>
    </div>
  );
};

const TimelinePanel: React.FC = () => {
  const { 
    editorData, currentTime, setCurrentTime, pixelsPerSecond, setPixelsPerSecond,
    undo, redo, deleteClip, selectedClipId, copiedClip, setCopiedClip, addClip, addTrack, commitHistory,
    isPlaying, setIsPlaying
  } = useStore();
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Global Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(!useStore.getState().isPlaying);
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        let markerTrackId = useStore.getState().editorData?.tracks.find(t => t.type === 'marker')?.id;
        if (!markerTrackId) {
          markerTrackId = `tr-marker-${Date.now()}`;
          addTrack({
            id: markerTrackId,
            projectId: useStore.getState().editorData!.projectId,
            name: 'マーカー',
            type: 'marker',
            order: -1,
            clips: []
          });
        }
        commitHistory();
        addClip(markerTrackId, {
          id: `m-${Date.now()}`,
          trackId: markerTrackId,
          name: 'マーク',
          startAt: useStore.getState().currentTime,
          duration: 2,
          assetId: '',
          color: '#FF9500'
        });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const id = useStore.getState().selectedClipId;
        if (id) {
          commitHistory();
          deleteClip(id);
        }
      } else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.code === 'KeyC' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const id = useStore.getState().selectedClipId;
        if (id && useStore.getState().editorData) {
          for (const t of useStore.getState().editorData!.tracks) {
            const c = t.clips.find(clip => clip.id === id);
            if (c) { setCopiedClip(c); break; }
          }
        }
      } else if (e.code === 'KeyV' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const copied = useStore.getState().copiedClip;
        if (copied && useStore.getState().editorData) {
          const track = useStore.getState().editorData!.tracks[0];
          commitHistory();
          addClip(track.id, { 
            ...copied, 
            id: `clip_${Date.now()}`, 
            startAt: useStore.getState().currentTime 
          });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteClip, undo, redo, setCopiedClip, addClip, commitHistory, setIsPlaying]);

  // Zoom via Ctrl+Wheel
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      setPixelsPerSecond(prev => Math.max(1, Math.min(200, prev * zoomFactor)));
    }
  }, [setPixelsPerSecond]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  if (!editorData) return <div style={{ color: '#fff', padding: '20px' }}>Loading...</div>;

  const handlePointerDownSeek = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const handleMove = (moveEvent: PointerEvent) => {
      const x = moveEvent.clientX - rect.left + (scrollRef.current?.scrollLeft || 0);
      setCurrentTime(Math.max(0, x / useStore.getState().pixelsPerSecond));
    };
    handleMove(e as unknown as PointerEvent); // Initial seek
    
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  // Calculate 8-count grid spacing
  const bpm = editorData.bpm || 120;
  const beatDuration = 60 / bpm; // 1 beat in seconds
  const eightCountDuration = beatDuration * 8; // 8 beats in seconds
  const gridSpacing = eightCountDuration * pixelsPerSecond;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1C1C1E', userSelect: 'none' }}>

      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        
        {/* Background Grid for 8-counts */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 150, // width of the track label
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          zIndex: 0,
          backgroundSize: `${gridSpacing}px 100%`,
          backgroundImage: 'linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px)'
        }} />

        {/* Header / Ruler */}
        <div style={{ height: '30px', display: 'flex', borderBottom: '1px solid #444', position: 'sticky', top: 0, zIndex: 30, background: '#1C1C1E' }}>
          <div style={{ width: '150px', minWidth: '150px', borderRight: '1px solid #444', background: '#1C1C1E', position: 'sticky', left: 0, zIndex: 40, display: 'flex', alignItems: 'center', paddingLeft: '10px', fontSize: '10px', color: '#888' }}>
            BPM: {bpm}
          </div>
          <div 
            onPointerDown={handlePointerDownSeek}
            style={{ flex: 1, position: 'relative', background: 'transparent', cursor: 'text' }}
          >
            {/* Grid numbers */}
            {Array.from({ length: 50 }).map((_, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: `${i * gridSpacing}px`,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '10px',
                color: '#666',
                marginLeft: '4px'
              }}>
                {i * 8}
              </div>
            ))}
            
            {/* Playhead marker */}
            <div style={{
              position: 'absolute',
              left: `${(isNaN(currentTime) ? 0 : currentTime) * pixelsPerSecond}px`,
              top: 0,
              bottom: '-9999px',
              width: '2px',
              background: 'red',
              zIndex: 50,
              pointerEvents: 'none'
            }}>
              <div style={{ position: 'absolute', top: 0, left: '-4px', width: '10px', height: '10px', background: 'red', clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }} />
            </div>
          </div>
        </div>

        {/* Tracks */}
        <div style={{ flex: 1, position: 'relative', zIndex: 10 }}>
          {/* Vertical Lines for Markers */}
          {editorData.tracks.find(t => t.type === 'marker')?.clips.map(m => (
            <div key={`line-${m.id}`} style={{
              position: 'absolute',
              left: `${m.startAt * pixelsPerSecond + 150}px`,
              top: 0, bottom: 0, width: '2px',
              background: m.color || '#FF9500', opacity: 0.8, zIndex: 1, pointerEvents: 'none',
              boxShadow: '0 0 4px rgba(255, 149, 0, 0.8)'
            }} />
          ))}

          {editorData.tracks.sort((a, b) => a.order - b.order).map(track => (
            <TimelineTrack key={track.id} track={track} />
          ))}
        </div>
      </div>
    </div>
  );
};
export default TimelinePanel;
