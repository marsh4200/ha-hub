import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { UpdateProvider } from './context/UpdateContext.jsx';
import { FleetProvider } from './context/FleetContext.jsx';
import { ToastProvider, ConfirmProvider } from './components/ui';
import './index.css';

/**
 * Provider order matters:
 *   Auth    — everything below needs to know who is signed in
 *   Update  — the axios interceptor reads its flag during a rebuild
 *   Toast   — Confirm and Fleet both report failures through it
 *   Confirm — pages await it before destructive work
 *   Fleet   — the shared client/stats layer, needs Auth above it
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <UpdateProvider>
          <ToastProvider>
            <ConfirmProvider>
              <FleetProvider>
                <App />
              </FleetProvider>
            </ConfirmProvider>
          </ToastProvider>
        </UpdateProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
