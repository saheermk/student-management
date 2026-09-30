import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { InstitutionProvider } from './context/InstitutionContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <InstitutionProvider>
      <App />
    </InstitutionProvider>
  </React.StrictMode>
);

