import { useState } from 'react';
import { Calculator, Ruler, Scale } from 'lucide-react';
import EFB221Rechner from './EFB221Rechner';
import MassenRechner from './MassenRechner';
import NachtragRechner from './NachtragRechner';

const TABS = [
  { id: 'efb221', label: 'EP-Kalkulation (EFB 221)', icon: Calculator, component: EFB221Rechner },
  { id: 'massen', label: 'Massenermittlung', icon: Ruler, component: MassenRechner },
  { id: 'nachtrag', label: 'VOB §2 Nachtrag', icon: Scale, component: NachtragRechner },
];

export default function KalkulatorModule() {
  const [activeTab, setActiveTab] = useState('efb221');

  const ActiveComponent = TABS.find((t) => t.id === activeTab)?.component || EFB221Rechner;

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex rounded-xl bg-slate-100/80 border border-slate-200/60 p-1 gap-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-2
                px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-200 cursor-pointer
                ${
                  isActive
                    ? 'bg-white text-primary-600 shadow-sm shadow-slate-200/50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <ActiveComponent />
    </div>
  );
}
