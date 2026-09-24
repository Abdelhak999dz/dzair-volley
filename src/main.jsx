// Security guard first: anti-framing, optional domain lock, automation
// detection and media deterrents run before React renders anything.
import './security/guard.js';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
