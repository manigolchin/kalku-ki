import { useState, useCallback, useMemo, useRef } from 'react';
import { ArrowLeft, Table2, BarChart3, Settings, Upload, Loader2, Zap, CheckCircle2, AlertTriangle, XCircle, FileText, Download } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { getProject, setProjectPositions, updateProjectMeta } from '../../../utils/projectStore';
import { enrichPosition, calculateProjectSummary } from '../../../utils/projectCalc';
import { parseGAEB, parseGAEBMeta } from '../../../utils/gaebParser';
import { autoCalculate } from '../../../engine/autoCalc';
// SIRADOS DEAKTIVIERT (CLAUDE.md v1.3 Preisquellen-Policy)
// import { loadSiradosData, isSiradosLoaded } from '../../../engine/siradosSearch';
import { getAngebote } from '../../../engine/angebotExtractor';
import { matchAngeboteToLV, selectBestSuppliers, buildPriceMap } from '../../../engine/supplierMatcher';
import { log, logError } from '../../../engine/logger';
import { exportLV3 } from '../../../utils/excelExport';
import ProjectHeader from './ProjectHeader';
import PositionTable from './PositionTable';
import CostBreakdown from './CostBreakdown';
import ProjectSettings from './ProjectSettings';
import AngebotPanel from './AngebotPanel';

const TABS = [
  { id: 'positionen', label: 'Positionen', icon: Table2 },
  { id: 'angebote', label: 'Angebote', icon: FileText },
  { id: 'kosten', label: 'Kostenübersicht', icon: BarChart3 },
  { id: 'einstellungen', label: 'Einstellungen', icon: Settings },
];

