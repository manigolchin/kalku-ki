import { useState, useCallback } from 'react';
import {
  FileSearch,
  Sparkles,
  FileText,
  Table,
  AlertCircle,
  Info,
  Loader2,
} from 'lucide-react';
import FileUpload from './FileUpload';
import ExcelExport from './ExcelExport';
import { useKalkuAI } from '../../hooks/useKalkuAI';
import useSettings from '../../hooks/useSettings';

function performLocalAnalysis(content, type, name) {
  const textContent =
    typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  const lower = textContent.toLowerCase();
  const nameLower = (name || '').toLowerCase();

  let dokumentTyp = 'Sonstige';
  if (type === 'gaeb' || type === 'xml' || nameLower.includes('gaeb')) {
    dokumentTyp = 'LV';
  } else if (lower.includes('leistungsverzeichnis') || lower.includes('lv-position')) {
    dokumentTyp = 'LV';
  } else if (lower.includes('angebot') || lower.includes('angebotssumme')) {
    dokumentTyp = 'Angebot';
  } else if (lower.includes('aufmaß') || lower.includes('aufmass') || lower.includes('abrechnung')) {
    dokumentTyp = 'Aufmaß';
  } else if (lower.includes('rechnung') || lower.includes('rechnungsbetrag')) {
    dokumentTyp = 'Rechnung';
  } else if (lower.includes('nachtrag') || lower.includes('nachtragsangebot')) {
    dokumentTyp = 'Nachtrag';
  }

  let positionen = [];
  if (Array.isArray(content)) {
    positionen = content.slice(0, 50).map((row, i) => ({
      oz: row.OZ || row.oz || row.Nr || row.nr || row.Pos || String(i + 1),
      kurztext:
        row.Kurztext || row.kurztext || row.Bezeichnung || row.bezeichnung ||
        row.Text || row.text || row.Beschreibung || '',
      menge: parseFloat(row.Menge || row.menge || row.Qty || 0) || 0,
      einheit: row.Einheit || row.einheit || row.ME || row.Unit || '',
      ep: parseFloat(row.EP || row.ep || row.Einheitspreis || 0) || 0,
      gp: parseFloat(row.GP || row.gp || row.Gesamtpreis || row.Gesamt || 0) || 0,
    }));
  }

  if (Array.isArray(content) && content.length > 0 && content[0].oz !== undefined && content[0].text !== undefined) {
    positionen = content.map((p) => ({
      oz: p.oz || '',
      kurztext: p.text || '',
      menge: p.qty || 0,
      einheit: p.unit || '',
      ep: p.ep || 0,
      gp: 0,
    }));
  }

  const lines = textContent.split('\n').filter((l) => l.trim().length > 0);

  return {
    dokumentTyp,
    zusammenfassung: `${dokumentTyp}-Dokument "${name}" mit ${positionen.length || lines.length} erkannten Einträgen. Lokale Analyse ohne KI (API-Key nicht konfiguriert).`,
    positionen,
    preisvorschlaege: [],
    hinweise: [
      'Lokale Analyse: Für detailliertere KI-Analyse bitte API-Key in den Einstellungen hinterlegen.',
      positionen.length > 0
        ? `${positionen.length} Positionen aus Tabellendaten extrahiert.`
        : 'Keine strukturierten Positionsdaten erkannt - manuelle Prüfung empfohlen.',
    ],
    gesamtsumme: positionen.reduce((s, p) => s + (p.gp || p.menge * p.ep || 0), 0),
    _fallback: true,
  };
}

