import { useState } from 'react';
import {
  Download,
  Settings,
  Calendar,
  Hash,
  Briefcase,
  FileSpreadsheet,
  Euro,
  Upload,
  Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { fmt, exportProjectToExcel } from '../../../utils/projectCalc';

export default function ProjectHeader({
  project,
  enrichedPositions,
  summary,
  onToggleSettings,
  settingsOpen,
  onUploadGaeb,
}) {
  const [exporting, setExporting] = useState(false);
  const dataPositions = (project.positions || []).filter((p) => !p.is_header);

  const handleExport = async () => {
    if (!summary || !enrichedPositions) return;
    setExporting(true);
    try {
      await exportProjectToExcel(project, enrichedPositions, summary);
      toast.success('Excel-Export heruntergeladen');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Fehler beim Exportieren');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        {/* Left: Title and info */}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-gray-900 truncate">
            {project.name || 'Unbenanntes Projekt'}
          </h1>
          {project.client && (
            <p className="mt-1 text-base text-gray-500">{project.client}</p>
          )}

          {/* Badges */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {project.service && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                <Briefcase className="h-3 w-3" />
                {project.service}
              </span>
            )}
            {project.tender_number && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                <Hash className="h-3 w-3" />
                {project.tender_number}
              </span>
            )}
            {project.deadline && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                <Calendar className="h-3 w-3" />
                {new Date(project.deadline).toLocaleDateString('de-DE')}
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="ml-6 flex items-center gap-2">
          {/* GAEB Upload */}
          <label className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 cursor-pointer transition-all duration-200 hover:bg-gray-50">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">GAEB</span>
            <input
              type="file"
              className="hidden"
              accept=".x83,.x84,.d83,.p83,.xml"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadGaeb(file);
                e.target.value = '';
              }}
            />
          </label>

          {/* Settings toggle */}
          <button
            onClick={onToggleSettings}
            className={clsx(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-200',
              settingsOpen
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            )}
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Einstellungen</span>
          </button>

          {/* Excel Export */}
          <button
            onClick={handleExport}
            disabled={exporting || !summary}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-emerald-600 disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {exporting ? 'Export...' : 'Excel'}
            </span>
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-gray-100 pt-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
            <FileSpreadsheet className="h-5 w-5 text-gray-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Positionen</p>
            <p className="text-lg font-semibold tabular-nums text-gray-900">
              {dataPositions.length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
            <Euro className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Netto</p>
            <p className="text-lg font-semibold tabular-nums text-gray-900">
              {summary ? fmt.currency(summary.netto) : '--'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
            <Euro className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Brutto</p>
            <p className="text-lg font-semibold tabular-nums text-gray-900">
              {summary ? fmt.currency(summary.brutto) : '--'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
            <Euro className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Überschuss</p>
            <p className={clsx(
              'text-lg font-semibold tabular-nums',
              summary && summary.ueberschuss >= 0 ? 'text-emerald-600' : 'text-red-600'
            )}>
              {summary ? fmt.currency(summary.ueberschuss) : '--'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
