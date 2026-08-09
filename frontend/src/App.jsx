import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import api from './services/api';

import AppShell from './components/AppShell.jsx';
import { BrandMark } from './components/BrandMark.jsx';
import { Spinner } from './components/ui';
import Login from './pages/Login.jsx';
import Setup from './pages/Setup.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clients from './pages/Clients.jsx';
import Users from './pages/Users.jsx';
import Logs from './pages/Logs.jsx';
import Settings from './pages/Settings.jsx';

/** Branded boot screen — the app's first frame should already look like the app. */
function Booting({ label = 'Loading HA-Hub…' }) {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="flex flex-col items-center gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-xl border border-brand/25 bg-brand/10 text-brand">
          <BrandMark size={24} />
        </span>
        <div className="flex items-center gap-2 text-sm text-fg-faint">
          <Spinner size={14} />
          {label}
        </div>
      </div>
    </div>
  );
}

function Protected({ children, admin }) {
  const { user, loading } = useAuth();
  if (loading) return <Booting label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'ADMIN') return <Navigate to="/" replace />;
  return children;
}

/** Keeps the browser tab in step with the current screen. */
const TITLES = {
  '/': 'Fleet',
  '/clients': 'Sites',
  '/users': 'Users',
  '/logs': 'Activity',
  '/settings': 'Settings',
  '/login': 'Sign in',
  '/setup': 'Set up',
};

export default function App() {
  const [needsSetup, setNeedsSetup] = useState(null);
  const location = useLocation();

  useEffect(() => {
    api
      .get('/auth/setup-status')
      .then((r) => setNeedsSetup(r.data.needsSetup))
      .catch(() => setNeedsSetup(false));
  }, []);

  useEffect(() => {
    const page = TITLES[location.pathname];
    document.title = page ? `${page} · HA-Hub` : 'HA-Hub';
  }, [location.pathname]);

  if (needsSetup === null) return <Booting />;
  if (needsSetup && location.pathname !== '/setup') return <Navigate to="/setup" replace />;

  return (
    <Routes>
      <Route path="/setup" element={<Setup onDone={() => setNeedsSetup(false)} />} />
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><AppShell /></Protected>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clients" element={<Protected admin><Clients /></Protected>} />
        <Route path="/users" element={<Protected admin><Users /></Protected>} />
        <Route path="/logs" element={<Protected admin><Logs /></Protected>} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
