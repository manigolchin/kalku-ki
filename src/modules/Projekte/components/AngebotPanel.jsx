import { useState, useCallback, useMemo } from 'react';
import { Upload, FileText, Loader2, CheckCircle2, AlertTriangle, Trash2, ChevronDown, ChevronRight, Trophy, X } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  extractAngebot, saveAngebot, getAngebote, deleteAngebot, hasApiKey, setApiKey,
} from '../../../engine/angebotExtractor';
import {
  matchAngeboteToLV, selectBestSuppliers, buildPriceMap, getSupplierSummary,
} from '../../../engine/supplierMatcher';

export default function AngebotPanel({ projectId, positions, onPriceMapReady }) {
  const [angebote, setAngebote] = useState(() => getAngebote(projectId));
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [expandedAngebot, setExpandedAngebot] = useState(null);
  const [showApiKeyInput, setShowApiKeyInput] = useState(!hasApiKey());
  const [apiKeyInput, setApiKeyInput] = useState('');

  // ─── Supplier comparison ────────────────────────────────────
  const analysis = useMemo(() => {
    if (angebote.length === 0 || !positions || positions.length === 0) return null;
    const { matches, supplierGroups } = matchAngeboteToLV(angebote, positions);
    const { bestSuppliers, comparison } = selectBestSuppliers(supplierGroups);
    const priceMap = buildPriceMap(bestSuppliers, matches, positions, angebote);
    const summary = getSupplierSummary(comparison);
    return { matches, bestSuppliers, comparison, priceMap, summary };
  }, [angebote, positions]);

  // ─── API Key setup ──────────────────────────────────────────
  const handleSaveApiKey = useCallback(() => {
    if (!apiKeyInput.trim()) return;
    setApiKey(apiKeyInput.trim());
    setShowApiKeyInput(false);
    setApiKeyInput('');
    toast.success('API Key gespeichert');
  }, [apiKeyInput]);

  // ─── File upload handler ────────────────────────────────────
  const handleFiles = useCallback(async (files) => {
    if (!hasApiKey()) {
      setShowApiKeyInput(true);
      toast.error('Bitte zuerst Claude API Key eingeben');
      return;
    }

    setUploading(true);
    let successCount = 0;
    const total = files.length;

    for (let idx = 0; idx < files.length; idx++) {
      const file = files[idx];
      try {
        setProgress({ step: 'upload', file: file.name, current: idx + 1, total });

        const extracted = await extractAngebot(file, (step, name) => {
          setProgress({ step, file: name, current: idx + 1, total });
        });

        const updated = saveAngebot(projectId, extracted);
        setAngebote(updated);
        successCount++;

        toast.success(
          `${extracted.lieferant}: ${extracted.positionen.length} Preise erkannt`,
          { duration: 4000 }
        );
      } catch (err) {
        console.error('Angebot extraction error:', err);
        toast.error(`${file.name}: ${err.message}`);
      }
    }

    setUploading(false);
    setProgress(null);

    if (successCount > 0) {
      toast.success(`${successCount} Angebot(e) verarbeitet`);
    }
  }, [projectId]);

  // ─── Delete handler ─────────────────────────────────────────
  const handleDelete = useCallback((angebotId) => {
    const updated = deleteAngebot(projectId, angebotId);
    setAngebote(updated);
    toast.success('Angebot entfernt');
  }, [projectId]);

  // ─── Apply prices to calculator ─────────────────────────────
  const handleApplyPrices = useCallback(() => {
    if (!analysis?.priceMap) return;
    onPriceMapReady(analysis.priceMap);
    toast.success(
      `${Object.keys(analysis.priceMap).length} Preise übernommen — jetzt Auto-Kalkulieren!`,
      { duration: 5000 }
    );
  }, [analysis, onPriceMapReady]);

  // ─── Drop zone ──────────────────────────────────────────────
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || []).filter(f =>
      f.type === 'application/pdf' || f.type.startsWith('image/')
    );
    if (files.length > 0) handleFiles(files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  return (
    <div className="space-y-4">

      {/* API Key Input (if needed) */}
      {showApiKeyInput && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800 mb-2">
            Claude API Key eingeben (wird lokal gespeichert)
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="sk-ant-api03-..."
              className="flex-1 rounded-lg border border-amber-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              onClick={handleSaveApiKey}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
            >
              Speichern
            </button>
            {hasApiKey() && (
              <button
                onClick={() => setShowApiKeyInput(false)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={clsx(
          'rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200',
          uploading
            ? 'border-amber-300 bg-amber-50'
            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer'
        )}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
            {progress?.total > 1 && (
              <p className="text-xs font-semibold text-amber-600">
                {progress.current} / {progress.total} Angebote
              </p>
            )}
            <p className="text-sm font-medium text-amber-700">
              {progress?.step === 'upload' && `${progress.file} — Wird hochgeladen...`}
              {progress?.step === 'converting' && `${progress.file} — Seiten werden gelesen...`}
              {progress?.step === 'reading' && `${progress.file} — Claude liest Angebot...`}
              {progress?.step === 'processing' && `${progress.file} — Preise werden extrahiert...`}
            </p>
            {progress?.total > 1 && (
              <div className="w-48 h-1.5 bg-amber-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            )}
          </div>
        ) : (
          <label className="flex flex-col items-center gap-2 cursor-pointer">
            <Upload className="h-8 w-8 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">
              Angebote hochladen (PDF, JPG, PNG)
            </p>
            <p className="text-xs text-gray-500">
              Auch Scans und handschriftliche Angebote
            </p>
            <input
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.tiff,.bmp"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) handleFiles(files);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>

      {/* Uploaded Angebote List */}
      {angebote.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700">
            Angebote ({angebote.length})
          </h4>

          {angebote.map((ang) => (
            <div key={ang.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              {/* Header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedAngebot(expandedAngebot === ang.id ? null : ang.id)}
              >
                {expandedAngebot === ang.id
                  ? <ChevronDown className="h-4 w-4 text-gray-400" />
                  : <ChevronRight className="h-4 w-4 text-gray-400" />
                }
                <FileText className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">{ang.lieferant}</span>
                <span className="text-xs text-gray-500">{ang.datum}</span>
                <span className="ml-auto text-xs text-gray-500">
                  {ang.positionen.length} Preise
                </span>
                <span className={clsx(
                  'text-xs px-2 py-0.5 rounded-full',
                  ang.typ === 'material_liste' ? 'bg-blue-100 text-blue-700' :
                  ang.typ === 'position_basiert' ? 'bg-purple-100 text-purple-700' :
                  'bg-gray-100 text-gray-700'
                )}>
                  {ang.typ === 'material_liste' ? 'Material' :
                   ang.typ === 'position_basiert' ? 'NU' : 'Gemischt'}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(ang.id); }}
                  className="p-1 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Expanded detail */}
              {expandedAngebot === ang.id && (
                <div className="border-t border-gray-100 px-4 py-3">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 text-left">
                        <th className="pb-1 font-medium">Material</th>
                        <th className="pb-1 font-medium text-right">Basis</th>
                        <th className="pb-1 font-medium text-right">Effektiv</th>
                        <th className="pb-1 font-medium">Einheit</th>
                        <th className="pb-1 font-medium">Zuschläge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ang.positionen.map((pos, i) => (
                        <tr key={i} className={clsx('border-t border-gray-50', pos.ist_alternative && 'opacity-50')}>
                          <td className="py-1.5 pr-2 font-medium text-gray-800 max-w-[200px] truncate">
                            {pos.ist_alternative && <span className="text-orange-500 mr-1" title="Alternativposition">Alt.</span>}
                            {pos.pos_nr ? `${pos.pos_nr}: ` : ''}{pos.bezeichnung}
                          </td>
                          <td className="py-1.5 text-right text-gray-600">
                            {pos.preis_basis.toFixed(2)}
                          </td>
                          <td className="py-1.5 text-right font-medium text-gray-900">
                            {pos.preis_effektiv.toFixed(2)}
                          </td>
                          <td className="py-1.5 pl-1 text-gray-500">{pos.einheit}</td>
                          <td className="py-1.5 text-gray-500 max-w-[200px] truncate">
                            {pos.zuschlaege_text || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {ang.handschriftliche_notizen?.length > 0 && (
                    <div className="mt-2 text-xs text-amber-700 bg-amber-50 rounded p-2">
                      Handschriftlich: {ang.handschriftliche_notizen.join('; ')}
                    </div>
                  )}
                  {ang.warnings?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {ang.warnings.map((w, i) => (
                        <div key={i} className="text-xs text-red-600 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {w}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Supplier Comparison */}
      {analysis && Object.keys(analysis.comparison).length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            Lieferanten-Vergleich (günstigster gesamt je Gruppe)
          </h4>

          <div className="space-y-2">
            {Object.entries(analysis.comparison).map(([groupId, group]) => (
              <div key={groupId} className="text-xs">
                <div className="font-medium text-gray-700 mb-1">{group.label}</div>
                <div className="flex gap-2 flex-wrap">
                  {group.suppliers.map((s) => (
                    <div
                      key={s.lieferant}
                      className={clsx(
                        'rounded-lg border px-3 py-1.5 flex items-center gap-2',
                        s.is_cheapest
                          ? 'border-green-300 bg-green-50'
                          : 'border-gray-200 bg-gray-50'
                      )}
                    >
                      {s.is_cheapest && <Trophy className="h-3 w-3 text-green-600" />}
                      <span className={s.is_cheapest ? 'font-semibold text-green-800' : 'text-gray-600'}>
                        {s.lieferant}
                      </span>
                      <span className={s.is_cheapest ? 'font-bold text-green-700' : 'text-gray-500'}>
                        {s.total_gp.toLocaleString('de-DE')} €
                      </span>
                      {!s.is_cheapest && s.differenz_pct > 0 && (
                        <span className="text-red-500">
                          +{s.differenz_pct}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Total savings */}
          {analysis.summary.ersparnis > 0 && (
            <div className="border-t border-gray-100 pt-3 text-sm">
              <span className="text-gray-500">Ersparnis günstigste Kombination: </span>
              <span className="font-bold text-green-700">
                {analysis.summary.ersparnis.toLocaleString('de-DE')} € ({analysis.summary.ersparnis_pct}%)
              </span>
            </div>
          )}

          {/* Apply button */}
          <button
            onClick={handleApplyPrices}
            className="w-full rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-green-600 hover:to-emerald-600 transition-all duration-200 flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            {Object.keys(analysis.priceMap).length} Preise übernehmen & Auto-Kalkulieren
          </button>
        </div>
      )}
    </div>
  );
}
