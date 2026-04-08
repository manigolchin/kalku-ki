import { useState, useMemo } from 'react';
import { Ruler, ArrowRightLeft, Mountain } from 'lucide-react';
import {
  calculateFlaeche,
  convertVolumeMass,
  calculateAuflockerung,
} from '../../utils/kalkulation';

const MATERIALIEN = [
  { key: 'beton', label: 'Beton', dichte: 2.4 },
  { key: 'asphalt', label: 'Asphalt', dichte: 2.4 },
  { key: 'kies', label: 'Kies', dichte: 1.8 },
  { key: 'sand', label: 'Sand', dichte: 1.5 },
  { key: 'erde', label: 'Erde gewachsen', dichte: 1.8 },
  { key: 'mutterboden', label: 'Mutterboden', dichte: 1.6 },
];

const BODENKLASSEN = [
  { key: '1-2', label: 'Klasse 1-2 (Oberboden, fließend)', faktor: 1.05 },
  { key: '3', label: 'Klasse 3 (leicht lösbar)', faktor: 1.10 },
  { key: '4-5', label: 'Klasse 4-5 (mittel/schwer lösbar)', faktor: 1.22 },
  { key: '6-7', label: 'Klasse 6-7 (Fels)', faktor: 1.37 },
];

export default function MassenRechner() {
  const [laenge, setLaenge] = useState('');
  const [breite, setBreite] = useState('');
  const [schichtdicke, setSchichtdicke] = useState('');
  const [convValue, setConvValue] = useState('');
  const [convUnit, setConvUnit] = useState('m3');
  const [convMaterial, setConvMaterial] = useState('beton');
  const [aufVol, setAufVol] = useState('');
  const [bodenklasse, setBodenklasse] = useState('3');

  const num = (v) => parseFloat(v) || 0;

  const flaeche = useMemo(() => {
    return calculateFlaeche(num(laenge), num(breite), num(schichtdicke) / 100);
  }, [laenge, breite, schichtdicke]);

  const convResult = useMemo(() => {
    const val = num(convValue);
    if (val <= 0) return null;
    const toUnit = convUnit === 'm3' ? 't' : 'm3';
    try {
      const result = convertVolumeMass(val, convUnit, toUnit, convMaterial);
      const mat = MATERIALIEN.find((m) => m.key === convMaterial);
      return { value: result, toUnit, dichte: mat?.dichte || 0 };
    } catch {
      return null;
    }
  }, [convValue, convUnit, convMaterial]);

  const aufResult = useMemo(() => {
    const vol = num(aufVol);
    if (vol <= 0) return null;
    try {
      const result = calculateAuflockerung(vol, bodenklasse);
      const bk = BODENKLASSEN.find((b) => b.key === bodenklasse);
      return { value: result, faktor: bk?.faktor || 1 };
    } catch {
      return null;
    }
  }, [aufVol, bodenklasse]);

  return (
    <div className="space-y-6">
      {/* Section 1: Area */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Ruler className="w-4 h-4 text-primary-500" />
          <h3 className="text-sm font-semibold text-slate-800">Flächenberechnung</h3>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <Field label="Länge (m)">
            <input type="number" step="0.01" min="0" value={laenge} onChange={(e) => setLaenge(e.target.value)} placeholder="0,00" className="input-field" />
          </Field>
          <Field label="Breite (m)">
            <input type="number" step="0.01" min="0" value={breite} onChange={(e) => setBreite(e.target.value)} placeholder="0,00" className="input-field" />
          </Field>
          <Field label="Schichtdicke (cm)">
            <input type="number" step="0.5" min="0" value={schichtdicke} onChange={(e) => setSchichtdicke(e.target.value)} placeholder="0" className="input-field" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ResultBox label="Fläche" value={flaeche.flaeche_m2} unit="m²" active={flaeche.flaeche_m2 > 0} />
          <ResultBox label="Volumen" value={flaeche.volumen_m3} unit="m³" active={flaeche.volumen_m3 > 0} />
        </div>
      </div>

      {/* Section 2: Volume <-> Mass */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <ArrowRightLeft className="w-4 h-4 text-primary-500" />
          <h3 className="text-sm font-semibold text-slate-800">Volumen &#8596; Masse</h3>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <Field label="Wert">
            <input type="number" step="0.01" min="0" value={convValue} onChange={(e) => setConvValue(e.target.value)} placeholder="0,00" className="input-field" />
          </Field>
          <Field label="Einheit">
            <select value={convUnit} onChange={(e) => setConvUnit(e.target.value)} className="input-field">
              <option value="m3">m³ (Volumen)</option>
              <option value="t">t (Masse)</option>
            </select>
          </Field>
          <Field label="Material">
            <select value={convMaterial} onChange={(e) => setConvMaterial(e.target.value)} className="input-field">
              {MATERIALIEN.map((m) => (
                <option key={m.key} value={m.key}>{m.label} ({m.dichte} t/m³)</option>
              ))}
            </select>
          </Field>
        </div>

        {convResult && (
          <div className="flex items-center gap-4">
            <ResultBox label={`Ergebnis (${convResult.toUnit === 't' ? 'Masse' : 'Volumen'})`} value={convResult.value} unit={convResult.toUnit} active />
            <div className="text-xs text-slate-400 self-end pb-3">Dichte: {convResult.dichte} t/m³</div>
          </div>
        )}
        {!convResult && num(convValue) <= 0 && (
          <p className="text-xs text-slate-400">Wert eingeben, um die Umrechnung zu starten.</p>
        )}
      </div>

      {/* Section 3: Auflockerung */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Mountain className="w-4 h-4 text-primary-500" />
          <h3 className="text-sm font-semibold text-slate-800">Auflockerungsfaktor</h3>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field label="Volumen gewachsen (m³)">
            <input type="number" step="0.01" min="0" value={aufVol} onChange={(e) => setAufVol(e.target.value)} placeholder="0,00" className="input-field" />
          </Field>
          <Field label="Bodenklasse (DIN 18300)">
            <select value={bodenklasse} onChange={(e) => setBodenklasse(e.target.value)} className="input-field">
              {BODENKLASSEN.map((bk) => (
                <option key={bk.key} value={bk.key}>{bk.label}</option>
              ))}
            </select>
          </Field>
        </div>

        {aufResult && (
          <div className="flex items-center gap-4">
            <ResultBox label="Volumen gelöst" value={aufResult.value} unit="m³" active />
            <div className="text-xs text-slate-400 self-end pb-3">Faktor: {aufResult.faktor}x</div>
          </div>
        )}
        {!aufResult && num(aufVol) <= 0 && (
          <p className="text-xs text-slate-400">Gewachsenes Volumen eingeben, um das gelöste Volumen zu berechnen.</p>
        )}
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

function ResultBox({ label, value, unit, active }) {
  return (
    <div className={`rounded-xl p-3.5 border ${active ? 'border-primary-100 bg-primary-50' : 'border-slate-200/80 bg-slate-50'}`}>
      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-1">{label}</p>
      <p className="font-mono text-lg font-bold text-primary-700">
        {active
          ? Number(value).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 3 })
          : '0,00'}
        <span className="text-sm text-slate-400 ml-1 font-normal">{unit}</span>
      </p>
    </div>
  );
}
