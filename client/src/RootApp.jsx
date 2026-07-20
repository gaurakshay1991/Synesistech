import { useEffect, useState } from 'react';
import { BrainCircuit, ChartNoAxesCombined } from 'lucide-react';
import InstitutionalApp from './InstitutionalApp.jsx';
import InstitutionalLab from './InstitutionalLab.jsx';

const MODE_KEY = 'live-synesis-active-solution-v4';

export default function RootApp() {
  const [mode, setMode] = useState(() => localStorage.getItem(MODE_KEY) || 'decision');
  useEffect(() => localStorage.setItem(MODE_KEY, mode), [mode]);
  return <div className="synesis-root">
    <div className="synesis-solution-switcher" role="navigation" aria-label="Synesis solution switcher">
      <button className={mode === 'decision' ? 'active' : ''} onClick={() => setMode('decision')}><BrainCircuit size={16} /><span><strong>Decision OS</strong><small>Documents, obligations, decisions and controlled actions</small></span></button>
      <button className={mode === 'lab' ? 'active' : ''} onClick={() => setMode('lab')}><ChartNoAxesCombined size={16} /><span><strong>Capital & Scenario Lab</strong><small>Portfolio, mandate, regulation and simulations</small></span></button>
    </div>
    {mode === 'decision' ? <InstitutionalApp /> : <InstitutionalLab />}
  </div>;
}
