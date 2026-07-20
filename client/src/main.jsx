import React from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import InstitutionalApp from './InstitutionalApp.jsx';
import './institutional.css';
import './unified.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <InstitutionalApp />
    <Analytics />
  </React.StrictMode>
);
