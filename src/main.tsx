import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import App from './App';
import './App.css';

const basename = import.meta.env.MODE === 'production' ? '/workout-programming-spa' : undefined;

const sessionRedirectKey = 'gh-redirect';

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
