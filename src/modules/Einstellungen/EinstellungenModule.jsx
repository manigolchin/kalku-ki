import { useCallback } from 'react';
import { RotateCcw, Save, Info } from 'lucide-react';
import { useSettings, REGION_MITTELLOHN, GEWERK_INFO } from '../../hooks/useSettings';

function SliderInput({ label, value, min, max, step = 1, unit, onChange }) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm text-slate-600 font-medium">{label}</label>
        <span className="text-sm font-mono text-slate-700 font-medium">
          {Number(value).toLocaleString('de-DE', {
            minimumFractionDigits: step < 1 ? 1 : 0,
            maximumFractionDigits: step < 1 ? 1 : 0,
          })}
          {unit && <span className="text-slate-400 ml-1">{unit}</span>}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-1.5 appearance-none rounded-full bg-slate-200 cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-600 [&::-webkit-slider-thumb]:shadow-lg
            [&::-webkit-slider-thumb]:shadow-primary-600/20 [&::-webkit-slider-thumb]:cursor-pointer
            [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-primary-600 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
          style={{
            background: `linear-gradient(to right, #2563EB ${pct}%, #e2e8f0 ${pct}%)`,
          }}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v >= min && v <= max) onChange(v);
          }}
          className="w-20 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 font-mono text-right
            focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 outline-none transition-all"
        />
      </div>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <section className="card space-y-4">
      <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </section>
  );
}

export default function EinstellungenModule() {
  const { settings, updateSettings, resetSettings, gewerkInfo } = useSettings();

  const handleReset = useCallback(() => {
    if (window.confirm('Alle Einstellungen auf Standardwerte zurücksetzen?')) {
      resetSettings();
    }
  }, [resetSettings]);

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Einstellungen</h1>
          <p className="text-sm text-slate-400 mt-1">
            Kalkulationsparameter, Region und Gewerk konfigurieren
          </p>
        </div>

        <SectionCard title="Kalkulationsparameter">
          <SliderInput
            label="Mittellohn"
            value={settings.mittellohn}
            min={30} max={90} step={0.5} unit="€/h"
            onChange={(v) => updateSettings({ mittellohn: v })}
          />
          <SliderInput
            label="BGK (Baustellengemeinkosten)"
            value={settings.bgk}
            min={0} max={25} step={0.5} unit="%"
            onChange={(v) => updateSettings({ bgk: v })}
          />
          <SliderInput
            label="AGK (Allgemeine Geschäftskosten)"
            value={settings.agk}
            min={0} max={20} step={0.5} unit="%"
            onChange={(v) => updateSettings({ agk: v })}
          />
          <SliderInput
            label="W+G (Wagnis und Gewinn)"
            value={settings.wg}
            min={0} max={15} step={0.5} unit="%"
            onChange={(v) => updateSettings({ wg: v })}
          />
        </SectionCard>

        <SectionCard title="Regionale Voreinstellungen">
          <div className="space-y-2">
            <label className="text-sm text-slate-600 font-medium">Region</label>
            <select
              value={settings.region}
              onChange={(e) => updateSettings({ region: e.target.value })}
              className="input-field"
            >
              {Object.keys(REGION_MITTELLOHN).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="flex items-start gap-2.5 bg-primary-50 border border-primary-100 rounded-xl px-3.5 py-3">
            <Info size={14} className="text-primary-500 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 leading-relaxed">
              Bei Regionswechsel wird der Mittellohn auf den regionstypischen
              Standardwert ({REGION_MITTELLOHN[settings.region]}&nbsp;&euro;/h
              f&uuml;r {settings.region}) gesetzt.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Gewerk">
          <div className="flex flex-wrap gap-2">
            {Object.keys(GEWERK_INFO).map((gw) => {
              const active = settings.gewerk === gw;
              return (
                <button
                  key={gw}
                  onClick={() => updateSettings({ gewerk: gw })}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                    active
                      ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/10'
                      : 'bg-white text-slate-500 border border-slate-200 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {GEWERK_INFO[gw].label}
                </button>
              );
            })}
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-3">
            <p className="text-xs text-slate-500 leading-relaxed">{gewerkInfo.beschreibung}</p>
          </div>
        </SectionCard>

        <SectionCard title="API">
          <div className="space-y-2">
            <label className="text-sm text-slate-600 font-medium">API Key</label>
            <input
              type="password"
              value={settings.apiKey || ''}
              onChange={(e) => updateSettings({ apiKey: e.target.value })}
              placeholder="sk-..."
              className="input-field font-mono"
            />
            <p className="text-xs text-slate-400">Optional &mdash; f&uuml;r direkte API-Nutzung</p>
          </div>

          <button
            onClick={() => updateSettings({ apiKey: settings.apiKey })}
            className="btn-primary"
          >
            <Save size={14} />
            Speichern
          </button>
        </SectionCard>

        <div className="pt-2 pb-8">
          <button onClick={handleReset} className="btn-secondary">
            <RotateCcw size={14} />
            Zur&uuml;cksetzen
          </button>
        </div>
      </div>
    </div>
  );
}
