import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Gauge, Server, Users, ScrollText, Settings as SettingsIcon,
  LogOut, Menu, X, ShieldCheck, User as UserIcon, ChevronDown, Wifi, WifiOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useFleet } from '../context/FleetContext.jsx';
import IdleWarning from './IdleWarning.jsx';
import { BrandLockup } from './BrandMark.jsx';
import cn from '../lib/cn';

/**
 * Navigation.
 *
 * The old labels — Sites / Manage / People / Activity — described where the
 * code lived rather than what the operator was doing. "Sites" and "Manage"
 * were the same objects seen two ways, with nothing in either word to say
 * which was which.
 *
 * Grouping by task fixes that: Monitor is the live view you keep open, Manage
 * is the register you edit, System is configuration. "Fleet" and "Sites" then
 * name genuinely different things — the health of everything, versus the list
 * of installations you administer.
 */
const NAV_GROUPS = [
  {
    label: 'Monitor',
    items: [
      { to: '/',      label: 'Fleet',    icon: Gauge,      end: true, desc: 'Live health of every site' },
      { to: '/logs',  label: 'Activity', icon: ScrollText, admin: true, desc: 'System and audit events' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/clients', label: 'Sites', icon: Server, admin: true, desc: 'Add, edit and back up installations' },
      { to: '/users',   label: 'Users', icon: Users,  admin: true, desc: 'Accounts, roles and site access' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/settings', label: 'Settings', icon: SettingsIcon, desc: 'Account, updates and export' },
    ],
  },
];

/** Flattened, permission-filtered list — used by the phone bottom bar. */
function visibleItems(isAdmin) {
  return NAV_GROUPS.flatMap((g) => g.items).filter((i) => !i.admin || isAdmin);
}

/* ── Sidebar link ───────────────────────────────────────────────────────── */

function NavItem({ item, onNavigate }) {
  const { to, label, icon: Icon, end } = item;
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'focus-ring group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors duration-150',
          isActive
            ? 'bg-brand/10 font-medium text-brand'
            : 'text-fg-muted hover:bg-raised hover:text-fg'
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Active marker on the rail edge, matching the site status rail. */}
          <span
            aria-hidden="true"
            className={cn(
              'absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full transition-opacity duration-150',
              isActive ? 'bg-brand opacity-100' : 'opacity-0'
            )}
          />
          <Icon size={16} className="shrink-0" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  );
}

/* ── Fleet pulse ────────────────────────────────────────────────────────── */

/**
 * The sidebar's one piece of live data.
 *
 * Whatever screen you are on, this answers "is anything on fire?" without a
 * navigation. It also proves the socket is alive — a monitoring tool that has
 * silently stopped updating is worse than no monitoring tool.
 */
