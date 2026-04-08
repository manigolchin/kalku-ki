import {
  Ruler,
  Shovel,
  Route,
  Wrench,
  Scale,
  TreePine,
  Calculator,
  ClipboardList,
} from 'lucide-react';

const TEMPLATES = [
  {
    Icon: Ruler,
    label: 'EP berechnen',
    prompt:
      'Berechne den Einheitspreis für Verbundpflaster 8cm in Kies, 200 m². Mittellohn 48 €/h, BGK 10%, AGK 9%, W+G 6%.',
  },
  {
    Icon: Shovel,
    label: 'Erdarbeiten',
    prompt:
      'Kalkuliere die Erdarbeiten: Aushub 350 m³ Bodenklasse 4, Entsorgung inklusive. Mittellohn 46 €/h.',
  },
  {
    Icon: Route,
    label: 'Straßenbau EP',
    prompt:
      'Einheitspreis für Asphalttragschicht 8cm AC 22 T S, 500 m². Mittellohn 50 €/h, BGK 12%.',
  },
  {
    Icon: Wrench,
    label: 'Kanalbau',
    prompt:
      'Kalkuliere Regenkanal DN 300, KG-Rohr, 80 lfm inkl. Aushub und Schachtbau. Mittellohn 48 €/h.',
  },
  {
    Icon: Scale,
    label: 'VOB §2 Prüfung',
    prompt:
      'Die Ausschreibungsmenge war 300 m², tatsächlich wurden 380 m² Pflaster verlegt. Welche VOB-Regelung gilt?',
  },
  {
    Icon: TreePine,
    label: 'GaLaBau Pauschal',
    prompt:
      'Erstelle eine Kostenschätzung für eine Schulhofgestaltung: 500 m² Pflaster, 200 m² Rasenfläche, 20 Sträucher, 5 Hochstämme, 1 Spielanlage.',
  },
  {
    Icon: Calculator,
    label: 'Zuschläge erklären',
    prompt:
      'Erkläre mir die Zuschlagskalkulation nach EFB 221: BGK, AGK, W+G — wie berechne ich sie richtig?',
  },
  {
    Icon: ClipboardList,
    label: 'VOB Abrechnung',
    prompt:
      'Wie rechne ich Pflasterarbeiten nach VOB/C DIN 18318 ab? Was gilt für die Übermessungsregel?',
  },
];

export default function PromptTemplates({ onSelect, disabled }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 px-5 scrollbar-thin">
      {TEMPLATES.map((tpl, i) => {
        const Icon = tpl.Icon;
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(tpl.prompt)}
            className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
              text-xs font-medium whitespace-nowrap
              bg-white border border-slate-200/80 text-slate-600
              hover:bg-primary-50 hover:border-primary-300 hover:text-primary-600
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-200 cursor-pointer
              shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
            title={tpl.prompt}
          >
            <Icon size={14} strokeWidth={1.5} />
            {tpl.label}
          </button>
        );
      })}
    </div>
  );
}
