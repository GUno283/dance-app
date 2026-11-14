import React, { useEffect, useRef, useState } from 'react';

/** 入力中はローカルに保持し、確定時 (blur / Enter) に 1 回だけ反映する → 履歴が 1 文字ごとに積まれない */
export const TextField: React.FC<{
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  autoFocus?: boolean;
  ariaLabel?: string;
}> = ({ value, onCommit, placeholder, className, multiline, autoFocus, ariaLabel }) => {
  const [v, setV] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setV(value);
  }, [value]);
  const commit = () => {
    if (v !== value) onCommit(v);
  };
  const common = {
    value: v,
    placeholder,
    autoFocus,
    'aria-label': ariaLabel,
    onFocus: () => (focused.current = true),
    onBlur: () => {
      focused.current = false;
      commit();
    },
  };
  if (multiline)
    return (
      <textarea
        {...common}
        className={className ?? 'textarea'}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) (e.target as HTMLElement).blur();
          if (e.key === 'Escape') {
            setV(value);
            (e.target as HTMLElement).blur();
          }
        }}
      />
    );
  return (
    <input
      {...common}
      className={className ?? 'input'}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLElement).blur();
        if (e.key === 'Escape') {
          setV(value);
          setTimeout(() => (e.target as HTMLElement).blur());
        }
      }}
    />
  );
};

export const NumberField: React.FC<{
  value: number;
  onCommit: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  digits?: number;
  suffix?: string;
  ariaLabel?: string;
}> = ({ value, onCommit, step = 0.01, min, max, digits = 2, suffix, ariaLabel }) => {
  const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(digits) : '');
  const [v, setV] = useState(fmt(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setV(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, digits]);
  const commit = (raw = v) => {
    let n = parseFloat(raw);
    if (!Number.isFinite(n)) return setV(fmt(value));
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    setV(fmt(n));
    if (Math.abs(n - value) > 1e-9) onCommit(n);
  };
  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input"
        inputMode="decimal"
        value={v}
        aria-label={ariaLabel}
        onFocus={(e) => {
          focused.current = true;
          e.target.select();
        }}
        onBlur={() => {
          focused.current = false;
          commit();
        }}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLElement).blur();
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const n = (parseFloat(v) || 0) + (e.key === 'ArrowUp' ? step : -step) * (e.shiftKey ? 10 : 1);
            commit(String(n));
          }
        }}
        style={suffix ? { paddingRight: 28 } : undefined}
      />
      {suffix && <span style={{ position: 'absolute', right: 8, top: 7, fontSize: 11, color: 'var(--text-3)', pointerEvents: 'none' }}>{suffix}</span>}
    </div>
  );
};
