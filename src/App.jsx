import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import ChatModule from './modules/Chat/ChatModule';
import DokumenteModule from './modules/Dokumente/DokumenteModule';
import KalkulatorModule from './modules/Kalkulator/KalkulatorModule';
import EinstellungenModule from './modules/Einstellungen/EinstellungenModule';
import ProjekteModule from './modules/Projekte/ProjekteModule';

export default function App() {
  const [activeModule, setActiveModule] = useState('chat');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e) => setIsMobile(e.matches);
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const renderModule = () => {
    switch (activeModule) {
      case 'chat':
        return <ChatModule />;
      case 'projekte':
        return <ProjekteModule />;
      case 'dokumente':
        return <DokumenteModule />;
      case 'kalkulator':
        return <KalkulatorModule />;
      case 'einstellungen':
        return <EinstellungenModule />;
      default:
        return <ChatModule />;
    }
  };

  const needsScrollWrapper = activeModule === 'dokumente' || activeModule === 'kalkulator' || activeModule === 'projekte';

  return (
    <div className="flex h-dvh overflow-hidden bg-white">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { fontSize: '14px', borderRadius: '10px' },
        }}
      />

      <Sidebar
        activeModule={activeModule}
        onNavigate={setActiveModule}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />

      <main
        className={`flex-1 overflow-hidden ${isMobile ? 'pb-14' : ''}`}
      >
        {needsScrollWrapper ? (
          <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
              {renderModule()}
            </div>
          </div>
        ) : (
          renderModule()
        )}
      </main>
    </div>
  );
}
