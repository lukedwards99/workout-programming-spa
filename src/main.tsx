import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import App from './App';
import './App.css';

// Vite normalizes BASE_URL with a trailing slash. Deriving the router basename
// from it keeps local, production, and /dev deployments aligned.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

const sessionRedirectKey = 'gh-redirect';

if (import.meta.env.VITE_E2E === 'true') {
  void import('./testing/e2eBridge').then(({ installE2EBridge }) => {
    installE2EBridge();
  });
}

(function restoreRedirect() {
  const redirect = sessionStorage.getItem(sessionRedirectKey);
  if (redirect) {
    sessionStorage.removeItem(sessionRedirectKey);
    window.history.replaceState(null, '', redirect);
  }
})();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
