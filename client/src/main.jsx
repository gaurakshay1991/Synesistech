import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

function PrototypeRuntimeNotice() {
  return (
    <div style={{
      background: '#0f2742',
      color: '#f8fafc',
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      fontSize: '12px',
      lineHeight: 1.45,
      padding: '8px 18px',
      textAlign: 'center',
      borderBottom: '1px solid rgba(255,255,255,0.12)'
    }}>
      Functional prototype mode is active. Document review, encrypted Neon storage, comparison, reporting and audit remain available without external AI quota; live model enrichment activates when funded provider capacity is available.
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PrototypeRuntimeNotice />
    <App />
  </React.StrictMode>
);
