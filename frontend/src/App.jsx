import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import api from './services/api';

import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Setup from './pages/Setup.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clients from './pages/Clients.jsx';
import Users from './pages/Users.jsx';
import Logs from './pages/Logs.jsx';
import Settings from './pages/Settings.jsx';

function Protected({ children, admin }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-slate-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'ADMIN') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const [needsSetup, setNeedsSetup] = useState(null);
  const location = useLocation();

  useEffect(() => {
    api.get('/auth/setup-status').then(r => setNeedsSetup(r.data.needsSetup)).catch(() => setNeedsSetup(false));
  }, []);

  if (needsSetup === null) return <div className="p-10 text-slate-400">Loading…</div>;
  if (needsSetup && location.pathname !== '/setup') return <Navigate to="/setup" replace />;

  return (
    <Routes>
      <Route path="/setup" element={<Setup onDone={() => setNeedsSetup(false)} />} />
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><Layout /></Protected>}>
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
