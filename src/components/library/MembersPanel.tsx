import React, { useState } from 'react';
import { LuTrash2, LuUserPlus } from 'react-icons/lu';
import { useProject } from '../../store/projectStore';
import { makeMember, shortName } from '../../lib/factory';
import { TextField } from '../common/Fields';

export const MembersPanel: React.FC = () => {
  const members = useProject((s) => s.project!.members);
  const [names, setNames] = useState('');
  const commit = useProject((s) => s.commit);

  const add = () => {
    // 「、」「,」改行区切りでまとめて追加できる
    const list = names.split(/[,、\n]+/).map((s) => s.trim()).filter(Boolean);
    if (!list.length) return;
    commit((d) => {
      list.forEach((n) => d.members.push(makeMember(n, d.members.length)));
    });
    setNames('');
  };

  const remove = (id: string, name: string) => {
    if (!window.confirm(`${name} を削除しますか？ すべての隊形からも外れます。`)) return;
    commit((d) => {
      d.members = d.members.filter((m) => m.id !== id);
      d.clips.forEach((c) => {
        if (c.positions) c.positions = c.positions.filter((p) => p.memberId !== id);
      });
    });
  };

  return (
    <div className="panel-body">
      <div style={{ padding: 10 }}>
        <div className="row">
          <input
            className="input"
            placeholder="名前 (「、」区切りでまとめて追加)"
            value={names}
            onChange={(e) => setNames(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="btn primary" onClick={add} title="追加"><LuUserPlus /></button>
        </div>
      </div>
      {members.map((m) => (
        <div key={m.id} className="member">
          <label className="member-dot" style={{ background: m.color, cursor: 'pointer', position: 'relative' }} title="色を変更">
            {m.short}
            <input
              type="color"
              value={m.color}
              onChange={(e) => commit((d) => void (d.members.find((x) => x.id === m.id)!.color = e.target.value))}
              style={{ position: 'absolute', opacity: 0, inset: 0, width: '100%', height: '100%', cursor: 'pointer' }}
            />
          </label>
          <TextField
            value={m.name}
            ariaLabel="名前"
            onCommit={(v) =>
              commit((d) => {
                const x = d.members.find((y) => y.id === m.id)!;
                const autoShort = x.short === shortName(x.name);
                x.name = v.trim() || x.name;
                if (autoShort) x.short = shortName(x.name);
              })
            }
          />
          <div style={{ width: 52, flexShrink: 0 }}>
            <TextField
              value={m.short}
              ariaLabel="表示名"
              onCommit={(v) => commit((d) => void (d.members.find((y) => y.id === m.id)!.short = v.trim().slice(0, 3) || '?'))}
            />
          </div>
          <button className="icon-btn sm" title="削除" onClick={() => remove(m.id, m.name)}><LuTrash2 /></button>
        </div>
      ))}
      {members.length === 0 ? (
        <p className="hint" style={{ padding: '0 14px' }}>出演メンバーを追加すると、ステージで隊形を作れます。</p>
      ) : (
        <p className="hint" style={{ padding: '8px 14px' }}>丸をクリックで色、右の欄はステージに出す短い表示名 (3文字まで)。</p>
      )}
    </div>
  );
};
