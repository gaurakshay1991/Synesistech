import React from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import RootApp from './RootApp.jsx';
import './institutional.css';
import './lab.css';
import './themis.css';
import './regulatory-command.css';
import './platform-home.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootApp />
    <Analytics />
  </React.StrictMode>
);
