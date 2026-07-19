import React from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import LivePublicApp from './LivePublicApp.jsx';
import './live-public.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LivePublicApp />
    <Analytics />
  </React.StrictMode>
);
