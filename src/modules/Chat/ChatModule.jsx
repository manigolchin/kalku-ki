import { useState, useEffect, useCallback, useMemo } from 'react';
import { Send, PanelRightOpen, PanelRightClose, Plus, BarChart3 } from 'lucide-react';
import { useKalkuAI } from '../../hooks/useKalkuAI';
import { useSettings } from '../../hooks/useSettings';
import MessageList from './MessageList';
import PromptTemplates from './PromptTemplates';
import ContextBar from '../../components/ContextBar';

const STORAGE_KEY = 'kalku_chat_history';

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Corrupted data
  }
  return [];
}

function saveHistory(messages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Storage full
  }
}

function extractCalculationData(content) {
  if (!content) return null;

  const tables = [];
  const lines = content.split('\n');
  let tableBuffer = [];

  const flushTable = () => {
    if (tableBuffer.length >= 2) {
      const dataRows = tableBuffer.filter(
        (l) => !/^\s*\|?\s*[-:]+(\s*\|\s*[-:]+)+\s*\|?\s*$/.test(l)
      );
      const parseRow = (line) =>
        line
          .replace(/^\s*\|/, '')
          .replace(/\|\s*$/, '')
          .split('|')
          .map((c) => c.trim());

      if (dataRows.length >= 1) {
        tables.push({
          headers: parseRow(dataRows[0]),
          rows: dataRows.slice(1).map(parseRow),
        });
      }
    }
    tableBuffer = [];
  };

  for (const line of lines) {
    if (/^\s*\|/.test(line) && line.trim().endsWith('|')) {
      tableBuffer.push(line);
    } else if (/^\s*\|?[\s\-:]+\|[\s\-:|]+$/.test(line) && tableBuffer.length > 0) {
      tableBuffer.push(line);
    } else {
      flushTable();
    }
  }
  flushTable();

  const keyValues = [];
  const kvPattern =
    /\b(EP|Einheitspreis|Gesamt|EKT|HK|SK|Herstellkosten|Selbstkosten|Angebotspreis|BGK|AGK|W\+G|Mittellohn)[:\s]*[=:]?\s*(\d{1,3}(?:[.,]\d{1,3})*)\s*(€(?:\/\w+)?|EUR|%)?/gi;
  let match;
  while ((match = kvPattern.exec(content)) !== null) {
    keyValues.push({
      label: match[1],
      value: match[2],
      unit: match[3] || '',
    });
  }

  if (tables.length === 0 && keyValues.length === 0) return null;
  return { tables, keyValues };
}

