import React, { useEffect, useRef, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import type { FormationPosition } from '../../types';

const PreviewPanel: React.FC = () => {
  const { editorData, currentTime, setCurrentTime, isPlaying, setIsPlaying, duration } = useStore();
  const reqRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Playback engine
  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      const loop = (time: number) => {
        const delta = (time - lastTimeRef.current) / 1000;
        lastTimeRef.current = time;
        setCurrentTime(Math.min(useStore.getState().currentTime + delta, duration));
        if (useStore.getState().currentTime >= duration) {
          setIsPlaying(false);
        } else {
          reqRef.current = requestAnimationFrame(loop);
        }
      };
      reqRef.current = requestAnimationFrame(loop);
    } else {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    }
    return () => { if (reqRef.current) cancelAnimationFrame(reqRef.current); };
  }, [isPlaying, duration, setCurrentTime, setIsPlaying]);

  // Calculate Interpolated Formation
  const currentPositions = useMemo(() => {
    if (!editorData) return [];
    const formationTrack = editorData.tracks.find(t => t.type === 'formation');
    if (!formationTrack) return [];
    
    const clips = [...formationTrack.clips].sort((a, b) => a.startAt - b.startAt);
    if (clips.length === 0) return [];

    // Find the clip that starts after currentTime
    const nextIdx = clips.findIndex(c => c.startAt > currentTime);
    
    if (nextIdx === 0) {
      // Before first clip
      const asset = editorData.assets.find(a => a.id === clips[0].assetId);
      return asset?.formationData?.positions || [];
    }
    
    if (nextIdx === -1) {
      // After last clip
      const asset = editorData.assets.find(a => a.id === clips[clips.length - 1].assetId);
      return asset?.formationData?.positions || [];
    }

    // Between prevIdx and nextIdx
    const prevIdx = nextIdx - 1;
    const prevClip = clips[prevIdx];
    const nextClip = clips[nextIdx];
    
    const prevAsset = editorData.assets.find(a => a.id === prevClip.assetId);
    const nextAsset = editorData.assets.find(a => a.id === nextClip.assetId);
    
    const prevPos = prevAsset?.formationData?.positions || [];
    const nextPos = nextAsset?.formationData?.positions || [];

    // Lerp between prev and next
    // The transition happens between prevClip.startAt and nextClip.startAt
    const timeRange = nextClip.startAt - prevClip.startAt;
    const progress = timeRange > 0 ? (currentTime - prevClip.startAt) / timeRange : 0;
    
    // Smoothstep easing for more natural dance movement
    const ease = progress * progress * (3 - 2 * progress);

    return prevPos.map(p1 => {
      const p2 = nextPos.find(p => p.userId === p1.userId) || p1;
      return {
        userId: p1.userId,
        x: p1.x + (p2.x - p1.x) * ease,
        y: p1.y + (p2.y - p1.y) * ease,
      };
    });
  }, [editorData, currentTime]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#000', color: '#fff' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {/* Stage Area */}
        <div style={{ width: '80%', aspectRatio: '16/9', background: '#111', position: 'relative', border: '1px solid #333' }}>
          {/* Stage Markings */}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '1px', background: '#444' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: '1px', background: '#444' }} />
          
          {/* Dancers */}
          {currentPositions.map(pos => (
            <div
              key={pos.userId}
              style={{
                position: 'absolute',
                left: `${pos.x * 100}%`,
                top: `${pos.y * 100}%`,
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#007AFF',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#fff',
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                transition: isPlaying ? 'none' : 'all 0.1s ease-out'
              }}
            >
              {pos.userId}
            </div>
          ))}
        </div>
      </div>
      
      <div style={{ padding: '10px', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '14px' }}>
          {Math.floor(currentTime / 60).toString().padStart(2, '0')}:
          {Math.floor(currentTime % 60).toString().padStart(2, '0')}.
          {Math.floor((currentTime % 1) * 100).toString().padStart(2, '0')}
        </div>
        <button 
          onClick={() => setIsPlaying(!isPlaying)} 
          style={{ padding: '8px 24px', background: isPlaying ? '#FF3B30' : '#34C759', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {isPlaying ? 'PAUSE' : 'PLAY'}
        </button>
        <button 
          onClick={() => setCurrentTime(0)} 
          style={{ padding: '8px 16px', background: '#444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          RESET
        </button>
      </div>
    </div>
  );
};
export default PreviewPanel;
