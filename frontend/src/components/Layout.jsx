import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard, Server, Users, ScrollText, Settings as SettingsIcon,
  LogOut, Menu, X, House,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import IdleWarning from './IdleWarning.jsx';

const NAV = [
  { to: '/',         label: 'Sites',    icon: LayoutDashboard, end: true },
  { to: '/clients',  label: 'Manage',   icon: Server,   admin: true },
  { to: '/users',    label: 'People',   icon: Users,    admin: true },
  { to: '/logs',     label: 'Activity', icon: ScrollText, admin: true },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

const sideItem = ({ isActive }) =>
  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
    isActive
      ? 'bg-brand/12 text-brand font-medium'
      : 'text-slate-400 hover:text-slate-100 hover:bg-bg-raised'
  }`;

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const isAdmin = user?.role === 'ADMIN';
  const items = NAV.filter(n => !n.admin || isAdmin);

  return (
    <div className="min-h-full flex">
      <IdleWarning />

      {/* Sidebar (desktop) / drawer (tablet) */}
      <aside
        className={`fixed lg:sticky lg:top-0 z-40 inset-y-0 left-0 w-64 h-screen bg-bg-soft/95 backdrop-blur
                    border-r border-line p-4 flex flex-col transform transition-transform duration-200
                    lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center gap-2.5 mb-7 px-1">
          <div className="w-9 h-9 rounded-lg grid place-items-center bg-brand/12 border border-brand/25">
            <House className="text-brand" size={17} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold tracking-tight leading-none">HA-Hub</div>
            <div className="text-2xs text-slate-500 mt-0.5">Home Assistant fleet</div>
          </div>
          <button
            className="lg:hidden ml-auto text-slate-500 hover:text-slate-200 p-1"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={sideItem} onClick={() => setOpen(false)}>
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-line pt-3 mt-3">
          <div className="px-2 mb-2">
            <div className="text-sm truncate">{user?.username}</div>
            <div className="text-2xs text-slate-500 uppercase tracking-wider">
              {user?.role === 'ADMIN' ? 'Administrator' : 'Standard access'}
            </div>
          </div>
          <button
            onClick={async () => { await logout(); navigate('/login'); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-100 hover:bg-bg-raised transition-colors"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0">
        <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 h-14 border-b border-line bg-bg-soft/90 backdrop-blur">
          <button onClick={() => setOpen(true)} className="text-slate-400 hover:text-slate-100 p-1" aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="w-7 h-7 rounded-md grid place-items-center bg-brand/12 border border-brand/25">
            <House className="text-brand" size={14} />
          </div>
          <span className="font-semibold tracking-tight">HA-Hub</span>
        </header>

        <main className="p-4 lg:p-8 max-w-[1400px] mx-auto pb-safe">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav — this runs on a phone most of the time, so the primary
          destinations belong under the thumb rather than behind a hamburger. */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-bg-soft/95 backdrop-blur border-t border-line
                      flex pb-[env(safe-area-inset-bottom,0px)]">
        {items.slice(0, 5).map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-2xs transition-colors ${
                isActive ? 'text-brand' : 'text-slate-500'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-30"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}
