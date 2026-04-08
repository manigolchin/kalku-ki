import { useState, useMemo } from 'react';
import { Calculator, TrendingUp, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { calculateEP } from '../../utils/kalkulation';
import { checkMarktpreis, MARKTPREISE } from '../../utils/marktpreise';
import useSettings from '../../hooks/useSettings';

const AUFWANDSWERT_PRESETS = [
  { label: 'Verbundpflaster Kies', value: 0.34 },
  { label: 'Verbundpflaster Beton', value: 0.51 },
  { label: 'Kleinpflaster Natur', value: 0.65 },
  { label: 'Platten Beton', value: 0.45 },
  { label: 'Hochbord', value: 0.28 },
  { label: 'Tiefbord', value: 0.25 },
];

const MARKTPREIS_OPTIONS = Object.entries(MARKTPREISE).map(([key, data]) => ({
  key,
  label: data.bezeichnung,
}));

const DEFAULT_FORM = {
  position: '',
  aufwandswert: '',
  materialpreis: '',
  materialverlust: '5',
  geraetKostensatz: '',
  geraetEinsatzzeit: '',
  nuKosten: '',
  nuZuschlag: '10',
};

export default function EFB221Rechner() {
  const { settings } = useSettings();
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [marktpreisKey, setMarktpreisKey] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const num = (v) => parseFloat(v) || 0;

  const result = useMemo(() => {
    return calculateEP({
      aufwandswert: num(form.aufwandswert),
      mittellohn: num(settings.mittellohn),
      materialpreis: num(form.materialpreis),
      materialverlust: num(form.materialverlust),
      geraetKostensatz: num(form.geraetKostensatz),
      geraetEinsatzzeit: num(form.geraetEinsatzzeit),
      nuKosten: num(form.nuKosten),
      nuZuschlag: num(form.nuZuschlag),
      bgk: num(settings.bgk),
      agk: num(settings.agk),
      wg: num(settings.wg),
    });
  }, [form, settings]);

  const marktCheck = useMemo(() => {
    if (!marktpreisKey || result.ep <= 0) return null;
    return checkMarktpreis(marktpreisKey, result.ep);
  }, [marktpreisKey, result.ep]);

  const components = useMemo(() => {
    if (result.ekt <= 0) return [];
    const items = [];
    if (result.lohn > 0) items.push({ label: 'Lohn', value: result.lohn, color: 'bg-blue-500' });
    if (result.material > 0) items.push({ label: 'Material', value: result.material, color: 'bg-emerald-500' });
    if (result.geraet > 0) items.push({ label: 'Gerät', value: result.geraet, color: 'bg-violet-500' });
    if (result.nu > 0) items.push({ label: 'NU', value: result.nu, color: 'bg-orange-500' });
    return items;
  }, [result]);

  const maxComponent = Math.max(...components.map((c) => c.value), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT: Inputs */}
      <div className="space-y-5">
        <div className="card space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Calculator className="w-4 h-4 text-primary-500" />
            <h3 className="text-sm font-semibold text-slate-800">Eingabewerte</h3>
          </div>

          <Field label="Position / Bezeichnung">
            <input
              type="text"
              value={form.position}
              onChange={set('position')}
              placeholder="z.B. Verbundpflaster verlegen"
              className="input-field"
            />
          </Field>

          <Field label="Aufwandswert (h/Einheit)">
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.aufwandswert}
                onChange={set('aufwandswert')}
                placeholder="0,00"
                className="input-field flex-1"
              />
              <select
                onChange={(e) => {
                  if (e.target.value) setForm((f) => ({ ...f, aufwandswert: e.target.value }));
                }}
                value=""
                className="input-field w-auto text-xs"
              >
                <option value="">Vorlagen...</option>
                {AUFWANDSWERT_PRESETS.map((p) => (
                  <option key={p.label} value={p.value}>
                    {p.label} ({p.value})
                  </option>
                ))}
              </select>
            </div>
          </Field>

          <Field label="Mittellohn (EUR/h)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={settings.mittellohn}
              readOnly
              className="input-field opacity-60 cursor-not-allowed"
            />
            <p className="text-[10px] text-slate-400 mt-1.5">
              Aus Einstellungen ({settings.region || 'Standard'})
            </p>
          </Field>

          <Field label="Materialpreis (EUR/Einheit)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.materialpreis}
              onChange={set('materialpreis')}
              placeholder="0,00"
              className="input-field"
            />
          </Field>

          <Field label="Materialverlust (%)">
            <input
              type="number"
              step="0.5"
              min="0"
              max="50"
              value={form.materialverlust}
              onChange={set('materialverlust')}
              className="input-field"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Geräte-Kostensatz (EUR/h)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.geraetKostensatz}
                onChange={set('geraetKostensatz')}
                placeholder="optional"
                className="input-field"
              />
            </Field>
            <Field label="Geräte-Einsatzzeit (h/Einh)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.geraetEinsatzzeit}
                onChange={set('geraetEinsatzzeit')}
                placeholder="optional"
                className="input-field"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="NU-Kosten (EUR/Einh)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.nuKosten}
                onChange={set('nuKosten')}
                placeholder="optional"
                className="input-field"
              />
            </Field>
            <Field label="NU-Zuschlag (%)">
              <input
                type="number"
                step="0.5"
                min="0"
                value={form.nuZuschlag}
                onChange={set('nuZuschlag')}
                className="input-field"
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="BGK (%)">
              <input type="number" value={settings.bgk} readOnly className="input-field opacity-60 cursor-not-allowed" />
            </Field>
            <Field label="AGK (%)">
              <input type="number" value={settings.agk} readOnly className="input-field opacity-60 cursor-not-allowed" />
            </Field>
            <Field label="W+G (%)">
              <input type="number" value={settings.wg} readOnly className="input-field opacity-60 cursor-not-allowed" />
            </Field>
          </div>
          <p className="text-[10px] text-slate-400">
            Zuschlagssätze werden aus den Einstellungen übernommen.
          </p>
        </div>
      </div>

      {/* RIGHT: Results */}
      <div className="space-y-5">
        {/* Breakdown */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary-500" />
            <h3 className="text-sm font-semibold text-slate-800">Kalkulationsergebnis</h3>
          </div>

          <div className="space-y-0">
            {result.breakdown.map((row, i) => {
              const isTotal = row.label.startsWith('= Einheitspreis');
              const isSubtotal = row.label.startsWith('=');
              const isAddition = row.label.startsWith('+');

              return (
                <div
                  key={i}
                  className={`
                    flex items-center justify-between py-2.5 px-3 rounded-xl
                    ${isTotal ? 'bg-primary-50 border border-primary-100 mt-2' : ''}
                    ${isSubtotal && !isTotal ? 'border-t border-slate-100' : ''}
                    ${isAddition ? 'text-slate-400' : ''}
                  `}
                >
                  <span
                    className={`text-sm ${
                      isTotal
                        ? 'font-bold text-primary-700'
                        : isSubtotal
                          ? 'font-medium text-slate-700'
                          : 'text-slate-500'
                    }`}
                  >
                    {row.label}
                  </span>
                  <div className="flex items-center gap-4">
                    <span
                      className={`font-mono text-sm ${
                        isTotal
                          ? 'font-bold text-primary-700 text-base'
                          : isSubtotal
                            ? 'font-medium text-slate-700'
                            : 'text-slate-500'
                      }`}
                    >
                      {formatEUR(row.perUnit)}
                    </span>
                    <span className="font-mono text-xs text-slate-300 w-12 text-right">
                      {row.anteil > 0 ? `${formatDE(row.anteil)}%` : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bar chart */}
        {components.length > 0 && (
          <div className="card">
            <h3 className="section-label mb-4">EKT-Aufschlüsselung</h3>
            <div className="space-y-3">
              {components.map((comp) => {
                const pct = (comp.value / maxComponent) * 100;
                const anteil = result.ekt > 0 ? ((comp.value / result.ekt) * 100).toFixed(1) : 0;
                return (
                  <div key={comp.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">{comp.label}</span>
                      <span className="font-mono text-slate-600">
                        {formatEUR(comp.value)} ({anteil}%)
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${comp.color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Market price */}
        <div className="card">
          <h3 className="section-label mb-3">Marktpreisvergleich</h3>
          <select
            value={marktpreisKey}
            onChange={(e) => setMarktpreisKey(e.target.value)}
            className="input-field w-full mb-3"
          >
            <option value="">Position auswählen...</option>
            <optgroup label="GaLaBau">
              {MARKTPREIS_OPTIONS.filter((_, i) => i < 9).map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </optgroup>
            <optgroup label="Tiefbau">
              {MARKTPREIS_OPTIONS.filter((_, i) => i >= 9).map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </optgroup>
          </select>

          {marktCheck && result.ep > 0 && (
            <div
              className={`p-3.5 rounded-xl border ${
                marktCheck.status === 'plausibel'
                  ? 'border-emerald-200 bg-emerald-50'
                  : marktCheck.status === 'kritisch'
                    ? 'border-red-200 bg-red-50'
                    : 'border-amber-200 bg-amber-50'
              }`}
            >
              <div className="flex items-start gap-2">
                {marktCheck.status === 'plausibel' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : marktCheck.status === 'kritisch' ? (
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <p className="text-xs text-slate-600 leading-relaxed">{marktCheck.abweichung}</p>
              </div>
              {marktCheck.range && (
                <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden relative">
                  <div
                    className="absolute h-full bg-emerald-200/60 rounded-full"
                    style={{
                      left: `${Math.max(0, (marktCheck.range.min / (marktCheck.range.max * 1.5)) * 100)}%`,
                      width: `${((marktCheck.range.max - marktCheck.range.min) / (marktCheck.range.max * 1.5)) * 100}%`,
                    }}
                  />
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                      marktCheck.status === 'plausibel'
                        ? 'bg-emerald-500'
                        : marktCheck.status === 'kritisch'
                          ? 'bg-red-500'
                          : 'bg-amber-500'
                    }`}
                    style={{
                      left: `${Math.min(95, Math.max(2, (result.ep / (marktCheck.range.max * 1.5)) * 100))}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {!marktpreisKey && (
            <p className="text-xs text-slate-400">Wählen Sie eine Vergleichsposition aus der Datenbank.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block section-label mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function formatEUR(n) {
  return Number(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20AC';
}

function formatDE(n) {
  return Number(n).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}
