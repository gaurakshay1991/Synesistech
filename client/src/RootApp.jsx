import { useEffect, useState } from 'react';
import { BrainCircuit, ChartNoAxesCombined, Globe2, ShieldCheck } from 'lucide-react';
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
    <div style={{ margin: '0 18px 12px', padding: '10px 14px', display: 'flex', gap: 12, alignItems: 'center', border: '1px solid rgba(37,99,235,.18)', borderRadius: 12, background: 'rgba(239,246,255,.9)', color: '#172554' }}>
      <Globe2 size={19} />
      <div style={{ flex: 1 }}><strong style={{ display: 'block', fontSize: 13 }}>THEMIS OPEN INTELLIGENCE IS ACTIVE</strong><small style={{ display: 'block', marginTop: 2, lineHeight: 1.4 }}>Analysis starts from the uploaded evidence, independently checks current external intelligence and separates facts, sources, inference, uncertainty and controlled actions. Stored Decision Memory is context—not the answer.</small></div>
      <ShieldCheck size={19} />
    </div>
    {mode === 'decision' ? <InstitutionalApp /> : <InstitutionalLab />}
  </div>;
}
