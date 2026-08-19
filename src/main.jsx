import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { PenyediaAuth } from './konteks/Auth.jsx';
import PenangkapGalat from './komponen/PenangkapGalat.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PenangkapGalat>
      <PenyediaAuth>
        <App />
      </PenyediaAuth>
    </PenangkapGalat>
  </React.StrictMode>
);
