import React, { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import type { FormationPosition, Member } from '../../types';

interface PathLine {
  userId: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

const FormationPreview: React.FC = () => {
  const { editorData, currentTime, isPlaying, nameFontSize } = useStore();

  const { currentPositions, paths } = useMemo(() => {
    if (!editorData) return { currentPositions: [], paths: [] };
    const formationTrack = editorData.tracks.find(t => t.type === 'formation');
    if (!formationTrack) return { currentPositions: [], paths: [] };
    
    const clips = [...formationTrack.clips].sort((a, b) => a.startAt - b.startAt);
    if (clips.length === 0) return { currentPositions: [], paths: [] };

    let currentPositions: FormationPosition[] = [];
    let paths: PathLine[] = [];

    // Find where we are
    const nextIdx = clips.findIndex(c => c.startAt > currentTime);
    
    if (nextIdx === 0) {
      const asset = editorData.assets.find(a => a.id === clips[0].assetId);
      return { currentPositions: asset?.formationData?.positions || [], paths: [] };
    }
    
    if (nextIdx === -1) {
      const currentClip = clips[clips.length - 1];
      const asset = editorData.assets.find(a => a.id === currentClip.assetId);
      currentPositions = asset?.formationData?.positions || [];
      
      // Calculate paths from previous clip if exists
      if (clips.length > 1) {
        const prevClip = clips[clips.length - 2];
        const prevAsset = editorData.assets.find(a => a.id === prevClip.assetId);
        const prevPos = prevAsset?.formationData?.positions || [];
        
        paths = currentPositions.map(curr => {
          const prev = prevPos.find(p => p.userId === curr.userId);
          if (prev) return { userId: curr.userId, from: { x: prev.x, y: prev.y }, to: { x: curr.x, y: curr.y } };
          return null;
        }).filter(Boolean) as PathLine[];
      }
      return { currentPositions, paths };
    }

    const prevIdx = nextIdx - 1;
    const prevClip = clips[prevIdx];
    const nextClip = clips[nextIdx];
    
    const prevAsset = editorData.assets.find(a => a.id === prevClip.assetId);
    const nextAsset = editorData.assets.find(a => a.id === nextClip.assetId);
    
    const prevPos = prevAsset?.formationData?.positions || [];
    const nextPos = nextAsset?.formationData?.positions || [];

    const timeRange = nextClip.startAt - prevClip.startAt;
    const progress = timeRange > 0 ? (currentTime - prevClip.startAt) / timeRange : 0;

    // Check if we are physically inside the prevClip duration
    if (currentTime <= prevClip.startAt + prevClip.duration) {
      currentPositions = prevPos;
      // Draw paths from prevClip's prev to prevClip
      if (prevIdx > 0) {
        const pprevClip = clips[prevIdx - 1];
        const pprevAsset = editorData.assets.find(a => a.id === pprevClip.assetId);
        const pprevPos = pprevAsset?.formationData?.positions || [];
        paths = currentPositions.map(curr => {
          const prev = pprevPos.find(p => p.userId === curr.userId);
          if (prev) return { userId: curr.userId, from: { x: prev.x, y: prev.y }, to: { x: curr.x, y: curr.y } };
          return null;
        }).filter(Boolean) as PathLine[];
      }
    } else {
      // We are in the gap between prevClip and nextClip -> interpolate
      const gapStart = prevClip.startAt + prevClip.duration;
      const gapDuration = nextClip.startAt - gapStart;
      const gapProgress = gapDuration > 0 ? (currentTime - gapStart) / gapDuration : 0;
      const ease = gapProgress * gapProgress * (3 - 2 * gapProgress);

      currentPositions = prevPos.map(p1 => {
        const p2 = nextPos.find(p => p.userId === p1.userId) || p1;
        return {
          userId: p1.userId,
          x: p1.x + (p2.x - p1.x) * ease,
          y: p1.y + (p2.y - p1.y) * ease,
        };
      });

      // Show paths from prevPos to nextPos to visualize where they are going
      paths = nextPos.map(next => {
        const prev = prevPos.find(p => p.userId === next.userId);
        if (prev) return { userId: next.userId, from: { x: prev.x, y: prev.y }, to: { x: next.x, y: next.y } };
        return null;
      }).filter(Boolean) as PathLine[];
    }

    return { currentPositions, paths };
  }, [editorData, currentTime]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#000', color: '#fff' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div style={{ width: '90%', aspectRatio: '16/9', background: '#111', position: 'relative', border: '1px solid #333', overflow: 'hidden' }}>
          
          {/* Grid lines */}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '1px', background: '#444' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: '1px', background: '#444' }} />
          
          {/* Paths (Onion Skin) */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#888" />
              </marker>
            </defs>
            {paths.map(path => {
              const member = (editorData?.members || []).find(m => m.id === path.userId);
              const color = member ? member.color : '#888';
              return (
                <line 
                  key={`path-${path.userId}`}
                  x1={`${path.from.x * 100}%`} 
                  y1={`${path.from.y * 100}%`} 
                  x2={`${path.to.x * 100}%`} 
                  y2={`${path.to.y * 100}%`} 
                  stroke={color} 
                  strokeWidth="2" 
                  strokeDasharray="5,5" 
                  opacity={0.5}
                  markerEnd="url(#arrowhead)"
                />
              );
            })}
          </svg>

          {/* Members */}
          {currentPositions.map(pos => {
            const member = (editorData?.members || []).find(m => m.id === pos.userId);
            if (!member) return null;
            return (
              <div
                key={pos.userId}
                style={{
                  position: 'absolute',
                  left: `${pos.x * 100}%`,
                  top: `${pos.y * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  transition: isPlaying ? 'none' : 'all 0.1s ease-out'
                }}
              >
                <img 
                  src={member.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`} 
                  alt={member.name}
                  style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%', 
                    objectFit: 'cover', 
                    border: `2px solid ${member.color}`,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                  }}
                />
                <div style={{ 
                  marginTop: '4px', 
                  fontSize: `${nameFontSize}px`, 
                  color: '#fff', 
                  textShadow: '1px 1px 2px #000',
                  whiteSpace: 'nowrap',
                  fontWeight: 'bold'
                }}>
                  {member.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
export default FormationPreview;
