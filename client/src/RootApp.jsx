import { useEffect, useState } from 'react';
import { BrainCircuit, Building2, ChartNoAxesCombined, Globe2, Landmark, ShieldCheck } from 'lucide-react';
import InstitutionalApp from './InstitutionalApp.jsx';
import InstitutionalLab from './InstitutionalLab.jsx';
import PlatformHome from './PlatformHome.jsx';
import RegulatoryCommand from './RegulatoryCommand.jsx';

const MODE_KEY = 'themis-active-solution-v1';
const VALID_MODES = new Set(['home', 'decision', 'regulatory', 'lab']);

export default function RootApp() {
  const [mode, setMode] = useState(() => {
    const stored = localStorage.getItem(MODE_KEY);
    return VALID_MODES.has(stored) ? stored : 'home';
  });
  useEffect(() => localStorage.setItem(MODE_KEY, mode), [mode]);

  return <div className="synesis-root themis-root">
    <div className="synesis-solution-switcher" role="navigation" aria-label="Themis platform navigation">
      <button className={mode === 'home' ? 'active' : ''} onClick={() => setMode('home')}><Building2 size={16} /><span><strong>Themis Platform</strong><small>Vision, capabilities, moat and solution packs</small></span></button>
      <button className={mode === 'decision' ? 'active' : ''} onClick={() => setMode('decision')}><BrainCircuit size={16} /><span><strong>Decision OS</strong><small>Documents, obligations, decisions and actions</small></span></button>
      <button className={mode === 'regulatory' ? 'active' : ''} onClick={() => setMode('regulatory')}><Landmark size={16} /><span><strong>Regulatory Command</strong><small>Change, controls, evidence and closure</small></span></button>
      <button className={mode === 'lab' ? 'active' : ''} onClick={() => setMode('lab')}><ChartNoAxesCombined size={16} /><span><strong>Capital & Scenario Lab</strong><small>Portfolio, mandate and simulations</small></span></button>
    </div>

    {mode !== 'home' && <div style={{ margin: '0 18px 12px', padding: '10px 14px', display: 'flex', gap: 12, alignItems: 'center', border: '1px solid rgba(37,99,235,.18)', borderRadius: 12, background: 'rgba(239,246,255,.9)', color: '#172554' }}>
      <Globe2 size={19} />
      <div style={{ flex: 1 }}><strong style={{ display: 'block', fontSize: 13 }}>THEMIS INSTITUTIONAL INTELLIGENCE LAYER</strong><small style={{ display: 'block', marginTop: 2, lineHeight: 1.4 }}>Uploaded evidence remains the anchor. Open intelligence, Decision Memory, institutional impact mapping and controlled execution are shared platform capabilities. Each solution pack applies them to a different class of institutional work.</small></div>
      <ShieldCheck size={19} />
    </div>}

    {mode === 'home'
      ? <PlatformHome onNavigate={setMode} />
      : mode === 'decision'
        ? <InstitutionalApp />
        : mode === 'regulatory'
          ? <RegulatoryCommand />
          : <InstitutionalLab />}
  </div>;
}
