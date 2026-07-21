import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles-1.css';
import './styles-2.css';
import './styles-3.css';
import './styles-4.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