function FleetPulse() {
  const { stats, attentionCount, connected, loading } = useFleet();
  const total = stats.total || 0;
  const online = stats.online || 0;
  const pct = total ? Math.round((online / total) * 100) : 0;

  const segments = [
    { key: 'online',  value: stats.online  || 0, color: '#34D399' },
    { key: 'offline', value: stats.offline || 0, color: '#FB7185' },
    { key: 'unknown', value: stats.unknown || 0, color: '#475569' },
  ].filter((s) => s.value > 0);

  return (
    <div className="rounded-xl border border-line bg-ink/50 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xs font-semibold uppercase tracking-wider text-fg-faint">Fleet</span>
        <span
          className="flex items-center gap-1 text-3xs text-fg-faint"
          title={connected ? 'Receiving live updates' : 'Reconnecting to the hub…'}
        >
          {connected ? (
            <Wifi size={11} className="text-live" aria-hidden="true" />
          ) : (
            <WifiOff size={11} className="text-warn" aria-hidden="true" />
          )}
          <span className="sr-only">{connected ? 'Live' : 'Reconnecting'}</span>
          {connected ? 'Live' : 'Retry'}
        </span>
      </div>

      {loading && total === 0 ? (
        <div className="mt-2.5 space-y-2">
          <div className="skeleton h-6 w-20" />
          <div className="skeleton h-1.5 w-full" />
        </div>
      ) : (
        <>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="font-display text-2xl font-semibold leading-none tnum text-fg">{online}</span>
            <span className="text-xs text-fg-faint tnum">/ {total} online</span>
          </div>

          <div className="mt-2.5 flex h-1.5 gap-px overflow-hidden rounded-full bg-ink">
            {segments.length > 0 ? (
              segments.map((s) => (
                <span
                  key={s.key}
                  className="transition-[width] duration-500 ease-snap"
                  style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
                />
              ))
            ) : (
              <span className="w-full bg-line" />
            )}
          </div>

          <div className="mt-2 text-2xs text-fg-faint">
            {total === 0 ? (
              'No sites registered'
            ) : attentionCount > 0 ? (
              <span className="text-warn">
                {attentionCount} {attentionCount === 1 ? 'site needs' : 'sites need'} attention
              </span>
            ) : (
              <span className="text-live">All sites healthy · {pct}%</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── User block ─────────────────────────────────────────────────────────── */

function UserBlock({ user, onSignOut, collapsedUp = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initials = (user?.username || '?').slice(0, 2).toUpperCase();

  return (
    <div ref={ref} className="relative">
      {open && (
        <div
          className={cn(
            'absolute inset-x-0 z-20 overflow-hidden rounded-xl border border-line-strong bg-float shadow-e3 animate-scaleIn',
            collapsedUp ? 'bottom-full mb-2' : 'top-full mt-2'
          )}
          role="menu"
        >
          <div className="border-b border-line px-3 py-2.5">
            <div className="truncate text-sm font-medium text-fg">{user?.username}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-2xs text-fg-faint">
              {isAdmin ? (
                <>
                  <ShieldCheck size={11} className="text-warn" aria-hidden="true" />
                  Administrator — full access
                </>
              ) : (
                <>
                  <UserIcon size={11} aria-hidden="true" />
                  Standard — assigned sites only
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={onSignOut}
            className="focus-ring flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-fg-muted transition-colors hover:bg-raised hover:text-down"
          >
            <LogOut size={15} aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="focus-ring flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-2 text-left transition-colors hover:border-line hover:bg-raised"
      >
        <span
          className={cn(
            'grid h-8 w-8 shrink-0 place-items-center rounded-lg border font-display text-2xs font-semibold',
            isAdmin
              ? 'border-warn/30 bg-warn/10 text-warn'
              : 'border-line bg-raised text-fg-muted'
          )}
        >
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-fg">{user?.username}</span>
          <span className="block truncate text-3xs uppercase tracking-wider text-fg-faint">
            {isAdmin ? 'Administrator' : 'Standard access'}
          </span>
        </span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={cn('shrink-0 text-fg-ghost transition-transform duration-150', open && 'rotate-180')}
        />
      </button>
    </div>
  );
}

/* ── Shell ──────────────────────────────────────────────────────────────── */

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  const isAdmin = user?.role === 'ADMIN';

  const groups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.admin || isAdmin) }))
    .filter((g) => g.items.length > 0);

  const bottomItems = visibleItems(isAdmin);

  // Close the drawer on navigation and send focus back to the page.
  useEffect(() => { setDrawer(false); }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('overflow-hidden', drawer);
    return () => document.body.classList.remove('overflow-hidden');
  }, [drawer]);

  async function signOut() {
    await logout();
    navigate('/login');
  }

  const sidebar = (
    <div className="flex h-full flex-col gap-5 p-4">
      <div className="flex items-center justify-between gap-2 pl-1">
        <BrandLockup />
        <button
          type="button"
          onClick={() => setDrawer(false)}
          aria-label="Close navigation"
          className="focus-ring -mr-1 grid h-8 w-8 place-items-center rounded-lg text-fg-faint transition-colors hover:bg-raised hover:text-fg lg:hidden"
        >
          <X size={17} aria-hidden="true" />
        </button>
      </div>

      <FleetPulse />

      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto pl-3 -ml-3" aria-label="Main">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="mb-1.5 px-2.5 text-3xs font-semibold uppercase tracking-[0.14em] text-fg-ghost">
              {g.label}
            </div>
            <div className="space-y-0.5">
              {g.items.map((item) => (
                <NavItem key={item.to} item={item} onNavigate={() => setDrawer(false)} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-line pt-3">
        <UserBlock user={user} onSignOut={signOut} collapsedUp />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-full">
      <IdleWarning />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[300] focus:rounded-lg focus:bg-brand focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 border-r border-line bg-ink lg:block">
        {sidebar}
      </aside>

      {/* Mobile / tablet drawer */}
      {drawer && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm animate-fadeIn lg:hidden"
            onClick={() => setDrawer(false)}
            aria-hidden="true"
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 w-[272px] max-w-[85vw] border-r border-line bg-ink shadow-e3 lg:hidden"
            style={{ animation: 'riseIn .22s cubic-bezier(.2,.7,.3,1) both' }}
          >
            {sidebar}
          </aside>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone / tablet top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-ink/90 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Open navigation"
            aria-expanded={drawer}
            className="focus-ring -ml-1.5 grid h-9 w-9 place-items-center rounded-lg text-fg-muted transition-colors hover:bg-raised hover:text-fg"
          >
            <Menu size={19} aria-hidden="true" />
          </button>
          <BrandLockup size="sm" tagline={null} />
          <span className="ml-auto">
            <ConnectionPip />
          </span>
        </header>

        <main id="main" className="pb-safe mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>

      {/* Phone bottom navigation — the primary destinations belong under the
          thumb, not behind a hamburger. The drawer stays for the full labels. */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur lg:hidden"
      >
        {bottomItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-3xs font-medium transition-colors',
                isActive ? 'text-brand' : 'text-fg-faint hover:text-fg-muted'
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute inset-x-4 top-0 h-[2px] rounded-b-full bg-brand transition-opacity',
                    isActive ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <Icon size={18} aria-hidden="true" />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** Compact live indicator for the phone header. */
function ConnectionPip() {
  const { connected, attentionCount } = useFleet();
  return (
    <span className="flex items-center gap-2">
      {attentionCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-md border border-warn/25 bg-warn/10 px-1.5 py-0.5 text-3xs font-medium tnum text-warn">
          {attentionCount} to fix
        </span>
      )}
      <span
        className={cn('dot', connected ? 'dot-online dot-pulse' : 'dot-warn')}
        role="status"
        aria-label={connected ? 'Connected — receiving live updates' : 'Reconnecting'}
      />
    </span>
  );
}
