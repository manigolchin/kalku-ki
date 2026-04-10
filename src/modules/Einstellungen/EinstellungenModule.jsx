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

        <SectionCard title="Leitfaden-Grundwerte (Kalkulations_Leitfaden &sect;0)">
          <SliderInput
            label="Stundensatz (Verrechnungslohn)"
            value={settings.stundensatz || 72.51}
            min={40} max={120} step={0.01} unit="&euro;/h"
            onChange={(v) => updateSettings({ stundensatz: v })}
          />
          <SliderInput
            label="Zuschlag Material"
            value={settings.zuschlag_material || 20}
            min={0} max={50} step={1} unit="%"
            onChange={(v) => updateSettings({ zuschlag_material: v })}
          />
          <SliderInput
            label="Zuschlag NU"
            value={settings.zuschlag_nu || 20}
            min={0} max={50} step={1} unit="%"
            onChange={(v) => updateSettings({ zuschlag_nu: v })}
          />
          <SliderInput
            label="Ger&auml;te-Default"
            value={settings.geraete_default || 0.50}
            min={0} max={5} step={0.10} unit="&euro;/h"
            onChange={(v) => updateSettings({ geraete_default: v })}
          />
        </SectionCard>

        <SectionCard title="&sect;1 Baustelleneinrichtung">
          <SliderInput
            label="BE einrichten (Y)"
            value={settings.be_einrichten_Y || 1800}
            min={300} max={3600} step={60} unit="min"
            onChange={(v) => updateSettings({ be_einrichten_Y: v })}
          />
          <SliderInput
            label="BE einrichten (Z)"
            value={settings.be_einrichten_Z || 50}
            min={5} max={100} step={5} unit="&euro;/h"
            onChange={(v) => updateSettings({ be_einrichten_Z: v })}
          />
          <SliderInput
            label="BE r&auml;umen (Y)"
            value={settings.be_raeumen_Y || 600}
            min={60} max={1800} step={60} unit="min"
            onChange={(v) => updateSettings({ be_raeumen_Y: v })}
          />
          <SliderInput
            label="BE vorhalten (Y pro Tag)"
            value={settings.be_vorhalten_Y_tag || 10}
            min={0} max={60} step={5} unit="min"
            onChange={(v) => updateSettings({ be_vorhalten_Y_tag: v })}
          />
        </SectionCard>

        <SectionCard title="&sect;2-3 Erdarbeiten &amp; Sch&uuml;ttg&uuml;ter">
          <SliderInput
            label="Aushub Gro&szlig;maschine (Y)"
            value={settings.aushub_gross_Y || 2}
            min={1} max={10} step={0.5} unit="min/m&sup3;"
            onChange={(v) => updateSettings({ aushub_gross_Y: v })}
          />
          <SliderInput
            label="Aushub Handarbeit (Y min)"
            value={settings.aushub_hand_Y_min || 240}
            min={60} max={600} step={30} unit="min/m&sup3;"
            onChange={(v) => updateSettings({ aushub_hand_Y_min: v })}
          />
          <SliderInput
            label="Sch&uuml;ttgut gro&szlig;fl. (Y)"
            value={settings.schuett_gross_Y || 3}
            min={1} max={15} step={0.5} unit="min/m&sup3;"
            onChange={(v) => updateSettings({ schuett_gross_Y: v })}
          />
          <SliderInput
            label="Kleinmenge Schwelle"
            value={settings.schuett_klein_schwelle || 200}
            min={50} max={500} step={25} unit="m&sup2;"
            onChange={(v) => updateSettings({ schuett_klein_schwelle: v })}
          />
        </SectionCard>

        <SectionCard title="&sect;4-5 Pflaster/Bord/Beton/Abbruch">
          <SliderInput
            label="Pflaster verlegen (Y)"
            value={settings.pflaster_Y || 25}
            min={15} max={60} step={1} unit="min/m&sup2;"
            onChange={(v) => updateSettings({ pflaster_Y: v })}
          />
          <SliderInput
            label="Bordstein setzen (Y)"
            value={settings.bordstein_Y || 15}
            min={8} max={30} step={1} unit="min/lfm"
            onChange={(v) => updateSettings({ bordstein_Y: v })}
          />
          <SliderInput
            label="Beton Kleinmenge"
            value={settings.beton_klein_preis || 200}
            min={100} max={400} step={10} unit="&euro;/m&sup3;"
            onChange={(v) => updateSettings({ beton_klein_preis: v })}
          />
          <SliderInput
            label="Abbruch Asphalt (Y)"
            value={settings.abbruch_asphalt_Y || 15}
            min={5} max={30} step={1} unit="min/m&sup3;"
            onChange={(v) => updateSettings({ abbruch_asphalt_Y: v })}
          />
        </SectionCard>

        <SectionCard title="&sect;6 Pflanzen/B&auml;ume">
          <SliderInput
            label="Hochstamm pflanzen (Y)"
            value={settings.baum_pflanzen_Y || 120}
            min={60} max={300} step={10} unit="min/St"
            onChange={(v) => updateSettings({ baum_pflanzen_Y: v })}
          />
          <SliderInput
            label="Hecke setzen (Y)"
            value={settings.hecke_Y || 4}
            min={2} max={15} step={1} unit="min/St"
            onChange={(v) => updateSettings({ hecke_Y: v })}
          />
          <SliderInput
            label="Spielger&auml;t (Z)"
            value={settings.spielgeraet_Z || 5}
            min={0} max={25} step={1} unit="&euro;/h"
            onChange={(v) => updateSettings({ spielgeraet_Z: v })}
          />
          <SliderInput
            label="Schneiden Pflaster (Y)"
            value={settings.schneiden_pflaster_Y_m2 || 187}
            min={100} max={400} step={5} unit="min/m&sup2;"
            onChange={(v) => updateSettings({ schneiden_pflaster_Y_m2: v })}
          />
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
