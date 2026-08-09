import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
try { Object.defineProperty(globalThis, 'location', { value: dom.window.location, configurable: true }); } catch (_) {}
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.Event = dom.window.Event;
globalThis.KeyboardEvent = dom.window.KeyboardEvent;
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.URL.createObjectURL = () => 'blob:x';
globalThis.URL.revokeObjectURL = () => {};

(async () => {
  const React = (await import('react')).default;
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { MemoryRouter } = await import('react-router-dom');
  const { AuthProvider } = await import('../src/context/AuthContext.jsx');
  const { UpdateProvider } = await import('../src/context/UpdateContext.jsx');
  const { FleetProvider } = await import('../src/context/FleetContext.jsx');
  const UI = await import('../src/components/ui/index.js');
  const Dashboard = (await import('../src/pages/Dashboard.jsx')).default;
  const Clients   = (await import('../src/pages/Clients.jsx')).default;
  const Users     = (await import('../src/pages/Users.jsx')).default;
  const Logs      = (await import('../src/pages/Logs.jsx')).default;
  const AppShell  = (await import('../src/components/AppShell.jsx')).default;

  localStorage.setItem('ha-hub-token', 'test-token');

  const results = [];
  const assert = (name, cond, extra = '') =>
    results.push([cond ? 'ok' : 'FAIL', name + (cond ? '' : ` — ${extra}`)]);

  function Tree({ children, route = '/' }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <UpdateProvider>
            <UI.ToastProvider>
              <UI.ConfirmProvider>
                <FleetProvider>{children}</FleetProvider>
              </UI.ConfirmProvider>
            </UI.ToastProvider>
          </UpdateProvider>
        </AuthProvider>
      </MemoryRouter>
    );
  }

  async function mount(node, route = '/') {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Tree route={route}>{node}</Tree>); });
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    return { host, root };
  }
  const txt = (h) => (h.textContent || '').replace(/\s+/g, ' ');
  const click = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }); };

  /* ── Dashboard with real data ───────────────────────────────────── */
  {
    const { host } = await mount(<Dashboard />);
    const t = txt(host);
    assert('Dashboard shows fleet counts', t.includes('2') && t.includes('4'));
    assert('Dashboard renders all four sites', ['Everton Engineering','Riverside Lodge','New Install','Bushveld Cottage'].every(n => t.includes(n)));
    assert('Dashboard bands broken sites first', t.indexOf('Needs attention') < t.indexOf('Updates available'), t.slice(0,120));
    assert('Dashboard shows update band', t.includes('Updates available'));
    assert('Dashboard verdict names the offline site', t.includes('unreachable'));
    // Filter by clicking the Offline stat tile
    const offlineTile = [...host.querySelectorAll('button')].find(b => txt(b).startsWith('Offline'));
    assert('Offline stat tile exists', !!offlineTile);
    if (offlineTile) {
      await click(offlineTile);
      const t2 = txt(host);
      assert('Filtering to Offline hides healthy sites', t2.includes('Riverside Lodge') && !t2.includes('Bushveld Cottage'));
      assert('Filtering shows a result count', t2.includes('Showing 1 of 4'));
    }
  }

  /* ── Clients table ──────────────────────────────────────────────── */
  {
    const { host } = await mount(<Clients />, '/clients');
    const t = txt(host);
    assert('Sites page renders a table', !!host.querySelector('table'));
    assert('Sites table has 4 rows', host.querySelectorAll('tbody tr').length === 4, String(host.querySelectorAll('tbody tr').length));
    assert('Sites table shows backup size', t.includes('700 MB'));
    assert('Sites table shows token state', t.includes('Rejected') && t.includes('Not linked'));
    // Open the add dialog
    const addBtn = [...host.querySelectorAll('button')].find(b => txt(b) === 'Add site');
    await click(addBtn);
    assert('Add dialog opens', !!document.querySelector('[role="dialog"]'));
    assert('Dialog is labelled', document.querySelector('[role="dialog"]')?.getAttribute('aria-modal') === 'true');
    // ESC closes it
    await act(async () => {
      document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    assert('Escape closes the dialog', !document.querySelector('[role="dialog"]'));
    assert('Body scroll lock released', !document.body.classList.contains('overflow-hidden'));
  }

  /* ── Users ──────────────────────────────────────────────────────── */
  {
    const { host } = await mount(<Users />, '/users');
    const t = txt(host);
    assert('Users lists both accounts', t.includes('marsh') && t.includes('tech'));
    assert('Users describes roles in words', t.includes('Administrator') && t.includes('Standard'));
    assert('Users summarises site access', t.includes('Every site') && t.includes('2 of 4 sites'));
  }

  /* ── Logs ───────────────────────────────────────────────────────── */
  {
    const { host } = await mount(<Logs />, '/logs');
    const t = txt(host);
    assert('Logs groups by day', t.includes('Today'));
    assert('Logs shows severities', t.includes('Error') && t.includes('Audit'));
    assert('Logs shows the actor', t.includes('by marsh'));
  }

  /* ── Shell ──────────────────────────────────────────────────────── */
  {
    const { host } = await mount(<AppShell />, '/');
    const t = txt(host);
    assert('Sidebar groups navigation', t.includes('Monitor') && t.includes('Manage') && t.includes('System'));
    assert('Sidebar names Fleet and Sites separately', t.includes('Fleet') && t.includes('Sites'));
    assert('Fleet pulse shows online ratio', t.includes('/ 4 online'));
    assert('Skip link present', !![...host.querySelectorAll('a')].find(a => txt(a) === 'Skip to content'));
    const iconOnly = [...host.querySelectorAll('button')].filter(b => !txt(b).trim());
    assert('Every icon-only button is labelled', iconOnly.every(b => b.getAttribute('aria-label')), `${iconOnly.filter(b=>!b.getAttribute('aria-label')).length} unlabelled`);
  }

  /* ── Confirm dialog resolves ────────────────────────────────────── */
  {
    let resolved = null;
    function Probe() {
      const confirm = UI.useConfirm();
      return <button onClick={async () => { resolved = await confirm({ title: 'Delete?', tone: 'danger', confirmLabel: 'Delete it' }); }}>go</button>;
    }
    const { host } = await mount(<Probe />);
    await click(host.querySelector('button'));
    assert('Confirm dialog opens', !!document.querySelector('[role="dialog"]'));
    const del = [...document.querySelectorAll('[role="dialog"] button')].find(b => txt(b) === 'Delete it');
    await click(del);
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    assert('Confirm resolves true', resolved === true, String(resolved));
  }

  /* ── Toast ──────────────────────────────────────────────────────── */
  {
    function Probe() {
      const toast = UI.useToast();
      return <button onClick={() => toast.success('Saved it')}>go</button>;
    }
    const { host } = await mount(<Probe />);
    await click(host.querySelector('button'));
    assert('Toast appears', (document.body.textContent || '').includes('Saved it'));
    assert('Toast is announced', !!document.querySelector('[role="status"]'));
  }

  const fails = results.filter(r => r[0] === 'FAIL');
  results.forEach(([s, n]) => console.log(`${s.padEnd(5)} ${n}`));
  console.log(`\n${results.length - fails.length}/${results.length} assertions passed`);
  process.exit(fails.length ? 1 : 0);
})();
