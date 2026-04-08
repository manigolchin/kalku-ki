import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FolderOpen,
  Plus,
  ArrowLeft,
  Upload,
  FileUp,
  X,
  AlertTriangle,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  listProjects,
  createProject,
  deleteProject,
  setProjectPositions,
} from '../../utils/projectStore';
import { parseGAEB } from '../../utils/gaebParser';
import ProjectCard from './components/ProjectCard';
import ProjectView from './components/ProjectView';

// ---------------------------------------------------------------------------
// Accepted GAEB file extensions
// ---------------------------------------------------------------------------
const GAEB_EXTENSIONS = ['.x83', '.x84', '.d83', '.p83', '.xml'];

function isGaebFile(fileName) {
  if (!fileName) return false;
  const lower = fileName.toLowerCase();
  return GAEB_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// ---------------------------------------------------------------------------
// parseGaebFile - adapter around parseGAEB that maps to position schema
// ---------------------------------------------------------------------------
function parseGaebFile(xmlText, fileName) {
  const raw = parseGAEB(xmlText);
  return raw.map((item) => ({
    oz: item.oz || '',
    short_text: item.text || '',
    long_text: '',
    hinweis_text: '',
    quantity: item.qty || 0,
    unit: item.unit || '',
    material_cost: 0,
    time_minutes: 0,
    nu_cost: 0,
    is_header: false,
    section_path: '',
  }));
}

// ---------------------------------------------------------------------------
// Loading skeleton cards
// ---------------------------------------------------------------------------
function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 animate-pulse"
        >
          <div className="h-4 bg-slate-100 rounded w-3/4" />
          <div className="h-3 bg-slate-100 rounded w-1/2" />
          <div className="flex gap-2 mt-3">
            <div className="h-5 bg-slate-100 rounded w-16" />
            <div className="h-5 bg-slate-100 rounded w-20" />
          </div>
          <div className="flex justify-between mt-4 pt-3 border-t border-slate-100">
            <div className="h-3 bg-slate-100 rounded w-20" />
            <div className="h-3 bg-slate-100 rounded w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation dialog
// ---------------------------------------------------------------------------
function DeleteDialog({ projectName, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-xl border border-slate-200/80 p-6 w-full max-w-sm mx-4 animate-[fade-in_0.15s_ease-out]">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-red-50 border border-red-100 shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-800">
              Projekt l&ouml;schen?
            </h3>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              <span className="font-medium text-slate-700">
                {projectName || 'Dieses Projekt'}
              </span>{' '}
              wird unwiderruflich gel&ouml;scht, einschlie&szlig;lich aller
              Positionen und Kalkulationsdaten.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCancel} className="btn-secondary">
            Abbrechen
          </button>
          <button
            onClick={onConfirm}
            className={clsx(
              'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl',
              'text-sm font-semibold text-white',
              'bg-red-600 hover:bg-red-700 active:bg-red-800',
              'shadow-sm transition-all duration-200 cursor-pointer',
            )}
          >
            L&ouml;schen
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState({ onCreate }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 mb-4">
        <FolderOpen className="w-10 h-10 text-slate-300" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 mt-1">
        Noch keine Projekte
      </h3>
      <p className="text-sm text-slate-400 mt-1.5 max-w-xs">
        Erstellen Sie Ihr erstes Projekt, um mit der Kalkulation zu beginnen.
      </p>
      <button onClick={onCreate} className="btn-primary mt-5">
        <Plus className="w-4 h-4" />
        Neues Projekt anlegen
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GAEB Upload dropzone
// ---------------------------------------------------------------------------
function GaebDropzone({ fileName, onFile, onClear }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const accept = GAEB_EXTENSIONS.join(',');

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && isGaebFile(file.name)) {
      onFile(file);
    } else {
      toast.error('Bitte eine gültige GAEB-Datei auswählen.');
    }
  };

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className="space-y-2">
      <label className="section-label">GAEB-Import (optional)</label>
      {fileName ? (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-primary-50 border border-primary-100">
          <FileUp className="w-5 h-5 text-primary-500 shrink-0" />
          <span className="text-sm text-primary-700 font-medium truncate flex-1">
            {fileName}
          </span>
          <button
            type="button"
            onClick={onClear}
            className="p-1 rounded-lg hover:bg-primary-100 text-primary-400 hover:text-primary-600 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={clsx(
            'flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed',
            'transition-all duration-150 cursor-pointer',
            dragOver
              ? 'border-primary-400 bg-primary-50'
              : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50',
          )}
        >
          <Upload
            className={clsx(
              'w-6 h-6',
              dragOver ? 'text-primary-500' : 'text-slate-400',
            )}
          />
          <p className="text-sm text-slate-500">
            GAEB-Datei hierher ziehen oder{' '}
            <span className="text-primary-600 font-medium">ausw&auml;hlen</span>
          </p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">
            .x83, .x84, .d83, .p83, .xml
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleChange}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NewProject view
// ---------------------------------------------------------------------------
function NewProjectView({ onBack, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    client: '',
    service: '',
    tender_number: '',
    deadline: '',
    bidder: '',
  });
  const [gaebFile, setGaebFile] = useState(null);
  const [gaebFileName, setGaebFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleFileUpload = (file) => {
    setGaebFile(file);
    setGaebFileName(file.name);
  };

  const clearGaebFile = () => {
    setGaebFile(null);
    setGaebFileName('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error('Bitte geben Sie ein Bauvorhaben ein.');
      return;
    }

    setSubmitting(true);

    try {
      const project = createProject(form);

      if (gaebFile) {
        try {
          const text = await gaebFile.text();
          const positions = parseGaebFile(text, gaebFile.name);
          setProjectPositions(project.id, positions);
          toast.success(
            `Projekt erstellt mit ${positions.length} Positionen aus GAEB-Import.`,
          );
        } catch (err) {
          console.error('GAEB parse error:', err);
          toast.error(
            'Projekt erstellt, aber GAEB-Import fehlgeschlagen: ' +
              (err.message || 'Unbekannter Fehler'),
          );
        }
      } else {
        toast.success('Projekt erfolgreich erstellt.');
      }

      onCreated(project.id);
    } catch (err) {
      console.error('Create project error:', err);
      toast.error('Fehler beim Erstellen des Projekts.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className={clsx(
            'p-2 rounded-xl border border-slate-200 bg-white',
            'hover:bg-slate-50 hover:border-slate-300',
            'transition-all duration-150 cursor-pointer',
          )}
        >
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            Neues Projekt
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Projektdaten eingeben und optional GAEB importieren
          </p>
        </div>
      </div>

      {/* Form card */}
      <form onSubmit={handleSubmit} className="card space-y-5">
        {/* Bauvorhaben */}
        <div>
          <label className="section-label mb-1.5 block">
            Bauvorhaben (BV) *
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="z.B. Neubau Mehrfamilienhaus München"
            className="input-field"
            required
          />
        </div>

        {/* AG + Leistung */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="section-label mb-1.5 block">
              Auftraggeber (AG)
            </label>
            <input
              type="text"
              value={form.client}
              onChange={(e) => updateField('client', e.target.value)}
              placeholder="z.B. Bauträger Müller GmbH"
              className="input-field"
            />
          </div>
          <div>
            <label className="section-label mb-1.5 block">Leistung</label>
            <input
              type="text"
              value={form.service}
              onChange={(e) => updateField('service', e.target.value)}
              placeholder="z.B. Elektroinstallation"
              className="input-field"
            />
          </div>
        </div>

        {/* Vergabenummer + Abgabedatum */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="section-label mb-1.5 block">
              Vergabenummer
            </label>
            <input
              type="text"
              value={form.tender_number}
              onChange={(e) => updateField('tender_number', e.target.value)}
              placeholder="z.B. VGN-2026-0042"
              className="input-field"
            />
          </div>
          <div>
            <label className="section-label mb-1.5 block">
              Abgabedatum
            </label>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => updateField('deadline', e.target.value)}
              className="input-field"
            />
          </div>
        </div>

        {/* Bieter */}
        <div>
          <label className="section-label mb-1.5 block">Bieter</label>
          <input
            type="text"
            value={form.bidder}
            onChange={(e) => updateField('bidder', e.target.value)}
            placeholder="z.B. Elektro Schmidt GmbH"
            className="input-field"
          />
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100" />

        {/* GAEB Upload */}
        <GaebDropzone
          fileName={gaebFileName}
          onFile={handleFileUpload}
          onClear={clearGaebFile}
        />

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary min-w-[160px]"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Erstelle...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Projekt erstellen
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard view
// ---------------------------------------------------------------------------
function DashboardView({ projects, loading, onNewProject, onOpenProject, onDeleteProject }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary-50 border border-primary-100">
            <FolderOpen className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Projekte</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {projects.length}{' '}
              {projects.length === 1 ? 'Projekt' : 'Projekte'} vorhanden
            </p>
          </div>
        </div>
        <button onClick={onNewProject} className="btn-primary">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Neues Projekt</span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonCards />
      ) : projects.length === 0 ? (
        <EmptyState onCreate={onNewProject} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={onOpenProject}
              onDelete={onDeleteProject}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ProjekteModule
// ---------------------------------------------------------------------------
export default function ProjekteModule() {
  const [view, setView] = useState('dashboard');
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Load projects whenever we return to dashboard or refreshKey changes
  const loadProjects = useCallback(() => {
    setLoading(true);
    try {
      const data = listProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
      toast.error('Projekte konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'dashboard') {
      loadProjects();
    }
  }, [view, refreshKey, loadProjects]);

  // Navigation handlers
  const handleNewProject = () => setView('new');

  const handleOpenProject = (id) => {
    setActiveProjectId(id);
    setView('project');
  };

  const handleBackToDashboard = () => {
    setActiveProjectId(null);
    setView('dashboard');
  };

  const handleProjectCreated = (id) => {
    setActiveProjectId(id);
    setView('project');
  };

  // Delete flow
  const handleRequestDelete = (id) => {
    const project = projects.find((p) => p.id === id);
    setDeleteTarget(project || { id, name: '' });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    try {
      deleteProject(deleteTarget.id);
      toast.success('Projekt gelöscht.');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error('Delete project error:', err);
      toast.error('Fehler beim Löschen des Projekts.');
    }
    setDeleteTarget(null);
  };

  const handleCancelDelete = () => setDeleteTarget(null);

  // Render based on view
  return (
    <>
      {view === 'dashboard' && (
        <DashboardView
          projects={projects}
          loading={loading}
          onNewProject={handleNewProject}
          onOpenProject={handleOpenProject}
          onDeleteProject={handleRequestDelete}
        />
      )}

      {view === 'new' && (
        <NewProjectView
          onBack={handleBackToDashboard}
          onCreated={handleProjectCreated}
        />
      )}

      {view === 'project' && activeProjectId && (
        <ProjectView
          projectId={activeProjectId}
          onBack={handleBackToDashboard}
          onRefresh={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteDialog
          projectName={deleteTarget.name}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </>
  );
}
