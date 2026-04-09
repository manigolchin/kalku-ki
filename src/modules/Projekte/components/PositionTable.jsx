import { useState, useRef, useEffect, useCallback, useMemo, Fragment } from 'react';
import clsx from 'clsx';
import { ChevronRight, ChevronDown, Columns3, Eye, EyeOff, Calculator, Plus, Trash2, GripVertical, FileText } from 'lucide-react';
import { updatePosition, addPosition, deletePosition } from '../../../utils/projectStore';
import { fmt } from '../../../utils/projectCalc';

// ---------------------------------------------------------------------------
// Column group definitions
// ---------------------------------------------------------------------------

const COLUMN_GROUPS = {
  zeit: {
    label: 'Zeitberechnung',
    columns: [
      { key: 'actual_time', label: 'Min/Einh.', formula: 'Min/Einh. = Zeit (min) + Zeitabzug %' },
      { key: 'output_per_hour', label: 'Lstg./Std.', formula: 'Lstg./Std. = 60 / Min/Einh.' },
      { key: 'hours_per_unit', label: 'Std./Einh.', formula: 'Std./Einh. = Min/Einh. / 60' },
    ],
  },
  ep_detail: {
    label: 'EP-Aufschlüsselung',
    columns: [
      { key: 'ep_lohn', label: 'EP Lohn', color: 'text-blue-600', formula: 'EP Lohn = (Min/Einh. / 60) × Verrechnungslohn' },
      { key: 'ep_material', label: 'EP Stoffe', color: 'text-green-600', formula: 'EP Stoffe = Stoffe EK × (1 + Materialzuschlag)' },
      { key: 'ep_geraete', label: 'EP Geräte', color: 'text-amber-600', formula: 'EP Geräte = (Min/Einh. / 60) × Gerätestundensatz' },
      { key: 'ep_nu', label: 'EP NU', color: 'text-violet-600', formula: 'EP NU = NU EK × (1 + NU-Zuschlag)' },
    ],
  },
  gp_detail: {
    label: 'GP-Aufschlüsselung',
    columns: [
      { key: 'gp_lohn', label: 'GP Lohn', color: 'text-blue-600', formula: 'GP Lohn = Menge × EP Lohn' },
      { key: 'gp_material', label: 'GP Stoffe', color: 'text-green-600', formula: 'GP Stoffe = Menge × EP Stoffe' },
      { key: 'gp_geraete', label: 'GP Geräte', color: 'text-amber-600', formula: 'GP Geräte = Menge × EP Geräte' },
      { key: 'gp_nu', label: 'GP NU', color: 'text-violet-600', formula: 'GP NU = Menge × EP NU' },
    ],
  },
  zeitplanung: {
    label: 'Zeitplanung',
    columns: [
      { key: 'hours_total', label: 'Std. Ges.', formula: 'Std. Ges. = Min/Einh. × Menge / 60' },
      { key: 'days_total', label: 'Tage', formula: 'Tage = Std. Ges. / Tagesstunden / Personaleinsatz' },
    ],
  },
};

// ---------------------------------------------------------------------------
// InlineCell - Editable number cell with debounce
// ---------------------------------------------------------------------------

/**
 * Convert a number to German display format: 49.9 → "49,9"
 */
function toGerman(v) {
  return v.toString().replace('.', ',');
}

/**
 * Safely evaluate a math expression string (numbers + - * / . , () only).
 * Supports German decimal comma: 2,5 → 2.5
 * Returns null if invalid.
 */
function evalMathExpr(expr) {
  if (!expr || typeof expr !== 'string') return null;
  // Replace comma with dot for German decimal input
  const cleaned = expr.replace(/,/g, '.').trim();
  // Only allow digits, operators, dots, parens, spaces
  if (!/^[\d\s+\-*/().]+$/.test(cleaned)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function('return (' + cleaned + ')')();
    if (typeof result === 'number' && isFinite(result) && result >= 0) {
      return Math.round(result * 100) / 100;
    }
    return null;
  } catch {
    return null;
  }
}

