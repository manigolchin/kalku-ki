import { useEffect, useState } from 'react';
import {
  MessageSquare,
  FileText,
  Calculator,
  Settings,
  PanelLeftClose,
  PanelLeft,
  FolderKanban,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'chat', label: 'KALKU-Chat', Icon: MessageSquare },
  { id: 'projekte', label: 'Projekte', Icon: FolderKanban },
  { id: 'dokumente', label: 'Dokumente', Icon: FileText },
  { id: 'kalkulator', label: 'Kalkulator', Icon: Calculator },
  { id: 'einstellungen', label: 'Einstellungen', Icon: Settings },
];

export default function Sidebar({
  activeModule,
  onNavigate,
  collapsed,
  onToggleCollapse,
}) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e) => setIsMobile(e.matches);
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (isMobile) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-white/95 backdrop-blur-lg border-t border-slate-100 px-2 py-1 safe-area-pb">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const active = activeModule === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 cursor-pointer ${
                active
                  ? 'text-primary-600'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.5} />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <aside
      className={`relative flex flex-col bg-white border-r border-slate-100 transition-[width] duration-200 ease-in-out shrink-0 ${
        collapsed ? 'w-[64px]' : 'w-[232px]'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white font-bold text-lg shrink-0 select-none shadow-sm shadow-brand-500/20">
          K
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <span className="text-[15px] font-bold text-slate-900 tracking-tight">
              KALKU-KI
            </span>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide mt-0.5">
              Baukalkulation
            </p>
          </div>
        )}
      </div>

      {collapsed && <div className="h-4" />}

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 px-2 mt-2">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const active = activeModule === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              title={collapsed ? label : undefined}
              className={`relative flex items-center gap-3 rounded-xl text-[13px] font-medium transition-all duration-200 cursor-pointer ${
                collapsed ? 'justify-center px-0 py-3' : 'px-4 py-2.5'
              } ${
                active
                  ? 'text-primary-600 bg-primary-50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon
                size={collapsed ? 20 : 18}
                strokeWidth={active ? 2.2 : 1.5}
                className="shrink-0"
              />
              {!collapsed && <span className="truncate">{label}</span>}
              {active && !collapsed && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary-500 rounded-r-full" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="px-3 pb-5 mt-auto">
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center w-9 h-9 mx-auto rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-200 cursor-pointer"
          title={collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>
    </aside>
  );
}
