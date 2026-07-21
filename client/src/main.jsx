import React from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import NewModelApp from './NewModelApp.jsx';
import './new-model.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <NewModelApp />
    <Analytics />
  </React.StrictMode>
);
