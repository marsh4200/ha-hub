import { Activity, KeyRound, ShieldCheck, HardDriveDownload } from 'lucide-react';
import { BrandMark } from './BrandMark.jsx';

/**
 * The shell both signed-out screens sit in.
 *
 * Login and Setup previously looked like two unrelated forms that happened to
 * share a colour scheme. Putting them in one shell is what makes the product
 * feel continuous from the very first screen: the same mark, the same left
 * panel, the same form treatment you will see again inside the app.
 *
 * The left panel is hidden below `lg` rather than stacked. On a phone the only
 * thing that matters is the form, and pushing it below a marketing panel would
 * mean scrolling to sign in.
 */
const POINTS = [
  { icon: Activity, title: 'Live fleet status', body: 'Reachability, version and pending updates for every site, refreshed continuously.' },
  { icon: KeyRound, title: 'Encrypted access tokens', body: 'Home Assistant tokens are stored encrypted and never sent back to the browser.' },
  { icon: HardDriveDownload, title: 'Backups in one place', body: 'Keep a current backup and its emergency encryption key alongside each installation.' },
];

export default function AuthLayout({ children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
      {/* ── Brand panel ───────────────────────────────────────────── */}
      <aside className="relative hidden overflow-hidden border-r border-line bg-ink lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* One light source, matching the app shell. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(900px 500px at 10% -10%, rgba(56,189,248,0.12), transparent 60%)',
          }}
        />

        <div className="relative flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-brand/25 bg-brand/10 text-brand">
            <BrandMark size={21} />
          </span>
          <span>
            <span className="block font-display text-lg font-semibold leading-none tracking-tight text-fg">
              HA<span className="text-brand">·</span>Hub
            </span>
            <span className="mt-1 block text-3xs uppercase tracking-[0.16em] text-fg-faint">
              Home Assistant fleet management
            </span>
          </span>
        </div>

        <div className="relative max-w-md">
          <h2 className="font-display text-[32px] font-semibold leading-[1.15] tracking-tight text-fg">
            Every installation you look after, on one screen.
          </h2>
          <ul className="mt-8 space-y-5">
            {POINTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3.5">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-panel text-brand">
                  <Icon size={15} aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-fg">{title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-fg-muted">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-2xs text-fg-ghost">
          <ShieldCheck size={13} aria-hidden="true" />
          Self-hosted. Your data never leaves your server.
        </p>
      </aside>

      {/* ── Form panel ────────────────────────────────────────────── */}
      <main className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-[380px]">
          {/* The mark comes back on phones, where the left panel is hidden. */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-brand/25 bg-brand/10 text-brand">
              <BrandMark size={19} />
            </span>
            <span className="font-display text-base font-semibold tracking-tight text-fg">
              HA<span className="text-brand">·</span>Hub
            </span>
          </div>

          {children}

          {footer && <div className="mt-8 border-t border-line pt-5">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
