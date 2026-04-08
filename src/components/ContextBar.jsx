import { useState, useCallback } from 'react';
import { Minus, Plus } from 'lucide-react';

const PARAMS = [
  { key: 'mittellohn', label: 'Mittellohn', unit: '\u20ac/h', min: 30, max: 90, step: 1 },
  { key: 'bgk', label: 'BGK', unit: '%', min: 0, max: 25, step: 0.5 },
  { key: 'agk', label: 'AGK', unit: '%', min: 0, max: 20, step: 0.5 },
  { key: 'wg', label: 'W+G', unit: '%', min: 0, max: 15, step: 0.5 },
];

function ParamControl({ param, value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startEdit = () => {
    setDraft(String(value));
    setEditing(true);
  };

  const commitEdit = useCallback(() => {
    setEditing(false);
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) {
      const clamped = Math.min(param.max, Math.max(param.min, parsed));
      onChange(param.key, clamped);
    }
  }, [draft, param, onChange]);

  const increment = () => {
    const next = Math.min(param.max, value + param.step);
    onChange(param.key, parseFloat(next.toFixed(2)));
  };

  const decrement = () => {
    const next = Math.max(param.min, value - param.step);
    onChange(param.key, parseFloat(next.toFixed(2)));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setEditing(false);
  };

  return (
    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5">
      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mr-1">
        {param.label}
      </span>

      <button
        type="button"
        onClick={decrement}
        className="w-5 h-5 flex items-center justify-center rounded bg-white border border-slate-200/80 text-slate-400
          hover:bg-slate-100 hover:text-slate-600 transition-all duration-200 cursor-pointer"
        aria-label={`${param.label} verringern`}
      >
        <Minus size={10} />
      </button>

      {editing ? (
        <input
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          min={param.min}
          max={param.max}
          step={param.step}
          autoFocus
          className="w-14 bg-white border border-primary-300 rounded px-1.5 py-0.5
            text-center text-xs font-mono text-primary-600 outline-none
            [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      ) : (
        <button
          type="button"
          onClick={startEdit}
          className="min-w-[3rem] text-center text-xs font-mono text-slate-700 font-medium
            hover:text-primary-600 cursor-pointer px-1 py-0.5 rounded
            hover:bg-white transition-all duration-200"
        >
          {Number.isInteger(value) ? value : value.toFixed(1)}
          <span className="text-slate-400 ml-0.5 text-[10px] font-sans">{param.unit}</span>
        </button>
      )}

      <button
        type="button"
        onClick={increment}
        className="w-5 h-5 flex items-center justify-center rounded bg-white border border-slate-200/80 text-slate-400
          hover:bg-slate-100 hover:text-slate-600 transition-all duration-200 cursor-pointer"
        aria-label={`${param.label} erh\u00f6hen`}
      >
        <Plus size={10} />
      </button>
    </div>
  );
}

export default function ContextBar({ settings, onUpdate }) {
  const handleChange = useCallback(
    (key, value) => {
      onUpdate({ ...settings, [key]: value });
    },
    [settings, onUpdate]
  );

  return (
    <div className="flex items-center gap-2 overflow-x-auto px-5 py-2.5 bg-white border-b border-slate-100">
      <span className="text-[10px] uppercase tracking-widest text-slate-300 font-semibold flex-shrink-0 mr-1">
        Kalkulation
      </span>
      {PARAMS.map((param) => (
        <ParamControl
          key={param.key}
          param={param}
          value={settings[param.key] ?? param.min}
          onChange={handleChange}
        />
      ))}
    </div>
  );
}
