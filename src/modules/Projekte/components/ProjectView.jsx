import { useState, useCallback, useMemo } from 'react';
import { ArrowLeft, Table2, BarChart3, Settings, Upload, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { getProject, setProjectPositions, updateProjectMeta } from '../../../utils/projectStore';
import { enrichPosition, calculateProjectSummary } from '../../../utils/projectCalc';
import { parseGAEB, parseGAEBMeta } from '../../../utils/gaebParser';
import ProjectHeader from './ProjectHeader';
import PositionTable from './PositionTable';
import CostBreakdown from './CostBreakdown';
import ProjectSettings from './ProjectSettings';

const TABS = [
  { id: 'positionen', label: 'Positionen', icon: Table2 },
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
