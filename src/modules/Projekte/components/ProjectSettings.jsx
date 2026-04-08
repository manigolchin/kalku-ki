import { useState, useEffect, useMemo } from 'react';
import { Building2, Calculator, Save, Info } from 'lucide-react';
import { updateProjectMeta, updateCalcParams } from '../../../utils/projectStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';

// ---------------------------------------------------------------------------
// Sub-components: NumberField, TextField
// ---------------------------------------------------------------------------

function NumberField({ label, value, onChange, suffix, step = 1, min, readOnly = false, info }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          {label}
        </label>
        {info && (
          <div className="group relative">
            <Info size={12} className="text-slate-300 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-3 py-2 bg-slate-800 text-white text-[11px] rounded-lg shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-20">
              {info}
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45 -mt-1" />
            </div>
          </div>
        )}
      </div>
      <div className="relative">
        <input
          type="number"
          step={step}
          min={min}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          readOnly={readOnly}
          className={clsx(
            'input-field font-mono text-right',
            suffix && 'pr-12',
            readOnly && 'opacity-60 cursor-not-allowed bg-slate-50',
          )}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProjectSettings Component
// ---------------------------------------------------------------------------

export default function ProjectSettings({ project, onUpdate }) {
  // ---- Projektdaten state ----
  const [meta, setMeta] = useState({
    name: '',
    client: '',
    service: '',
    tender_number: '',
    deadline: '',
    bidder: '',
  });

  // ---- Kalkulationsparameter state ----
  const [params, setParams] = useState({
    mittellohn: 30,
    verrechnungslohn: 49.9,
    material_zuschlag: 0.12,
    nu_zuschlag: 0.12,
    geraete_zuschlag_pct: 0.10,
    geraete_stundensatz: 0.50,
    zeitabzug: 0,
    tagesstunden: 8,
    personaleinsatz: 3,
    mwst: 0.19,
  });

  const [savingMeta, setSavingMeta] = useState(false);
  const [savingParams, setSavingParams] = useState(false);

  // Sync state from project prop
  useEffect(() => {
    if (!project) return;
    setMeta({
      name: project.name || '',
      client: project.client || '',
      service: project.service || '',
      tender_number: project.tender_number || '',
      deadline: project.deadline || '',
      bidder: project.bidder || '',
    });
    setParams({
      mittellohn: project.mittellohn ?? 30,
      verrechnungslohn: project.verrechnungslohn ?? 49.9,
      material_zuschlag: project.material_zuschlag ?? 0.12,
      nu_zuschlag: project.nu_zuschlag ?? 0.12,
      geraete_zuschlag_pct: project.geraete_zuschlag_pct ?? 0.10,
      geraete_stundensatz: project.geraete_stundensatz ?? 0.50,
      zeitabzug: project.zeitabzug ?? 0,
      tagesstunden: project.tagesstunden ?? 8,
      personaleinsatz: project.personaleinsatz ?? 3,
      mwst: project.mwst ?? 0.19,
    });
  }, [project]);

  // Computed: Lohn-Zuschlag
  const lohnZuschlag = useMemo(() => {
    if (params.mittellohn <= 0) return 0;
    return ((params.verrechnungslohn / params.mittellohn) - 1) * 100;
  }, [params.mittellohn, params.verrechnungslohn]);

  // Meta field updater
  const setMetaField = (key) => (val) => setMeta((prev) => ({ ...prev, [key]: val }));

  // Param field updater
  const setParam = (key) => (val) => setParams((prev) => ({ ...prev, [key]: val }));

  // Percentage display helpers: stored as decimal, displayed as percent
  const pctValue = (key) => parseFloat((params[key] * 100).toFixed(4));
  const setPctParam = (key) => (displayVal) => {
    setParams((prev) => ({ ...prev, [key]: displayVal / 100 }));
  };

  // ---- Save handlers ----

  const handleSaveMeta = async () => {
    if (!project) return;
    setSavingMeta(true);
    try {
      updateProjectMeta(project.id, meta);
      toast.success('Projektdaten gespeichert');
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error('Fehler beim Speichern: ' + err.message);
    } finally {
      setSavingMeta(false);
    }
  };

  const handleSaveParams = async () => {
    if (!project) return;
    setSavingParams(true);
    try {
      updateCalcParams(project.id, params);
      toast.success('Parameter gespeichert & Kalkulation aktualisiert');
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error('Fehler beim Speichern: ' + err.message);
    } finally {
      setSavingParams(false);
    }
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-slate-400">
        Kein Projekt ausgewählt
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ================================================================= */}
      {/* Section 1: Projektdaten                                           */}
      {/* ================================================================= */}
      <div className="card">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
            <Building2 size={18} className="text-primary-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Projektdaten</h3>
            <p className="text-[11px] text-slate-400">Allgemeine Informationen zum Bauvorhaben</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            label="BV (Bauvorhaben)"
            value={meta.name}
            onChange={setMetaField('name')}
          />
          <TextField
            label="AG (Auftraggeber)"
            value={meta.client}
            onChange={setMetaField('client')}
          />
          <TextField
            label="Leistung"
            value={meta.service}
            onChange={setMetaField('service')}
          />
          <TextField
            label="Vergabenummer"
            value={meta.tender_number}
            onChange={setMetaField('tender_number')}
          />
          <TextField
            label="Abgabedatum"
            value={meta.deadline}
            onChange={setMetaField('deadline')}
            type="date"
          />
          <TextField
            label="Bieter"
            value={meta.bidder}
            onChange={setMetaField('bidder')}
          />
        </div>

        <div className="mt-6">
          <button
            onClick={handleSaveMeta}
            disabled={savingMeta}
            className="btn-primary"
          >
            <Save size={14} />
            {savingMeta ? 'Speichert...' : 'Projektdaten speichern'}
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* Section 2: Kalkulationsparameter                                  */}
      {/* ================================================================= */}
      <div className="card">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
            <Calculator size={18} className="text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Kalkulationsparameter</h3>
            <p className="text-[11px] text-slate-400">Zuschläge, Stundensätze und Berechnungsgrundlagen</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Row 1: Lohn */}
          <NumberField
            label="Mittellohn"
            value={params.mittellohn}
            onChange={setParam('mittellohn')}
            suffix="EUR/h"
            step={0.5}
            min={0}
            info="Durchschnittlicher Bruttolohn der gewerblichen Arbeitnehmer"
          />
          <NumberField
            label="Verrechnungslohn"
            value={params.verrechnungslohn}
            onChange={setParam('verrechnungslohn')}
            suffix="EUR/h"
            step={0.1}
            min={0}
            info="Mittellohn inkl. aller Zuschläge (BGK, AGK, W+G)"
          />
          <NumberField
            label="Lohn-Zuschlag"
            value={parseFloat(lohnZuschlag.toFixed(1))}
            onChange={() => {}}
            suffix="%"
            readOnly
            info="Automatisch berechnet: (Verrechnungslohn / Mittellohn - 1) x 100"
          />

          {/* Row 2: Zuschlaege */}
          <NumberField
            label="Stoffe Zuschlag"
            value={pctValue('material_zuschlag')}
            onChange={setPctParam('material_zuschlag')}
            suffix="%"
            step={0.5}
            min={0}
            info="Zuschlag auf Materialkosten (EK zu VK)"
          />
          <NumberField
            label="NU Zuschlag"
            value={pctValue('nu_zuschlag')}
            onChange={setPctParam('nu_zuschlag')}
            suffix="%"
            step={0.5}
            min={0}
            info="Zuschlag auf Nachunternehmerkosten"
          />
          <NumberField
            label="Geräte Zuschlag"
            value={pctValue('geraete_zuschlag_pct')}
            onChange={setPctParam('geraete_zuschlag_pct')}
            suffix="%"
            step={0.5}
            min={0}
            info="Zuschlag auf Gerätekosten"
          />

          {/* Row 3: Stundensatz, Zeitabzug, Std/Tag */}
          <NumberField
            label="Geräte-Stundensatz"
            value={params.geraete_stundensatz}
            onChange={setParam('geraete_stundensatz')}
            suffix="EUR/h"
            step={0.1}
            min={0}
          />
          <NumberField
            label="Zeitabzug"
            value={params.zeitabzug}
            onChange={setParam('zeitabzug')}
            suffix="%"
            step={0.5}
            info="Prozentualer Zeitabzug auf Aufwandswerte"
          />
          <NumberField
            label="Std./Tag"
            value={params.tagesstunden}
            onChange={setParam('tagesstunden')}
            suffix="h"
            step={0.5}
            min={1}
            info="Arbeitsstunden pro Tag für Tagesberechnung"
          />

          {/* Row 4: Personal, MwSt */}
          <NumberField
            label="Personaleinsatz"
            value={params.personaleinsatz}
            onChange={setParam('personaleinsatz')}
            suffix="Pers."
            step={1}
            min={1}
            info="Anzahl eingesetzter Personen (für Tagesberechnung)"
          />
          <NumberField
            label="MwSt."
            value={pctValue('mwst')}
            onChange={setPctParam('mwst')}
            suffix="%"
            step={1}
            min={0}
            info="Mehrwertsteuersatz (gesetzlich 19%)"
          />
        </div>

        <div className="mt-6">
          <button
            onClick={handleSaveParams}
            disabled={savingParams}
            className={clsx(
              'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl',
              'text-sm font-semibold text-white cursor-pointer',
              'bg-amber-500 hover:bg-amber-600 active:bg-amber-700',
              'shadow-sm shadow-amber-500/10',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
            )}
          >
            <Calculator size={14} />
            {savingParams ? 'Speichert...' : 'Parameter speichern & neu berechnen'}
          </button>
        </div>
      </div>
    </div>
  );
}
