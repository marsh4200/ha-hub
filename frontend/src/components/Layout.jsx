import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { LayoutDashboard, Server, Users, ScrollText, Settings as SettingsIcon, LogOut, Menu, X, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import IdleWarning from './IdleWarning.jsx';

const item = ({ isActive }) =>
  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
    isActive ? 'bg-brand/15 text-brand' : 'text-slate-300 hover:bg-bg-soft'
  }`;

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="min-h-full flex bg-bg">
      <IdleWarning />

      {/* Sidebar */}
      <aside className={`fixed lg:static z-30 inset-y-0 left-0 w-64 bg-bg-soft border-r border-line p-4 flex flex-col transform transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-2 mb-6 px-2">
          <div className="w-9 h-9 rounded-lg bg-brand/15 grid place-items-center"><Home className="text-brand" size={18} /></div>
          <div>
            <div className="font-semibold">HA-Hub</div>
            <div className="text-xs text-slate-500">Multi-tenant manager</div>
          </div>
          <button className="lg:hidden ml-auto text-slate-400" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>

        <nav className="flex-1 space-y-1">
          <NavLink to="/" end className={item} onClick={() => setOpen(false)}><LayoutDashboard size={16}/>Dashboard</NavLink>
          {isAdmin && <NavLink to="/clients" className={item} onClick={() => setOpen(false)}><Server size={16}/>Clients</NavLink>}
          {isAdmin && <NavLink to="/users" className={item} onClick={() => setOpen(false)}><Users size={16}/>Users</NavLink>}
          {isAdmin && <NavLink to="/logs" className={item} onClick={() => setOpen(false)}><ScrollText size={16}/>Logs</NavLink>}
          <NavLink to="/settings" className={item} onClick={() => setOpen(false)}><SettingsIcon size={16}/>Settings</NavLink>
        </nav>

        <div className="border-t border-line pt-3 mt-3">
          <div className="px-2 mb-2">
            <div className="text-sm">{user?.username}</div>
            <div className="text-xs text-slate-500">{user?.role}</div>
          </div>
          <button
            onClick={async () => { await logout(); navigate('/login'); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-bg-card"
          ><LogOut size={16}/>Sign out</button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <header className="lg:hidden flex items-center gap-3 px-4 h-14 border-b border-line bg-bg-soft">
          <button onClick={() => setOpen(true)} className="text-slate-300"><Menu size={20} /></button>
          <span className="font-semibold">HA-Hub</span>
        </header>
        <main className="p-4 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>

      {open && <div className="lg:hidden fixed inset-0 bg-black/60 z-20" onClick={() => setOpen(false)} />}
    </div>
  );
}
