import { useEffect, useState } from 'react';
import {
  BrainCircuit,
  ChartNoAxesCombined,
  Globe2,
  Home,
  Landmark,
  ShieldCheck
} from 'lucide-react';
import InstitutionalApp from './InstitutionalApp.jsx';
import InstitutionalLab from './InstitutionalLab.jsx';
import RegulatoryCommand from './RegulatoryCommand.jsx';
import ThemisHome from './ThemisHome.jsx';

// Keep each institutional workspace routed through one coherent application shell.
const MODE_KEY = 'themis-active-workspace-v2';
const VALID_MODES = new Set(['home', 'decision', 'regulatory', 'lab']);

export default function RootApp() {
  const [mode, setMode] = useState(() => {
    const stored = localStorage.getItem(MODE_KEY);
    return VALID_MODES.has(stored) ? stored : 'home';
  });

  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  return (
    <div className="themis-shell">
      <header className="themis-topbar">
        <button
          className="themis-brand"
          onClick={() => setMode('home')}
          aria-label="Open Themis command centre"
        >
          <span className="themis-brand-mark">T</span>
          <span>
            <strong>THEMIS</strong>
            <small>Institutional Intelligence & Execution OS</small>
          </span>
        </button>

        <nav className="themis-nav" aria-label="Themis workspaces">
          <button
            className={mode === 'home' ? 'active' : ''}
            onClick={() => setMode('home')}
          >
            <Home size={15} />
            Command Centre
          </button>
          <button
            className={mode === 'decision' ? 'active' : ''}
            onClick={() => setMode('decision')}
          >
            <BrainCircuit size={15} />
            Decision OS
          </button>
          <button
            className={mode === 'regulatory' ? 'active' : ''}
            onClick={() => setMode('regulatory')}
          >
            <Landmark size={15} />
            Regulatory Command
          </button>
          <button
            className={mode === 'lab' ? 'active' : ''}
            onClick={() => setMode('lab')}
          >
            <ChartNoAxesCombined size={15} />
            Institutional Lab
          </button>
        </nav>

        <div className="themis-intelligence-note">
          <Globe2 size={14} />
          Uploaded evidence + current intelligence
          <ShieldCheck size={14} />
        </div>
      </header>

      {mode === 'home' && <ThemisHome onOpen={setMode} />}
      {mode === 'decision' && <InstitutionalApp />}
      {mode === 'regulatory' && <RegulatoryCommand />}
      {mode === 'lab' && <InstitutionalLab />}
    </div>
  );
}
