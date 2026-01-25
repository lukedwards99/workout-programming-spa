import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import 'bootstrap/dist/css/bootstrap.min.css';
import { DbProvider } from './db/DbContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DbProvider>
      <App />
    </DbProvider>
  </React.StrictMode>,
);