function InlineCell({ value, positionId, field, projectId, onSaved, className }) {
  const [localValue, setLocalValue] = useState(toGerman(value));
  const [isFocused, setIsFocused] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isFocused) setLocalValue(toGerman(value));
  }, [value, isFocused]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = (e) => {
    const raw = e.target.value;
    // Block alphabet characters — only allow digits, math operators, dots, commas, parens, spaces
    if (raw && !/^[\d\s+\-*/().,]*$/.test(raw)) return;
    setLocalValue(raw);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const result = evalMathExpr(raw);
      if (result !== null) {
        updatePosition(projectId, positionId, { [field]: result });
        onSaved();
      }
    }, 500);
  };

  const handleFocus = () => {
    setIsFocused(true);
    requestAnimationFrame(() => {
      inputRef.current?.select();
    });
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const result = evalMathExpr(localValue);
    if (result !== null) {
      updatePosition(projectId, positionId, { [field]: result });
      setLocalValue(toGerman(result));
      onSaved();
    } else {
      setLocalValue(toGerman(value));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    }
    if (e.key === 'Escape') {
      setLocalValue(toGerman(value));
      inputRef.current?.blur();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={isFocused ? localValue : fmt.number(value)}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={clsx(
        'w-full text-right text-xs font-mono px-1.5 py-1 rounded border border-transparent',
        'outline-none transition-colors duration-100',
        isFocused
          ? 'border-blue-400 bg-white ring-1 ring-blue-200'
          : 'bg-transparent hover:border-gray-300',
        className,
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// InlineTextCell - Editable text cell with debounce
// ---------------------------------------------------------------------------

function InlineTextCell({ value, positionId, field, projectId, onSaved, className }) {
  const [localValue, setLocalValue] = useState(value || '');
  const [isFocused, setIsFocused] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isFocused) setLocalValue(value || '');
  }, [value, isFocused]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = (e) => {
    const raw = e.target.value;
    setLocalValue(raw);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updatePosition(projectId, positionId, { [field]: raw });
      onSaved();
    }, 400);
  };

  const handleFocus = () => {
    setIsFocused(true);
    requestAnimationFrame(() => {
      inputRef.current?.select();
    });
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    updatePosition(projectId, positionId, { [field]: localValue });
    onSaved();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') inputRef.current?.blur();
    if (e.key === 'Escape') {
      setLocalValue(value || '');
      inputRef.current?.blur();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={localValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={clsx(
        'w-full text-left text-xs px-1.5 py-1 rounded border border-transparent',
        'outline-none transition-colors duration-100',
        isFocused
          ? 'border-blue-400 bg-white ring-1 ring-blue-200'
          : 'bg-transparent hover:border-gray-300',
        className,
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// FormulaBar - Shows formula for a clicked calculated cell
// ---------------------------------------------------------------------------

function FormulaBar({ formula, onClose }) {
  if (!formula) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 mb-2">
      <Calculator size={14} className="shrink-0 text-blue-500" />
      <span className="font-mono flex-1">{formula}</span>
      <button
        type="button"
        onClick={onClose}
        className="text-blue-400 hover:text-blue-600 font-bold ml-2"
        aria-label="Formelleiste schließen"
      >
        &times;
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PositionTable
// ---------------------------------------------------------------------------

export default function PositionTable({ positions, projectId, onUpdate }) {
  const [visibleGroups, setVisibleGroups] = useState({
    zeit: false,
    ep_detail: false,
    gp_detail: false,
    zeitplanung: false,
  });
  const [activeFormula, setActiveFormula] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [expandedLangtext, setExpandedLangtext] = useState(new Set());

  const toggleGroup = useCallback((groupKey) => {
    setVisibleGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  }, []);

  const handleCellClick = useCallback((formula) => {
    setActiveFormula(formula);
  }, []);

  const toggleLangtext = useCallback((posId) => {
    setExpandedLangtext((prev) => {
      const next = new Set(prev);
      if (next.has(posId)) {
        next.delete(posId);
      } else {
        next.add(posId);
      }
      return next;
    });
  }, []);

  // Build the flat list of visible optional columns
  const optionalColumns = useMemo(() => {
    const cols = [];
    for (const [groupKey, group] of Object.entries(COLUMN_GROUPS)) {
      if (visibleGroups[groupKey]) {
        for (const col of group.columns) {
          cols.push({ ...col, group: groupKey });
        }
      }
    }
    return cols;
  }, [visibleGroups]);

  // Count active optional groups for colSpan calculations
  const activeGroupSpans = useMemo(() => {
    const spans = {};
    for (const [groupKey, group] of Object.entries(COLUMN_GROUPS)) {
      if (visibleGroups[groupKey]) {
        spans[groupKey] = group.columns.length;
      }
    }
    return spans;
  }, [visibleGroups]);

  // Total columns: Pos(1) + Bezeichnung(1) + Mengen(2) + EingabeEK(3) + Geräte(2) + optionalCols + Ergebnis(3)
  const totalCols = 12 + optionalColumns.length;

  // Totals
  const dataPositions = useMemo(
    () => positions.filter((p) => !p.is_header),
    [positions],
  );

  const totals = useMemo(() => {
    const t = { gp: 0, gp_lohn: 0, gp_material: 0, gp_geraete: 0, gp_nu: 0, hours_total: 0, days_total: 0 };
    for (const p of dataPositions) {
      t.gp += p.gp || 0;
      t.gp_lohn += p.gp_lohn || 0;
      t.gp_material += p.gp_material || 0;
      t.gp_geraete += p.gp_geraete || 0;
      t.gp_nu += p.gp_nu || 0;
      t.hours_total += p.hours_total || 0;
      t.days_total += p.days_total || 0;
    }
    return t;
  }, [dataPositions]);

  const handleAddPosition = useCallback(() => {
    addPosition(projectId, {
      oz: `M-${dataPositions.length + 1}`,
      short_text: 'Neue Position',
      quantity: 1,
      unit: 'Stk',
    });
    onUpdate();
  }, [projectId, dataPositions.length, onUpdate]);

  const handleDeletePosition = useCallback((posId) => {
    deletePosition(projectId, posId);
    setDeleteConfirm(null);
    onUpdate();
  }, [projectId, onUpdate]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="w-full">
      {/* Column Toggle Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <Columns3 size={14} className="text-gray-400 mr-1" />
        {Object.entries(COLUMN_GROUPS).map(([key, group]) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleGroup(key)}
            className={clsx(
              'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
              visibleGroups[key]
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
            )}
          >
            {visibleGroups[key] ? <Eye size={12} /> : <EyeOff size={12} />}
            {group.label}
          </button>
        ))}
      </div>

      {/* Formula Bar */}
      <FormulaBar formula={activeFormula} onClose={() => setActiveFormula(null)} />

      {/* Table Container */}
      <div className="border border-gray-200 rounded-lg overflow-x-auto bg-white">
        <table className="w-full border-collapse text-xs min-w-[1200px]">
          {/* ---- Group Header Row ---- */}
          <thead>
            <tr className="bg-gray-100">
              {/* Position */}
              <th className="text-left px-2 py-2 font-semibold text-gray-600 sticky left-0 bg-gray-100 z-10 w-28">
                Position
              </th>
              {/* Bezeichnung */}
              <th className="text-left px-2 py-2 font-semibold text-gray-600 min-w-[280px]">
                Bezeichnung
              </th>
              {/* Mengen */}
              <th colSpan={2} className="text-center px-2 py-2 font-semibold text-gray-600">
                Mengen
              </th>
              {/* Eingabe EK */}
              <th
                colSpan={3}
                className="text-center px-2 py-2 font-semibold text-blue-700 border-t-2 border-blue-400"
              >
                Eingabe EK
              </th>
              {/* Geräte */}
              <th
                colSpan={2}
                className="text-center px-2 py-2 font-semibold text-amber-600 border-t-2 border-amber-300"
              >
                Geräte
              </th>
              {/* Optional group headers */}
              {Object.entries(COLUMN_GROUPS).map(([groupKey, group]) =>
                visibleGroups[groupKey] ? (
                  <th
                    key={groupKey}
                    colSpan={activeGroupSpans[groupKey]}
                    className="text-center px-2 py-2 font-semibold text-gray-600 border-t-2 border-gray-300"
                  >
                    {group.label}
                  </th>
                ) : null,
              )}
              {/* Ergebnis */}
              <th
                colSpan={3}
                className="text-center px-2 py-2 font-semibold text-amber-700 border-t-2 border-amber-400"
              >
                Ergebnis
              </th>
            </tr>

            {/* ---- Column Header Row ---- */}
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-1.5 font-medium text-gray-500 sticky left-0 bg-gray-50 z-10 w-28">
                Pos.
              </th>
              <th className="text-left px-3 py-1.5 font-medium text-gray-500">
                Kurztext
              </th>
              <th className="text-right px-3 py-1.5 font-medium text-gray-500 w-24">
                Menge
              </th>
              <th className="text-center px-3 py-1.5 font-medium text-gray-500 w-14">
                Einh.
              </th>
              <th className="text-right px-3 py-1.5 font-medium text-gray-500 w-24">
                NU EK
              </th>
              <th className="text-right px-3 py-1.5 font-medium text-gray-500 w-24">
                Stoffe EK
              </th>
              <th className="text-right px-3 py-1.5 font-medium text-gray-500 w-24">
                Zeit (min)
              </th>
              <th className="text-right px-3 py-1.5 font-medium text-amber-600 w-24">
                Zulage
              </th>
              <th className="text-right px-3 py-1.5 font-medium text-amber-600 w-24">
                EP Geräte
              </th>
              {/* Optional column headers */}
              {optionalColumns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    'text-right px-2 py-1.5 font-medium w-20',
                    col.color || 'text-gray-500',
                  )}
                >
                  {col.label}
                </th>
              ))}
              {/* Ergebnis columns */}
              <th className="text-right px-3 py-1.5 font-medium text-gray-500 w-28">
                EP
              </th>
              <th className="text-right px-3 py-1.5 font-medium text-gray-500 w-32">
                GP
              </th>
              <th className="text-center px-2 py-1.5 font-medium text-gray-400 w-10" />
            </tr>
          </thead>

          <tbody>
            {positions.map((pos, rowIdx) => {
              // Section header row
              if (pos.is_header) {
                return (
                  <tr key={pos.id} className="bg-gray-50 border-b border-gray-200">
                    <td
                      colSpan={totalCols}
                      className="px-2 py-2 sticky left-0 bg-gray-50 z-10"
                    >
                      <div className="flex items-center gap-1.5">
                        <ChevronRight size={14} className="text-gray-400 shrink-0" />
                        <span className="font-semibold text-gray-700 text-xs">
                          {pos.oz && (
                            <span className="text-gray-400 mr-2">{pos.oz}</span>
                          )}
                          {pos.short_text}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              }

              const hasLangtext = !!(pos.long_text && pos.long_text.trim());
              const isExpanded = expandedLangtext.has(pos.id);

              // Data row + optional Langtext expansion row
              return (
                <Fragment key={pos.id}>
                  <tr
                    className={clsx(
                      'group/row border-b transition-colors',
                      isExpanded ? 'border-b-0' : 'border-gray-100',
                      rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50',
                      'hover:bg-blue-50/60',
                    )}
                  >
                    {/* Pos */}
                    <td className="px-3 py-1.5 text-gray-500 font-mono sticky left-0 z-10 bg-inherit w-28">
                      <div className="flex items-center gap-1">
                        {hasLangtext && (
                          <button
                            type="button"
                            onClick={() => toggleLangtext(pos.id)}
                            className={clsx(
                              'p-0.5 rounded transition-colors shrink-0',
                              isExpanded
                                ? 'text-blue-500 bg-blue-50'
                                : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50',
                            )}
                            title={isExpanded ? 'Langtext ausblenden' : 'Langtext anzeigen'}
                          >
                            <FileText size={12} />
                          </button>
                        )}
                        <span>{pos.oz}</span>
                      </div>
                    </td>

                    {/* Kurztext (read-only, from GAEB) */}
                    <td className="px-3 py-1.5 min-w-[280px] text-gray-700 text-xs truncate max-w-[400px]" title={pos.short_text}>
                      {pos.short_text}
                    </td>

                    {/* Menge (read-only, from GAEB) */}
                    <td className="px-3 py-1.5 text-right font-mono w-24">
                      {fmt.number(pos.quantity)}
                    </td>

                    {/* Einheit */}
                    <td className="px-3 py-1.5 text-center text-gray-500 w-14">
                      {pos.unit}
                    </td>

                    {/* NU EK (editable, violet tint) */}
                    <td className="px-1 py-0.5 w-24">
                      <InlineCell
                        value={pos.nu_cost}
                        positionId={pos.id}
                        field="nu_cost"
                        projectId={projectId}
                        onSaved={onUpdate}
                        className="bg-violet-50/60 focus:bg-white"
                      />
                    </td>

                    {/* Stoffe EK (editable, green tint) */}
                    <td className="px-1 py-0.5 w-24">
                      <InlineCell
                        value={pos.material_cost}
                        positionId={pos.id}
                        field="material_cost"
                        projectId={projectId}
                        onSaved={onUpdate}
                        className="bg-green-50/60 focus:bg-white"
                      />
                    </td>

                    {/* Zeit (editable, blue tint) */}
                    <td className="px-1 py-0.5 w-20">
                      <InlineCell
                        value={pos.time_minutes}
                        positionId={pos.id}
                        field="time_minutes"
                        projectId={projectId}
                        onSaved={onUpdate}
                        className="bg-blue-50/60 focus:bg-white"
                      />
                    </td>

                    {/* Zulage Geräte (display, from project settings) */}
                    <td className="px-3 py-1.5 text-right font-mono text-amber-600 w-24">
                      {fmt.number(pos.geraete_stundensatz || 0)}
                    </td>

                    {/* EP Geräte (calculated) */}
                    <td
                      className="px-3 py-1.5 text-right font-mono text-amber-600 w-24 cursor-pointer hover:underline decoration-dotted"
                      onClick={() => handleCellClick('EP Geräte: EP Geräte = (Zeit/60) × Zulage Geräte')}
                      title="Klicken für Formel"
                    >
                      {fmt.number(pos.ep_geraete)}
                    </td>

                    {/* Optional calculated columns */}
                    {optionalColumns.map((col) => (
                      <td
                        key={col.key}
                        className={clsx(
                          'px-2 py-1.5 text-right font-mono cursor-pointer hover:underline decoration-dotted',
                          col.color || 'text-gray-600',
                        )}
                        onClick={() => handleCellClick(`${col.label}: ${col.formula}`)}
                        title="Klicken für Formel"
                      >
                        {fmt.number(pos[col.key])}
                      </td>
                    ))}

                    {/* EP */}
                    <td
                      className="px-3 py-1.5 text-right font-mono font-medium text-gray-800 w-28 cursor-pointer hover:underline decoration-dotted"
                      onClick={() => handleCellClick('EP: EP = EP Lohn + EP Stoffe + EP Geräte + EP NU')}
                      title="Klicken für Formel"
                    >
                      {fmt.currency(pos.ep)}
                    </td>

                    {/* GP */}
                    <td
                      className="px-3 py-1.5 text-right font-mono font-semibold text-gray-900 w-32 cursor-pointer hover:underline decoration-dotted"
                      onClick={() => handleCellClick('GP: GP = Menge × EP')}
                      title="Klicken für Formel"
                    >
                      {fmt.currency(pos.gp)}
                    </td>

                    {/* Delete action */}
                    <td className="px-1 py-1.5 text-center">
                      {deleteConfirm === pos.id ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeletePosition(pos.id)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                          >
                            Ja
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(null)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
                          >
                            Nein
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(pos.id)}
                          className="p-0.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover/row:opacity-100"
                          title="Position löschen"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Langtext expansion row */}
                  {hasLangtext && isExpanded && (
                    <tr className={clsx(
                      'border-b border-gray-100',
                      rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50',
                    )}>
                      <td colSpan={totalCols} className="px-2 py-0 overflow-hidden">
                        <div className="flex gap-3 py-2.5 pl-6 pr-2">
                          <div className="w-0.5 shrink-0 rounded-full bg-blue-200" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <FileText size={11} className="text-blue-500 shrink-0" />
                              <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">
                                Langtext
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                              {pos.long_text}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}

            {/* ---- Total Row ---- */}
            <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
              <td className="px-2 py-2 sticky left-0 bg-gray-100 z-10" />
              <td className="px-2 py-2 text-gray-700">Summe</td>
              <td className="px-2 py-2" />
              <td className="px-2 py-2" />
              <td className="px-2 py-2" />
              <td className="px-2 py-2" />
              <td className="px-2 py-2" />
              <td className="px-2 py-2" />
              <td className="px-2 py-2" />

              {/* Optional totals */}
              {optionalColumns.map((col) => {
                const totalKey = col.key;
                const totalVal = totals[totalKey];
                return (
                  <td
                    key={col.key}
                    className={clsx(
                      'px-2 py-2 text-right font-mono',
                      col.color || 'text-gray-700',
                    )}
                  >
                    {totalVal !== undefined ? fmt.number(totalVal) : ''}
                  </td>
                );
              })}

              {/* EP total - not meaningful as a sum */}
              <td className="px-2 py-2" />

              {/* GP total */}
              <td className="px-2 py-2 text-right font-mono text-gray-900">
                {fmt.currency(totals.gp)}
              </td>

              <td className="px-2 py-2" />
            </tr>
          </tbody>
        </table>

        {/* Add Position Button */}
        <div className="border-t border-gray-200 px-3 py-2">
          <button
            type="button"
            onClick={handleAddPosition}
            className={clsx(
              'inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium',
              'text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors',
            )}
          >
            <Plus size={14} />
            Position hinzufügen
          </button>
        </div>
      </div>

      {/* Bottom Info Bar */}
      <div className="flex items-center justify-between mt-2 px-1 text-xs text-gray-500">
        {/* Left: Position count */}
        <span>
          {dataPositions.length} {dataPositions.length === 1 ? 'Position' : 'Positionen'}
        </span>

        {/* Right: Legend & total */}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-violet-400" />
            NU
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            Stoffe
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            Zeit
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Geräte
          </span>
          <span className="font-medium text-gray-700 ml-2">
            GP: {fmt.currency(totals.gp)}
          </span>
        </div>
      </div>
    </div>
  );
}
