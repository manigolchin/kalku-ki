import { useMemo } from 'react';

function parseMarkdown(text) {
  const lines = text.split('\n');
  const elements = [];
  let tableBuffer = [];
  let key = 0;

  const flushTable = () => {
    if (tableBuffer.length === 0) return;
    elements.push(renderTable(tableBuffer, key++));
    tableBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^\s*\|/.test(line) && line.trim().endsWith('|')) {
      tableBuffer.push(line);
      continue;
    }

    if (/^\s*\|?[\s\-:]+\|[\s\-:|]+$/.test(line) && tableBuffer.length > 0) {
      tableBuffer.push(line);
      continue;
    }

    flushTable();

    if (line.trim() === '') {
      elements.push(<div key={key++} className="h-2" />);
      continue;
    }

    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^(#{1,3})/)[1].length;
      const content = line.replace(/^#{1,3}\s+/, '');
      const Tag = level === 1 ? 'h3' : level === 2 ? 'h4' : 'h5';
      const sizes = {
        h3: 'text-[15px] font-semibold',
        h4: 'text-sm font-semibold',
        h5: 'text-sm font-medium',
      };
      elements.push(
        <Tag key={key++} className={`${sizes[Tag]} text-slate-800 mt-3 mb-1`}>
          {parseInline(content)}
        </Tag>
      );
      continue;
    }

    elements.push(
      <p key={key++} className="text-[13px] leading-relaxed text-slate-600 my-0.5">
        {parseInline(line)}
      </p>
    );
  }

  flushTable();
  return elements;
}

function parseInline(text) {
  const parts = [];
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`([^`]+?)`)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(highlightCostTerms(text.slice(lastIndex, match.index), key++));
    }

    if (match[1]) {
      parts.push(
        <strong key={`b-${key++}`} className="font-semibold text-slate-800">
          {highlightCostTerms(match[2], key++)}
        </strong>
      );
    } else if (match[3]) {
      parts.push(
        <em key={`i-${key++}`} className="italic text-slate-500">
          {highlightCostTerms(match[4], key++)}
        </em>
      );
    } else if (match[5]) {
      parts.push(
        <code
          key={`c-${key++}`}
          className="bg-slate-100 text-primary-600 px-1.5 py-0.5 rounded-md text-xs font-mono"
        >
          {match[6]}
        </code>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(highlightCostTerms(text.slice(lastIndex), key++));
  }

  return parts.length > 0 ? parts : text;
}

const COST_PATTERN =
  /\b(EP|Gesamt|EKT|HK|SK|BGK|AGK|W\+G|Mittellohn|Einheitspreis|Herstellkosten|Selbstkosten|Angebotspreis)\b|(\d{1,3}(?:[.,]\d{1,3})*\s*(?:€|€\/\w+|EUR))/gi;

function highlightCostTerms(text, baseKey) {
  if (typeof text !== 'string') return text;
  const parts = [];
  let lastIndex = 0;
  let match;
  const re = new RegExp(COST_PATTERN.source, 'gi');

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={`hl-${baseKey}-${match.index}`} className="text-brand-600 font-semibold">
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (parts.length === 0) return text;
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function renderTable(lines, tableKey) {
  const dataRows = lines.filter(
    (line) => !/^\s*\|?\s*[-:]+(\s*\|\s*[-:]+)+\s*\|?\s*$/.test(line)
  );

  if (dataRows.length === 0) return null;

  const parseRow = (line) =>
    line
      .replace(/^\s*\|/, '')
      .replace(/\|\s*$/, '')
      .split('|')
      .map((cell) => cell.trim());

  const headerCells = parseRow(dataRows[0]);
  const bodyRows = dataRows.slice(1).map(parseRow);

  return (
    <div key={`table-${tableKey}`} className="my-3 overflow-x-auto rounded-xl border border-slate-200/80">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200/80">
            {headerCells.map((cell, i) => (
              <th
                key={i}
                className="px-3 py-2.5 text-left font-semibold text-slate-500 whitespace-nowrap"
              >
                {parseInline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, ri) => (
            <tr
              key={ri}
              className={`border-b border-slate-100 ${
                ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
              }`}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-3 py-2 whitespace-nowrap ${
                    /\d/.test(cell) ? 'font-mono text-right text-brand-600 font-medium' : 'text-slate-700'
                  }`}
                >
                  {parseInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  const parsed = useMemo(() => {
    if (isUser) return null;
    return parseMarkdown(message.content);
  }, [message.content, isUser]);

  return (
    <div
      className={`flex gap-3 animate-[fade-in_0.25s_ease-out] ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center mt-1 shadow-sm shadow-brand-500/15">
          <span className="text-white font-bold text-sm">K</span>
        </div>
      )}

      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/10'
            : 'bg-white border border-slate-200/80 text-slate-700 shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
        }`}
      >
        {isUser ? (
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="space-y-0.5">{parsed}</div>
        )}
      </div>
    </div>
  );
}