export default function DokumenteModule() {
  const { settings } = useSettings();
  const { sendMessage, isLoading, error: aiError } = useKalkuAI(settings);

  const [phase, setPhase] = useState('idle');
  const [fileData, setFileData] = useState(null);
  const [extractedContent, setExtractedContent] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [localError, setLocalError] = useState(null);

  const handleFileProcessed = useCallback(
    async ({ type, name, content, rawFile }) => {
      setPhase('parsing');
      setFileData({ type, name, size: rawFile.size });
      setExtractedContent(content);
      setLocalError(null);

      const contentPreview =
        typeof content === 'string'
          ? content.slice(0, 6000)
          : JSON.stringify(content).slice(0, 6000);

      try {
        const prompt =
          `Analysiere folgendes Baudokument und antworte NUR als JSON.\n` +
          `JSON-Struktur: { "dokumentTyp": "LV|Angebot|Aufmaß|Rechnung|Nachtrag|Sonstige", ` +
          `"zusammenfassung": "...", "positionen": [{"oz":"...","kurztext":"...","menge":0,"einheit":"...","ep":0,"gp":0}], ` +
          `"preisvorschlaege": [{"position":"...","preis":0,"quelle":"...","konfidenz":"hoch|mittel|niedrig"}], ` +
          `"hinweise": ["..."], "gesamtsumme": 0 }\n\n` +
          `Dateityp: ${type}\nDateiname: ${name}\n\nInhalt:\n${contentPreview}`;

        const responseText = await sendMessage([
          { role: 'user', content: prompt },
        ]);

        let parsed;
        try {
          const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
          const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
          parsed = JSON.parse(jsonStr);
        } catch {
          parsed = {
            dokumentTyp: type === 'xml' ? 'LV' : 'Sonstige',
            zusammenfassung: responseText.slice(0, 500),
            positionen: [],
            preisvorschlaege: [],
            hinweise: ['KI-Antwort konnte nicht als strukturierte Daten geparst werden.'],
            gesamtsumme: 0,
          };
        }

        setAiResult(parsed);
        setPhase('analyzed');
      } catch {
        const fallback = performLocalAnalysis(content, type, name);
        fallback._error = aiError || 'KI-Analyse fehlgeschlagen. Lokale Analyse wird verwendet.';
        setAiResult(fallback);
        setLocalError(fallback._error);
        setPhase('analyzed');
      }
    },
    [sendMessage, aiError, settings]
  );

  const handleReset = useCallback(() => {
    setPhase('idle');
    setFileData(null);
    setExtractedContent(null);
    setAiResult(null);
    setLocalError(null);
  }, []);

  const positionen = aiResult?.positionen || [];

  const exportData = {
    positionen: positionen.map((p) => ({
      oz: p.oz || '',
      text: p.kurztext || p.text || '',
      qty: p.menge || p.qty || 0,
      unit: p.einheit || p.unit || '',
      ep: p.ep ?? null,
      gp: p.gp ?? null,
    })),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary-50 border border-primary-100">
            <FileSearch className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              Dokument-Analyse
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              LV, Angebote & GAEB-Dateien analysieren
            </p>
          </div>
        </div>

        {phase === 'analyzed' && (
          <div className="flex items-center gap-3">
            <ExcelExport
              data={exportData}
              projektname={settings.projektname || fileData?.name || ''}
              type="analyse"
            />
            <button
              onClick={handleReset}
              className="btn-secondary"
            >
              Neue Datei
            </button>
          </div>
        )}
      </div>

      {/* Upload */}
      {phase === 'idle' && (
        <FileUpload onFileProcessed={handleFileProcessed} isProcessing={false} />
      )}

      {/* Parsing */}
      {phase === 'parsing' && (
        <div className="card text-center py-12">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
            <div>
              <p className="text-sm font-medium text-slate-800">
                {isLoading ? 'KI-Analyse läuft...' : 'Datei wird verarbeitet...'}
              </p>
              {fileData && (
                <p className="text-xs text-slate-400 mt-1">
                  {fileData.name} ({fileData.type.toUpperCase()})
                </p>
              )}
            </div>
            <div className="w-56 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-primary-500 rounded-full animate-pulse w-2/3" />
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {phase === 'analyzed' && aiResult && (
        <div className="space-y-5">
          {/* Doc info */}
          <div className="card">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <FileText className="w-5 h-5 text-primary-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-sm font-semibold text-slate-800 truncate">
                    {fileData?.name}
                  </h3>
                  <span className="badge bg-primary-50 text-primary-600 border border-primary-100">
                    {aiResult.dokumentTyp || fileData?.type}
                  </span>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {aiResult.zusammenfassung || 'Analyse abgeschlossen.'}
                </p>
              </div>
            </div>
          </div>

          {/* Fallback notice */}
          {(localError || aiResult._fallback) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-amber-700 font-semibold">
                  Lokale Analyse (ohne KI)
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {aiResult._error || localError || 'API-Key nicht konfiguriert. Für detailliertere Ergebnisse bitte API-Key in den Einstellungen hinterlegen.'}
                </p>
              </div>
            </div>
          )}

          {/* Positions table */}
          {positionen.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Table className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-800">
                  Erkannte Positionen ({positionen.length})
                </h3>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50">
                      <th className="text-left py-2.5 px-3 section-label">OZ</th>
                      <th className="text-left py-2.5 px-3 section-label">Kurztext</th>
                      <th className="text-right py-2.5 px-3 section-label">Menge</th>
                      <th className="text-left py-2.5 px-3 section-label">Einheit</th>
                      <th className="text-right py-2.5 px-3 section-label">EP</th>
                      <th className="text-right py-2.5 px-3 section-label">GP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positionen.map((pos, i) => {
                      const menge = pos.menge || pos.qty || 0;
                      const ep = pos.ep ?? null;
                      const gp = pos.gp || (ep != null && menge ? ep * menge : null);
                      return (
                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-xs text-slate-400">{pos.oz || '-'}</td>
                          <td className="py-2.5 px-3 text-slate-700 max-w-xs truncate">{pos.kurztext || pos.text || '-'}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700">{menge > 0 ? formatDE(menge) : '-'}</td>
                          <td className="py-2.5 px-3 text-slate-400 text-xs">{pos.einheit || pos.unit || '-'}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-brand-600 font-medium">{ep != null ? formatEUR(ep) : '-'}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700">{gp != null ? formatEUR(gp) : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {aiResult.gesamtsumme > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-slate-200">
                        <td colSpan={5} className="py-3 px-3 text-right section-label">Gesamtsumme</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-brand-600 text-base">{formatEUR(aiResult.gesamtsumme)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Price suggestions */}
          {aiResult.preisvorschlaege && aiResult.preisvorschlaege.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-brand-500" />
                <h3 className="text-sm font-semibold text-slate-800">Vorgeschlagene Einheitspreise</h3>
              </div>
              <div className="space-y-2.5">
                {aiResult.preisvorschlaege.map((pv, i) => (
                  <div key={i} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div>
                      <p className="text-sm text-slate-700 font-medium">{pv.position}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{pv.quelle || 'Erfahrungswert'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-bold text-brand-600">{formatEUR(pv.preis || 0)}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">{pv.konfidenz || ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hints */}
          {aiResult.hinweise && aiResult.hinweise.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-800">Hinweise</h3>
              </div>
              <ul className="space-y-2.5">
                {aiResult.hinweise.map((h, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-400 shrink-0 mt-2" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Raw content */}
          {extractedContent && typeof extractedContent === 'string' && (
            <details className="card !p-0 overflow-hidden">
              <summary className="p-5 cursor-pointer text-sm text-slate-400 hover:text-slate-600 transition-colors font-medium">
                Extrahierter Rohtext anzeigen
              </summary>
              <div className="px-5 pb-5">
                <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed">
                  {extractedContent.slice(0, 5000)}
                  {extractedContent.length > 5000 && '\n\n... (gekürzt)'}
                </pre>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function formatDE(n) {
  return Number(n).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function formatEUR(n) {
  return Number(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20AC';
}
