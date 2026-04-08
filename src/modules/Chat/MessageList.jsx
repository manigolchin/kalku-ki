import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: `**Willkommen bei KALKU-KI!** Dein KI-Assistent für Baukalkulation.

Ich helfe dir bei:
- **Einheitspreise** berechnen (EP nach EFB 221)
- **Erdarbeiten, Straßenbau, Kanalbau** kalkulieren
- **VOB-Regelungen** prüfen und erklären
- **Zuschläge** (BGK, AGK, W+G) korrekt anwenden
- **Abrechnungen** nach VOB/C prüfen

Stelle eine Frage oder wähle eine Vorlage unten aus.`,
};

export default function MessageList({ messages, isLoading }) {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const displayMessages = messages.length === 0 ? [WELCOME_MESSAGE] : messages;

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-5 py-5 space-y-4 scroll-smooth"
    >
      {displayMessages.map((msg, index) => (
        <MessageBubble key={`msg-${index}`} message={msg} />
      ))}

      {isLoading && (
        <div className="flex gap-3 justify-start animate-[fade-in_0.2s_ease-out]">
          <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-sm shadow-brand-500/15">
            <span className="text-white font-bold text-sm">K</span>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-2xl px-5 py-3.5 flex items-center gap-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <span
              className="w-1.5 h-1.5 rounded-full bg-primary-500"
              style={{ animation: 'pulse-dot 1.4s infinite ease-in-out', animationDelay: '0ms' }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-primary-500"
              style={{ animation: 'pulse-dot 1.4s infinite ease-in-out', animationDelay: '200ms' }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-primary-500"
              style={{ animation: 'pulse-dot 1.4s infinite ease-in-out', animationDelay: '400ms' }}
            />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
