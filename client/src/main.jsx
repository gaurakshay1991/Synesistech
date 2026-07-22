import React from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import ParmaApp from './ParmaApp.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ParmaApp />
    <Analytics />
  </React.StrictMode>
);
