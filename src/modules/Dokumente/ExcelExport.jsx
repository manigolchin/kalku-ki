import { useState, useCallback } from 'react';
import { Download, Check } from 'lucide-react';

export default function ExcelExport({ data, projektname, type }) {
  const [exported, setExported] = useState(false);

  const handleExport = useCallback(async () => {
    try {
      const { exportKalkulation, exportAnalyse } = await import('../../utils/excelExport');

      if (type === 'kalkulation') {
        exportKalkulation(data, projektname);
      } else {
        const positions = data.positionen || data.positions || [];
        exportAnalyse(positions, projektname);
      }

      setExported(true);
      setTimeout(() => setExported(false), 2000);
    } catch (err) {
      console.error('Export-Fehler:', err);
    }
  }, [data, projektname, type]);

  return (
    <button
      onClick={handleExport}
      className={`
        inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
        font-semibold text-sm transition-all duration-200 cursor-pointer
        ${
          exported
            ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/15'
            : 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm shadow-primary-600/10'
        }
      `}
    >
      {exported ? (
        <>
          <Check className="w-4 h-4" />
          Exportiert!
        </>
      ) : (
        <>
          <Download className="w-4 h-4" />
          Als Excel exportieren
        </>
      )}
    </button>
  );
}
