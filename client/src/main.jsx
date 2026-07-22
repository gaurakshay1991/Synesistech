import React from 'react';
import { createRoot } from 'react-dom/client';
import RootApp from './RootApp.jsx';
import './institutional.css';
import './lab.css';
import './themis.css';
import './themis-suite.css';
import './live-review-brain.css';
import './regulatory-command.css';
import './platform-home.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);
