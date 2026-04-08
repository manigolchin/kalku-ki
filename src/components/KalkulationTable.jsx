const fmt = (v) =>
  Number(v).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pct = (v) =>
  Number(v).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function KalkulationTable({ data }) {
  if (!data) return null;

  const { position, rows = [], subtotals = [], ep } = data;

  const maxAnteil = Math.max(...rows.map((r) => Math.abs(r.anteil ?? 0)), 1);

  return (
    <div className="w-full overflow-x-auto">
      {position && (
        <div className="mb-2 section-label">{position}</div>
      )}

      {/* Desktop table */}
      <table className="w-full border-collapse hidden sm:table">
        <thead>
          <tr className="bg-slate-50">
            <th className="text-left text-xs uppercase text-slate-400 font-semibold px-3 py-2.5 tracking-wider">Kostenart</th>
            <th className="text-right text-xs uppercase text-slate-400 font-semibold px-3 py-2.5 tracking-wider w-28">&euro;/ME</th>
            <th className="text-right text-xs uppercase text-slate-400 font-semibold px-3 py-2.5 tracking-wider w-20">Anteil</th>
            <th className="text-left text-xs uppercase text-slate-400 font-semibold px-3 py-2.5 tracking-wider w-28" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100">
              <td className="px-3 py-2.5 text-sm text-slate-500">{row.label}</td>
              <td className="px-3 py-2.5 text-sm text-slate-700 text-right font-mono">{fmt(row.perUnit)}</td>
              <td className="px-3 py-2.5 text-xs text-slate-400 text-right font-mono">{pct(row.anteil)}%</td>
              <td className="px-3 py-2.5">
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary-400/50"
                    style={{ width: `${Math.min((Math.abs(row.anteil) / maxAnteil) * 100, 100)}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}

          {subtotals.map((st, i) => {
            const isEP = st.label.includes('Einheitspreis') || st.label.includes('EP');
            return (
              <tr key={`st-${i}`} className={isEP ? 'bg-primary-50' : 'border-b border-slate-100 bg-slate-50/30'}>
                <td className={`px-3 py-2.5 text-sm ${isEP ? 'text-primary-700 font-bold' : 'text-slate-500 font-medium'}`}>{st.label}</td>
                <td className={`px-3 py-2.5 text-sm text-right font-mono ${isEP ? 'text-primary-700 font-bold' : 'text-slate-700'}`}>{fmt(st.perUnit)}</td>
                <td className={`px-3 py-2.5 text-xs text-right font-mono ${isEP ? 'text-primary-600' : 'text-slate-300'}`}>{isEP ? '100,0%' : ''}</td>
                <td className="px-3 py-2.5">
                  {isEP && (
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-primary-500 w-full" />
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Mobile stacked layout */}
      <div className="sm:hidden space-y-1">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100">
            <div className="flex-1 min-w-0 mr-3">
              <div className="text-sm text-slate-500 truncate">{row.label}</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary-400/50"
                    style={{ width: `${Math.min((Math.abs(row.anteil) / maxAnteil) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 font-mono w-10 text-right">{pct(row.anteil)}%</span>
              </div>
            </div>
            <span className="text-sm font-mono text-slate-700 shrink-0">{fmt(row.perUnit)}</span>
          </div>
        ))}

        {subtotals.map((st, i) => {
          const isEP = st.label.includes('Einheitspreis') || st.label.includes('EP');
          return (
            <div key={`st-${i}`} className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${isEP ? 'bg-primary-50' : 'bg-slate-50'}`}>
              <span className={`text-sm ${isEP ? 'text-primary-700 font-bold' : 'text-slate-500 font-medium'}`}>{st.label}</span>
              <span className={`text-sm font-mono ${isEP ? 'text-primary-700 font-bold' : 'text-slate-700'}`}>{fmt(st.perUnit)}</span>
            </div>
          );
        })}
      </div>

      {ep !== undefined && (
        <div className="mt-3 flex items-center justify-between px-4 py-3 bg-primary-50 border border-primary-100 rounded-xl sm:hidden">
          <span className="text-xs uppercase tracking-wide text-primary-500 font-semibold">Einheitspreis</span>
          <span className="text-lg font-bold font-mono text-primary-700">{fmt(ep)}&nbsp;&euro;</span>
        </div>
      )}
    </div>
  );
}
