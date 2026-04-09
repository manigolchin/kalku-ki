import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, FileSpreadsheet, FileCode, File, Loader2 } from 'lucide-react';

const ACCEPTED_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'text/xml': 'xml',
  'application/xml': 'xml',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
  'text/csv': 'csv',
};

const ACCEPTED_EXTENSIONS = ['.pdf', '.xlsx', '.xls', '.xml', '.docx', '.txt', '.csv'];

function getFileTypeFromName(name) {
  const ext = name.toLowerCase().split('.').pop();
  const map = { pdf: 'pdf', xlsx: 'xlsx', xls: 'xls', xml: 'xml', docx: 'docx', txt: 'txt', csv: 'csv' };
  return map[ext] || null;
}

function getFileIcon(type) {
  switch (type) {
    case 'pdf':
    case 'docx':
    case 'txt':
      return FileText;
    case 'xlsx':
    case 'xls':
    case 'csv':
      return FileSpreadsheet;
    case 'xml':
      return FileCode;
    default:
      return File;
  }
}

export default function FileUpload({ onFileProcessed, isProcessing }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [parseProgress, setParseProgress] = useState('');
  const inputRef = useRef(null);

  const processFile = useCallback(
    async (file) => {
      setParseError(null);
      setParseProgress('');

      const fileType = ACCEPTED_TYPES[file.type] || getFileTypeFromName(file.name);

      if (!fileType) {
        setParseError(`Dateiformat nicht unterstützt. Erlaubt: ${ACCEPTED_EXTENSIONS.join(', ')}`);
        return;
      }

      setSelectedFile({ name: file.name, type: fileType, size: file.size });

      try {
        let content;

        switch (fileType) {
          case 'pdf': {
            setParseProgress('PDF wird gelesen...');
            const pdfjsLib = await import('pdfjs-dist');
            pdfjsLib.GlobalWorkerOptions.workerSrc =
              'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const pages = [];
            for (let i = 1; i <= pdf.numPages; i++) {
              setParseProgress(`Seite ${i} von ${pdf.numPages}...`);
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map((item) => item.str).join(' ');
              pages.push(pageText);
            }
            content = pages.join('\n\n');
            break;
          }
          case 'xlsx':
          case 'xls': {
            setParseProgress('Excel-Datei wird gelesen...');
            const XLSX = await import('xlsx');
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const firstSheet = workbook.SheetNames[0];
            content = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
            break;
          }
          case 'xml': {
            setParseProgress('GAEB-XML wird gelesen...');
            const { parseGAEB } = await import('../../utils/gaebParser');
            const buffer = await file.arrayBuffer();
            content = parseGAEB(buffer, file.name);
            break;
          }
          case 'docx': {
            setParseProgress('Word-Dokument wird gelesen...');
            const mammoth = await import('mammoth');
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            content = result.value;
            break;
          }
          case 'txt':
          case 'csv': {
            setParseProgress('Textdatei wird gelesen...');
            content = await readFileAsText(file);
            break;
          }
          default:
            throw new Error(`Unbekannter Dateityp: ${fileType}`);
        }

        setParseProgress('');
        onFileProcessed({ type: fileType, name: file.name, content, rawFile: file });
      } catch (err) {
        setParseError(`Fehler beim Lesen: ${err.message}`);
        setParseProgress('');
      }
    },
    [onFileProcessed]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = '';
    },
    [processFile]
  );

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const IconComponent = selectedFile ? getFileIcon(selectedFile.type) : Upload;

  return (
    <div className="w-full">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleClick();
        }}
        className={`
          relative flex flex-col items-center justify-center
          w-full min-h-[200px] rounded-2xl border-2 border-dashed
          cursor-pointer transition-all duration-200
          ${
            isDragOver
              ? 'border-primary-400 bg-primary-50/50 shadow-[0_0_24px_rgba(37,99,235,0.08)]'
              : 'border-slate-200 bg-slate-50/50 hover:border-primary-300 hover:bg-slate-50'
          }
          ${isProcessing ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          onChange={handleInputChange}
          className="hidden"
        />

        {isProcessing || parseProgress ? (
          <div className="flex flex-col items-center gap-3 p-6">
            <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
            <p className="text-sm text-slate-500">{parseProgress || 'Datei wird analysiert...'}</p>
          </div>
        ) : selectedFile ? (
          <div className="flex flex-col items-center gap-3 p-6">
            <IconComponent className="w-10 h-10 text-primary-500" />
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700 truncate max-w-xs">{selectedFile.name}</p>
              <p className="text-xs text-slate-400 mt-1">
                {selectedFile.type.toUpperCase()} &middot; {formatSize(selectedFile.size)}
              </p>
            </div>
            <p className="text-xs text-slate-400 mt-2">Andere Datei hier ablegen oder klicken</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 p-6">
            <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <Upload className="w-6 h-6 text-slate-300" />
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-500">
                Datei hierher ziehen oder{' '}
                <span className="text-primary-600 font-semibold">durchsuchen</span>
              </p>
              <p className="text-xs text-slate-400 mt-2">
                PDF, Excel, GAEB-XML, Word, CSV, TXT
              </p>
            </div>
          </div>
        )}
      </div>

      {parseError && (
        <div className="mt-3 p-3.5 rounded-xl bg-red-50 border border-red-200">
          <p className="text-xs text-red-700 font-medium">{parseError}</p>
        </div>
      )}
    </div>
  );
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
    reader.readAsText(file, 'UTF-8');
  });
}
