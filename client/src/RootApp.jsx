import { useEffect, useMemo, useState } from 'react';
import {
  BrainCircuit, ChartNoAxesCombined, Globe2, Home, Network, ShieldCheck
} from 'lucide-react';
import InstitutionalApp from './InstitutionalApp.jsx';
import InstitutionalLab from './InstitutionalLab.jsx';
import ThemisHome from './ThemisHome.jsx';
import InstitutionalTwin from './InstitutionalTwin.jsx';
import { EnterpriseProduct, ENTERPRISE_PRODUCTS } from './EnterpriseProducts.jsx';

const MODE_KEY = 'themis-active-product-v1';

const FOUNDATION = [
  { key: 'home', label: 'Command Centre', icon: Home },
  { key: 'decision', label: 'Decision OS', icon: BrainCircuit },
  { key: 'lab', label: 'Capital & Scenario', icon: ChartNoAxesCombined },
  { key: 'twin', label: 'Decision Twin', icon: Network }
];

export default function RootApp() {
  const validModes = useMemo(() => new Set([...FOUNDATION.map(item => item.key), ...ENTERPRISE_PRODUCTS.map(item => item.key)]), []);
  const [mode, setMode] = useState(() => {
    const stored = localStorage.getItem(MODE_KEY);
    return validModes.has(stored) ? stored : 'home';
  });

  useEffect(() => localStorage.setItem(MODE_KEY, mode), [mode]);

  const renderActive = () => {
    if (mode === 'home') return <ThemisHome onNavigate={setMode} />;
    if (mode === 'decision') return <InstitutionalApp />;
    if (mode === 'lab') return <InstitutionalLab />;
    if (mode === 'twin') return <InstitutionalTwin />;
    return <EnterpriseProduct productKey={mode} />;
  };

  return <div className="themis-shell">
    <header className="themis-topbar">
      <button className="themis-brand" onClick={() => setMode('home')}>
        <span className="themis-brand-mark"><ShieldCheck size={20} /></span>
        <span><strong>THEMIS</strong><small>Institutional Decision & Execution OS</small></span>
      </button>
      <nav className="themis-nav" aria-label="Themis product navigation">
        {FOUNDATION.map(item => { const Icon = item.icon; return <button key={item.key} className={mode === item.key ? 'active' : ''} onClick={() => setMode(item.key)}><Icon size={14} />{item.label}</button>; })}
        {ENTERPRISE_PRODUCTS.map(item => { const Icon = item.icon; return <button key={item.key} className={mode === item.key ? 'active' : ''} onClick={() => setMode(item.key)}><Icon size={14} />{item.title}</button>; })}
      </nav>
    </header>

    <div className="themis-intelligence-bar">
      <Globe2 size={18} />
      <div><strong>EVIDENCE-LED OPEN INTELLIGENCE ARCHITECTURE</strong><small>Uploaded evidence remains the anchor. Current external research, model reasoning and autonomous actions depend on configured provider availability and approval controls. Stored Decision Memory is context—not the answer.</small></div>
      <ShieldCheck size={18} />
    </div>

    {renderActive()}
  </div>;
}
