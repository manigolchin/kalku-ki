import { useState, useMemo } from 'react';
import { Scale, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { checkVOB2Abs3 } from '../../utils/kalkulation';

const EINHEITEN = ['m²', 'm³', 'm', 'Stk', 't', 'lfm'];

export default function NachtragRechner() {
  const [vertragsmenge, setVertragsmenge] = useState('');
  const [einheit, setEinheit] = useState('m²');
  const [istMenge, setIstMenge] = useState('');
  const [originalEP, setOriginalEP] = useState('');

  const num = (v) => parseFloat(v) || 0;

  const result = useMemo(() => {
    const vm = num(vertragsmenge);
    const im = num(istMenge);
    if (vm <= 0) return null;
    return checkVOB2Abs3(vm, im);
  }, [vertragsmenge, istMenge]);

  const vm = num(vertragsmenge);
  const im = num(istMenge);
  const ep = num(originalEP);

  const originalGP = vm * ep;
  const tatsaechlichGP = im * ep;
  const differenz = tatsaechlichGP - originalGP;

  const toleranzMin = vm * 0.9;
  const toleranzMax = vm * 1.1;
  const visualMax = Math.max(im, vm * 1.3, toleranzMax * 1.1);
  const visualMin = Math.min(im, vm * 0.7, toleranzMin * 0.9);
  const range = visualMax - visualMin || 1;

  const pctMin = ((toleranzMin - visualMin) / range) * 100;
  const pctMax = ((toleranzMax - visualMin) / range) * 100;
  const pctMarker = im > 0 ? ((im - visualMin) / range) * 100 : 0;
  const pctVertrag = ((vm - visualMin) / range) * 100;

  return (
    <div className="space-y-6">
      {/* Input */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Scale className="w-4 h-4 text-primary-500" />
          <h3 className="text-sm font-semibold text-slate-800">VOB/B §2 Abs. 3 - Mengenabweichung</h3>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Vertragsmenge">
            <input type="number" step="0.01" min="0" value={vertragsmenge} onChange={(e) => setVertragsmenge(e.target.value)} placeholder="0,00" className="input-field" />
          </Field>
          <Field label="Einheit">
            <select value={einheit} onChange={(e) => setEinheit(e.target.value)} className="input-field">
              {EINHEITEN.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </Field>
          <Field label="Tatsächliche Menge">
            <input type="number" step="0.01" min="0" value={istMenge} onChange={(e) => setIstMenge(e.target.value)} placeholder="0,00" className="input-field" />
          </Field>
          <Field label="Original-EP (EUR)">
            <input type="number" step="0.01" min="0" value={originalEP} onChange={(e) => setOriginalEP(e.target.value)} placeholder="0,00" className="input-field" />
          </Field>
        </div>
      </div>

      {/* Results */}
      {result && im > 0 && (
        <>
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-label">Abweichung</h3>
              <span
                className={`font-mono text-2xl font-bold ${
                  result.nachtragBerechtigt
                    ? result.ueberschreitung10
                      ? 'text-red-600'
                      : 'text-amber-600'
                    : 'text-emerald-600'
                }`}
              >
                {result.abweichungProzent > 0 ? '+' : ''}
                {formatDE(result.abweichungProzent)}%
              </span>
            </div>

            {/* Tolerance zone */}
            <div className="relative mb-4">
              <div className="h-8 bg-slate-100 rounded-xl overflow-hidden relative">
                <div
                  className="absolute h-full bg-emerald-200/40"
                  style={{ left: `${pctMin}%`, width: `${pctMax - pctMin}%` }}
                />
                {vm > 0 && (
                  <div className="absolute top-0 h-full w-px bg-slate-300" style={{ left: `${pctVertrag}%` }} />
                )}
                {im > 0 && (
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white z-10 shadow-sm transition-all ${
                      result.nachtragBerechtigt
                        ? result.ueberschreitung10 ? 'bg-red-500' : 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ left: `${Math.min(96, Math.max(2, pctMarker))}%`, transform: 'translate(-50%, -50%)' }}
                  />
                )}
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-slate-400" style={{ marginLeft: `${Math.max(0, pctMin - 3)}%` }}>90%</span>
                <span className="text-[10px] text-slate-500 font-medium absolute" style={{ left: `${pctVertrag}%`, transform: 'translateX(-50%)' }}>100%</span>
                <span className="text-[10px] text-slate-400" style={{ marginRight: `${Math.max(0, 100 - pctMax - 3)}%` }}>110%</span>
              </div>
            </div>

            {/* Status */}
            <div
              className={`p-4 rounded-xl border ${
                !result.nachtragBerechtigt
                  ? 'border-emerald-200 bg-emerald-50'
                  : result.ueberschreitung10
                    ? 'border-red-200 bg-red-50'
                    : 'border-amber-200 bg-amber-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {!result.nachtragBerechtigt ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : result.ueberschreitung10 ? (
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={`text-sm font-semibold mb-1 ${
                    !result.nachtragBerechtigt ? 'text-emerald-700' : result.ueberschreitung10 ? 'text-red-700' : 'text-amber-700'
                  }`}>
                    {!result.nachtragBerechtigt
                      ? 'Im Toleranzbereich'
                      : result.ueberschreitung10
                        ? 'Nachtrag berechtigt (Mehrmenge)'
                        : 'EP-Anpassung möglich (Mindermenge)'}
                  </p>
                  <p className="text-sm text-slate-500 leading-relaxed">{result.regelung}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Financial impact */}
          {ep > 0 && (
            <div className="card">
              <h3 className="section-label mb-4">Finanzielle Auswirkung</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-1">Vertrags-GP</p>
                  <p className="font-mono text-sm text-slate-700 font-medium">{formatEUR(originalGP)}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{formatDE(vm)} {einheit} x {formatEUR(ep)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-1">Tatsächlich</p>
                  <p className="font-mono text-sm text-slate-700 font-medium">{formatEUR(tatsaechlichGP)}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{formatDE(im)} {einheit} x {formatEUR(ep)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-1">Differenz</p>
                  <p className={`font-mono text-sm font-bold ${differenz > 0 ? 'text-red-600' : differenz < 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                    {differenz >= 0 ? '+' : ''}{formatEUR(differenz)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Steps */}
          {result.nachtragBerechtigt && (
            <div className="card">
              <h3 className="section-label mb-3">Empfohlenes Vorgehen</h3>
              <div className="space-y-3">
                {result.ueberschreitung10 ? (
                  <>
                    <Step nr={1} text="Mengenüberschreitung schriftlich beim AG anzeigen (§2 Abs. 3 Nr. 2 VOB/B)." />
                    <Step nr={2} text="Neuen EP für die über 110% hinausgehende Mehrmenge kalkulieren." />
                    <Step nr={3} text="Kalkulation auf Basis der tatsächlichen Mehr- oder Minderkosten aufstellen." />
                    <Step nr={4} text="Nachtrag mit Begründung und Preisermittlung einreichen." />
                  </>
                ) : (
                  <>
                    <Step nr={1} text="Mengenunterschreitung dokumentieren und Unterdeckung der Gemeinkosten prüfen." />
                    <Step nr={2} text="Erhöhung des EP für die verbleibende Menge kalkulieren (§2 Abs. 3 Nr. 3 VOB/B)." />
                    <Step nr={3} text="Nachweis führen, dass durch die Minderung die Kosten je ME gestiegen sind." />
                    <Step nr={4} text="Preisanpassungsanspruch schriftlich beim AG geltend machen." />
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Placeholder */}
      {(!result || im <= 0) && (
        <div className="card text-center py-10">
          <Scale className="w-8 h-8 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400">
            Vertrags- und Ist-Menge eingeben, um die Mengenabweichung nach VOB/B §2 Abs. 3 zu prüfen.
          </p>
        </div>
      )}
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

function Step({ nr, text }) {
  return (
    <div className="flex items-start gap-3">
      <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-lg bg-primary-50 text-primary-600 text-xs font-bold border border-primary-100">
        {nr}
      </span>
      <p className="text-sm text-slate-500 leading-relaxed pt-0.5">{text}</p>
    </div>
  );
}

function formatEUR(n) {
  return Number(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20AC';
}

function formatDE(n) {
  return Number(n).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
