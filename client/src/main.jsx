import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { AuthProvider } from './context/AuthContext.jsx';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './Routes.jsx';
import { ThemeProvider } from './context/ThemeContext';
import { HelmetProvider } from 'react-helmet-async';

// Restore path encoded by 404.html SPA redirect (e.g. /?p=%2Fsome%2Fpath)
(function () {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('p');
  if (redirect) {
    window.history.replaceState(null, '', decodeURIComponent(redirect));
  }
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </HelmetProvider>
  </React.StrictMode>
);
