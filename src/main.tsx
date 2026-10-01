import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import App from './App';
import { SessionProvider } from './contexts/SessionContext';
import './App.css';

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <SessionProvider><App /></SessionProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