export default function ChatModule() {
  const [messages, setMessages] = useState(loadHistory);
  const [input, setInput] = useState('');
  const [showPanel, setShowPanel] = useState(true);

  const { sendMessage, isLoading } = useKalkuAI();
  const { settings, updateSettings } = useSettings();

  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  const calcData = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        const data = extractCalculationData(messages[i].content);
        if (data) return data;
      }
    }
    return null;
  }, [messages]);

  const handleSend = useCallback(
    async (text) => {
      const trimmed = (text ?? input).trim();
      if (!trimmed || isLoading) return;

      const userMsg = { role: 'user', content: trimmed };
      const updated = [...messages, userMsg];
      setMessages(updated);
      setInput('');

      try {
        const response = await sendMessage(trimmed, {
          history: updated,
          settings,
        });

        const assistantMsg = {
          role: 'assistant',
          content: response?.content ?? response ?? 'Entschuldigung, ich konnte keine Antwort generieren.',
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const errorMsg = {
          role: 'assistant',
          content: `**Fehler:** ${err.message || 'Verbindungsfehler. Bitte versuche es erneut.'}`,
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    },
    [input, isLoading, messages, sendMessage, settings]
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput('');
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Context bar */}
      <ContextBar settings={settings} onUpdate={updateSettings} />

      {/* Main split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat area */}
        <div
          className={`flex flex-col transition-all duration-300 ${
            showPanel ? 'w-full md:w-[60%]' : 'w-full'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <button
              type="button"
              onClick={handleNewChat}
              className="btn-secondary !py-1.5 !px-3 !text-xs !rounded-lg"
            >
              <Plus size={14} />
              Neue Unterhaltung
            </button>

            <button
              type="button"
              onClick={() => setShowPanel((p) => !p)}
              className="hidden md:inline-flex items-center gap-1.5 text-xs text-slate-400
                hover:text-slate-600 transition-all duration-200 cursor-pointer"
              title={showPanel ? 'Vorschau ausblenden' : 'Vorschau einblenden'}
            >
              {showPanel ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            </button>
          </div>

          {/* Messages */}
          <MessageList messages={messages} isLoading={isLoading} />

          {/* Templates */}
          {messages.length === 0 && (
            <PromptTemplates
              onSelect={(prompt) => handleSend(prompt)}
              disabled={isLoading}
            />
          )}

          {/* Input */}
          <div className="px-5 pb-5 pt-3">
            <div
              className="flex items-end gap-3 bg-slate-50 border border-slate-200
                rounded-2xl px-4 py-3 focus-within:border-primary-400 focus-within:bg-white
                focus-within:shadow-[0_0_0_3px_rgba(37,99,235,0.08)]
                transition-all duration-200"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Stelle eine Frage zur Baukalkulation..."
                rows={1}
                disabled={isLoading}
                className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400
                  outline-none resize-none max-h-32 leading-relaxed
                  disabled:opacity-50"
                style={{ minHeight: '2.25rem' }}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                }}
              />
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl
                  bg-primary-600 text-white hover:bg-primary-700
                  disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed
                  transition-all duration-200 cursor-pointer shadow-sm shadow-primary-600/10"
                aria-label="Nachricht senden"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Preview panel */}
        {showPanel && (
          <div
            className="hidden md:flex flex-col w-[40%] border-l border-slate-100
              bg-slate-50/50 animate-[slide-in-right_0.25s_ease-out]"
          >
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800">Kalkulations-Vorschau</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Automatisch aus der KI-Antwort extrahiert
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {calcData ? (
                <div className="space-y-5">
                  {calcData.keyValues.length > 0 && (
                    <div>
                      <h3 className="section-label mb-3">Kennwerte</h3>
                      <div className="grid grid-cols-2 gap-2.5">
                        {calcData.keyValues.map((kv, i) => (
                          <div
                            key={i}
                            className="bg-white border border-slate-200/80 rounded-xl px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                          >
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium block">
                              {kv.label}
                            </span>
                            <span className="text-lg font-mono font-semibold text-brand-600 mt-0.5 block">
                              {kv.value}
                              {kv.unit && (
                                <span className="text-xs text-slate-400 ml-1 font-sans font-normal">
                                  {kv.unit}
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {calcData.tables.map((table, ti) => (
                    <div key={ti}>
                      <h3 className="section-label mb-3">
                        Tabelle {calcData.tables.length > 1 ? ti + 1 : ''}
                      </h3>
                      <div className="overflow-x-auto rounded-xl border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200/80">
                              {table.headers.map((h, hi) => (
                                <th
                                  key={hi}
                                  className="px-3 py-2.5 text-left font-semibold text-slate-500 whitespace-nowrap"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {table.rows.map((row, ri) => (
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
                                      /\d/.test(cell)
                                        ? 'font-mono text-right text-brand-600 font-medium'
                                        : 'text-slate-700'
                                    }`}
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                    <BarChart3 className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-400 max-w-[220px] leading-relaxed">
                    Kalkulationsdaten erscheinen hier, sobald die KI Berechnungen liefert.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile panel toggle */}
      {calcData && (
        <div className="md:hidden border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowPanel((p) => !p)}
            className="w-full px-4 py-2.5 text-xs text-center text-primary-600 font-semibold
              bg-primary-50 hover:bg-primary-100 transition-all duration-200 cursor-pointer"
          >
            {showPanel ? 'Vorschau ausblenden' : 'Kalkulations-Vorschau anzeigen'}
          </button>
          {showPanel && (
            <div className="overflow-y-auto max-h-64 px-4 py-3 bg-slate-50/50 space-y-4">
              {calcData.keyValues.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {calcData.keyValues.map((kv, i) => (
                    <div
                      key={i}
                      className="bg-white border border-slate-200/80 rounded-xl px-3 py-2.5"
                    >
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium block">
                        {kv.label}
                      </span>
                      <span className="text-base font-mono font-semibold text-brand-600">
                        {kv.value}
                        {kv.unit && (
                          <span className="text-[10px] text-slate-400 ml-1 font-sans">{kv.unit}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {calcData.tables.map((table, ti) => (
                <div key={ti} className="overflow-x-auto rounded-xl border border-slate-200/80">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200/80">
                        {table.headers.map((h, hi) => (
                          <th
                            key={hi}
                            className="px-2 py-2 text-left font-semibold text-slate-500 whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row, ri) => (
                        <tr
                          key={ri}
                          className={`border-b border-slate-100 ${
                            ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                          }`}
                        >
                          {row.map((cell, ci) => (
                            <td
                              key={ci}
                              className={`px-2 py-1.5 whitespace-nowrap ${
                                /\d/.test(cell)
                                  ? 'font-mono text-right text-brand-600 font-medium'
                                  : 'text-slate-700'
                              }`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
