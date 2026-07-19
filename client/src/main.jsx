import React from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import PublicApp from './PublicApp.jsx';
import './public-app.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PublicApp />
    <Analytics />
  </React.StrictMode>
);