function TabNav({ activeTab, onTabChange }) {
  return (
    <div className="flex border-b border-gray-200">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={clsx(
              'inline-flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-all duration-200',
              isActive
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default function ProjectView({ projectId, onBack, onRefresh }) {
  const [activeTab, setActiveTab] = useState('positionen');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [autoCalcRunning, setAutoCalcRunning] = useState(false);
  const [autoCalcProgress, setAutoCalcProgress] = useState(null);
  const [autoCalcResult, setAutoCalcResult] = useState(null);
  const [priceMap, setPriceMap] = useState({});
  const priceMapRef = useRef(priceMap);
  priceMapRef.current = priceMap;

  // Load project from store
  const project = useMemo(() => {
    return getProject(projectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, refreshKey]);

  // Derive calc params from project
  const calcParams = useMemo(() => {
    if (!project) return null;
    return {
      mittellohn: project.mittellohn,
      verrechnungslohn: project.verrechnungslohn,
      material_zuschlag: project.material_zuschlag,
      nu_zuschlag: project.nu_zuschlag,
      geraete_zuschlag_pct: project.geraete_zuschlag_pct,
      geraete_stundensatz: project.geraete_stundensatz,
      zeitabzug: project.zeitabzug,
      tagesstunden: project.tagesstunden,
      personaleinsatz: project.personaleinsatz,
      mwst: project.mwst,
    };
  }, [project]);

  // Enrich positions with calculations
  const enrichedPositions = useMemo(() => {
    if (!project || !calcParams) return [];
    return (project.positions || []).map((pos) => enrichPosition(pos, calcParams));
  }, [project, calcParams]);

  // Calculate summary
  const summary = useMemo(() => {
    if (!calcParams || enrichedPositions.length === 0) return null;
    return calculateProjectSummary(enrichedPositions, calcParams);
  }, [enrichedPositions, calcParams]);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    if (onRefresh) onRefresh();
  }, [onRefresh]);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    if (tab === 'einstellungen') {
      setSettingsOpen(true);
    } else {
      setSettingsOpen(false);
    }
  }, []);

  const handleToggleSettings = useCallback(() => {
    if (settingsOpen) {
      setSettingsOpen(false);
      setActiveTab('positionen');
    } else {
      setSettingsOpen(true);
      setActiveTab('einstellungen');
    }
  }, [settingsOpen]);

  const handleUploadGaeb = useCallback(async (file) => {
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseGAEB(buffer, file.name);
      if (!parsed || parsed.length === 0) {
        toast.error('Keine Positionen in der GAEB-Datei gefunden');
        return;
      }
      // Map to position schema
      const positions = parsed.map((p, i) => ({
        oz: p.oz || '',
        short_text: p.text || p.short_text || '',
        long_text: p.longText || p.long_text || '',
        hinweis_text: '',
        quantity: parseFloat(p.qty || p.quantity || 0) || 0,
        unit: p.unit || '',
        material_cost: 0,
        time_minutes: 0,
        nu_cost: 0,
        is_header: p.isHeader || p.is_header || false,
        sort_order: i,
        section_path: p.section || '',
      }));
      setProjectPositions(projectId, positions);

      // Auto-fill project metadata from GAEB if fields are empty
      try {
        const meta = parseGAEBMeta(buffer, file.name);
        const updates = {};
        if (meta.name && !project.name) updates.name = meta.name;
        if (meta.client && !project.client) updates.client = meta.client;
        if (meta.service && !project.service) updates.service = meta.service;
        if (Object.keys(updates).length > 0) {
          updateProjectMeta(projectId, updates);
        }
      } catch { /* ignore metadata errors */ }

      triggerRefresh();
      toast.success(`${positions.filter((p) => !p.is_header).length} Positionen importiert`);
    } catch (err) {
      console.error('GAEB import error:', err);
      toast.error('Fehler beim Importieren der GAEB-Datei');
    }
  }, [projectId, triggerRefresh]);

  // ─── Auto-Calculate Handler ────────────────────────────────
  const handleAutoCalc = useCallback(async (overridePriceMap) => {
    if (!project || !project.positions || project.positions.length === 0) {
      toast.error('Keine Positionen vorhanden');
      return;
    }

    // Auto-build priceMap from stored Angebote if not provided
    let activePriceMap = overridePriceMap || priceMapRef.current || {};

    const angebote = getAngebote(projectId);
    const priceCount = Object.keys(activePriceMap).length;
    log('projectView', `Auto-Kalkulieren gestartet`, {
      positionen: project.positions.length,
      angebote: angebote.length,
      existingPriceMap: priceCount,
    });

    if (priceCount === 0 && angebote.length > 0) {
      log('projectView', `PriceMap leer → baue aus ${angebote.length} Angeboten`);
      const { matches, supplierGroups } = matchAngeboteToLV(angebote, project.positions);
      const { bestSuppliers } = selectBestSuppliers(supplierGroups);
      activePriceMap = buildPriceMap(bestSuppliers, matches, project.positions, angebote);
      setPriceMap(activePriceMap);
      priceMapRef.current = activePriceMap;
      log('projectView', `PriceMap gebaut: ${Object.keys(activePriceMap).length} Preise`);
    }

    setAutoCalcRunning(true);
    setAutoCalcResult(null);
    setAutoCalcProgress({ step: 'start', current: 0, total: project.positions.length });

    try {
      // SIRADOS DEAKTIVIERT (CLAUDE.md v1.3 Preisquellen-Policy)
      // Waterfall: Angebote → PDB → KB erfahrungspreise → Web (rot)

      // Run auto-calculation
      const result = await autoCalculate(project.positions, {
        params: {
          stundensatz: 72.51,
          zuschlag_material: 0.20,
          zuschlag_nu: 0.20,
          geraete_default: 0.50,
        },
        priceMap: activePriceMap,
        useSirados: false, // DEAKTIVIERT
        onProgress: (step, current, total) => {
          setAutoCalcProgress({ step, current, total });
        },
      });

      // Save ALL calculated values to store (replaces positions with full calc results)
      setProjectPositions(projectId, result.positions);
      log('projectView', `Alle ${result.positions.length} Positionen gespeichert`);

      setAutoCalcResult(result);
      triggerRefresh();

      const { stats } = result;
      if (stats.plausi_passed) {
        toast.success(
          `${stats.classified} Positionen kalkuliert — 0 Fehler`,
          { duration: 5000 }
        );
      } else {
        toast(
          `${stats.classified} kalkuliert, ${stats.plausi_fails} Fehler, ${stats.plausi_warns} Warnungen`,
          { icon: '⚠️', duration: 5000 }
        );
      }
    } catch (err) {
      logError('projectView', `Auto-Kalkulation Fehler: ${err.message}`, { stack: err.stack });
      toast.error(`Fehler: ${err.message}`);
    } finally {
      setAutoCalcRunning(false);
      setAutoCalcProgress(null);
    }
  }, [project, projectId, triggerRefresh]);

  if (!project) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </button>
        <div className="rounded-xl border border-red-200 bg-red-50 p-10 text-center">
          <p className="text-base font-medium text-red-700">
            Projekt konnte nicht geladen werden
          </p>
          <button
            onClick={onBack}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
          >
            Zur Übersicht
          </button>
        </div>
      </div>
    );
  }

  const hasPositions = enrichedPositions.length > 0;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-gray-500 transition-colors duration-200 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Zurück zur Übersicht
      </button>

      {/* Project Header */}
      <ProjectHeader
        project={project}
        enrichedPositions={enrichedPositions}
        summary={summary}
        onToggleSettings={handleToggleSettings}
        settingsOpen={settingsOpen}
        onUploadGaeb={handleUploadGaeb}
      />

      {/* Auto-Kalkulieren Button + Results */}
      {hasPositions && (
        <div className="space-y-3">
          {/* Action Bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => handleAutoCalc()}
              disabled={autoCalcRunning}
              className={clsx(
                'inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm transition-all duration-200',
                autoCalcRunning
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 hover:shadow-md'
              )}
            >
              {autoCalcRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Kalkuliere...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Auto-Kalkulieren
                </>
              )}
            </button>

            {autoCalcResult && (
              <button
                onClick={() => {
                  try {
                    const filename = exportLV3(
                      autoCalcResult.positions,
                      project.name || 'Projekt',
                      autoCalcResult.summary,
                      autoCalcResult.plausi
                    );
                    toast.success(`LV3 exportiert: ${filename}`);
                  } catch (err) {
                    toast.error(`Export-Fehler: ${err.message}`);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-all duration-200"
              >
                <Download className="h-4 w-4" />
                LV3 Export
              </button>
            )}

            {autoCalcProgress && (
              <span className="text-sm text-gray-500">
                {autoCalcProgress.step === 'classify' && 'Klassifiziere Positionen...'}
                {autoCalcProgress.step === 'calculate' && 'Berechne...'}
                {autoCalcProgress.step === 'sirados' && 'Preisquellen-Check...'}
                {autoCalcProgress.step === 'ai_analyse' && 'KI analysiert unbekannte Positionen...'}
                {autoCalcProgress.step === 'ai_done' && 'KI-Analyse abgeschlossen'}
                {autoCalcProgress.step === 'plausi' && 'Plausibilitätsprüfung...'}
                {autoCalcProgress.step === 'done' && 'Fertig!'}
              </span>
            )}
          </div>

          {/* Results Panel */}
          {autoCalcResult && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-4 flex-wrap">
                {/* Stats */}
                <div className="flex items-center gap-2">
                  {autoCalcResult.stats.plausi_passed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  )}
                  <span className="text-sm font-medium">
                    {autoCalcResult.stats.classified}/{autoCalcResult.stats.totalPositions} klassifiziert
                    ({autoCalcResult.stats.classificationRate}%)
                  </span>
                </div>

                <div className="flex gap-4 text-xs text-gray-600">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-green-400" />
                    Angebote: {autoCalcResult.stats.withAngebot}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-yellow-400" />
                    KB/PDB: {autoCalcResult.stats.withSirados || 0}
                  </span>
                  {autoCalcResult.stats.withAI > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-purple-400" />
                      KI: {autoCalcResult.stats.withAI}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-red-400" />
                    Fehlend: {autoCalcResult.stats.missingPrices}
                  </span>
                </div>

                <div className="flex gap-3 text-xs">
                  {autoCalcResult.stats.plausi_fails > 0 && (
                    <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                      <XCircle className="h-3.5 w-3.5" />
                      {autoCalcResult.stats.plausi_fails} FAIL
                    </span>
                  )}
                  {autoCalcResult.stats.plausi_warns > 0 && (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {autoCalcResult.stats.plausi_warns} WARN
                    </span>
                  )}
                  {autoCalcResult.stats.plausi_passed && (
                    <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      0 FAIL
                    </span>
                  )}
                </div>

                <div className="ml-auto text-xs text-gray-400">
                  {autoCalcResult.stats.duration_ms}ms
                </div>
              </div>

              {/* Summary line */}
              <div className="mt-3 flex gap-6 text-sm border-t border-gray-100 pt-3">
                <span>
                  <span className="text-gray-500">Netto: </span>
                  <span className="font-semibold">
                    {autoCalcResult.summary.totalGP.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </span>
                </span>
                <span className="text-gray-400">
                  Lohn {autoCalcResult.summary.anteil_lohn}% |
                  Material {autoCalcResult.summary.anteil_material}% |
                  Gerät {autoCalcResult.summary.anteil_geraet}% |
                  NU {autoCalcResult.summary.anteil_nu}%
                </span>
              </div>

              {/* Project-level warnings */}
              {autoCalcResult.projectChecks?.length > 0 && (
                <div className="mt-3 space-y-1 border-t border-gray-100 pt-3">
                  {autoCalcResult.projectChecks.map((check, i) => (
                    <div key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      {check.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab navigation + content */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <TabNav activeTab={activeTab} onTabChange={handleTabChange} />

        <div className="p-4 sm:p-6">
          {/* Positionen Tab */}
          {activeTab === 'positionen' && (
            <>
              {hasPositions ? (
                <PositionTable
                  positions={enrichedPositions}
                  projectId={projectId}
                  onUpdate={triggerRefresh}
                />
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 px-6 py-16">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
                      <Upload className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-gray-900">
                      Noch keine Positionen
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Laden Sie eine GAEB-Datei hoch oder fügen Sie Positionen manuell hinzu.
                    </p>
                    <label className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm cursor-pointer transition-all duration-200 hover:bg-blue-600">
                      <Upload className="h-4 w-4" />
                      GAEB-Datei hochladen
                      <input
                        type="file"
                        className="hidden"
                        accept=".x83,.x84,.d83,.p83,.xml"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadGaeb(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Angebote Tab */}
          {activeTab === 'angebote' && (
            <AngebotPanel
              projectId={projectId}
              positions={project.positions || []}
              onPriceMapReady={(map) => {
                setPriceMap(map);
                priceMapRef.current = map;
                setActiveTab('positionen');
                log('projectView', `Preise übernommen: ${Object.keys(map).length} → starte Auto-Kalkulieren`);
                // Directly trigger calculation with the priceMap
                setTimeout(() => handleAutoCalc(map), 200);
              }}
            />
          )}

          {/* Kostenübersicht Tab */}
          {activeTab === 'kosten' && (
            <>
              {summary ? (
                <CostBreakdown summary={summary} />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <BarChart3 className="h-12 w-12 mb-3" />
                  <p className="text-sm font-medium">Keine Daten vorhanden</p>
                  <p className="text-xs mt-1">Fügen Sie Positionen hinzu, um die Kostenübersicht zu sehen.</p>
                </div>
              )}
            </>
          )}

          {/* Einstellungen Tab */}
          {activeTab === 'einstellungen' && (
            <ProjectSettings project={project} onUpdate={triggerRefresh} />
          )}
        </div>
      </div>
    </div>
  );
}
