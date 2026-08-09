import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Copy, RefreshCw, KeyRound, ExternalLink, Server,
  SearchX, FileArchive, Info, Check, ShieldAlert, Boxes, Puzzle, Zap, AlertTriangle,
} from 'lucide-react';
import api from '../services/api';
import { useFleet } from '../context/FleetContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import VersionChip from '../components/VersionChip.jsx';
import BackupCard from '../components/BackupCard.jsx';
import HaTokenField from '../components/HaTokenField.jsx';
import {
  Button, IconButton, Badge, Modal, EmptyState, PageHeader, SearchInput,
  FilterChip, Field, FieldRow, Input, Textarea, Alert, Skeleton,
  TableWrap, Table, THead, TBody, TH, TR, TD, useToast, useConfirm,
} from '../components/ui';
import {
  relTime, num, bytes, hostOf, triage, RAIL, faults, notes, matchesSite, absTime, plural,
} from '../lib/format';
import cn from '../lib/cn';

const EMPTY = { name: '', url: '', notes: '', group: '', tags: '', haToken: '' };

const FILTERS = [
  { key: 'all',       label: 'All' },
  { key: 'attention', label: 'Needs action', dot: '#FBBF24' },
  { key: 'updates',   label: 'Updates',      dot: '#38BDF8' },
  { key: 'unlinked',  label: 'No token',     dot: '#64748B' },
];

/**
 * The site register.
 *
 * This is the administrative view of the same objects the Fleet screen shows,
 * and the two are deliberately different shapes. Fleet is for browsing and
 * triage, so it uses cards. This screen is for comparing and editing — is that
 * one on an older version than this one, which of these has no backup — and
 * comparison is what a table is for.
 *
 * Row detail opens in a sheet rather than an accordion. The backup panel and
 * token controls are tall enough that expanding them inline pushed every other
 * row off the screen, which defeats the point of having a table.
 */
export default function Clients() {
  const { clients, loading, reload, patchClient } = useFleet();
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();

  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [detailId, setDetailId] = useState(null);
  const [editing, setEditing] = useState(null);   // client object, or 'new'
  const [form, setForm] = useState(EMPTY);
  const [newToken, setNewToken] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Deep link from the Fleet screen's "Add site" button.
  useEffect(() => {
    if (params.get('new') === '1') {
      openEditor(null);
      params.delete('new');
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detail = clients.find((c) => c.id === detailId) || null;

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const t = triage(c);
      if (filter === 'attention' && !(t === 'down' || t === 'warn')) return false;
      if (filter === 'updates' && !c.updateAvailable) return false;
      if (filter === 'unlinked' && c.hasHaToken) return false;
      return matchesSite(c, q);
    });
  }, [clients, q, filter]);

  function openEditor(client) {
    setEditing(client || 'new');
    setForm(
      client
        ? {
            name: client.name,
            url: client.url,
            notes: client.notes || '',
            group: client.group || '',
            tags: (client.tags || []).join(', '),
            haToken: '',
          }
        : EMPTY
    );
    setErr('');
    setNewToken(null);
  }

  const editingClient = editing && editing !== 'new' ? clients.find((c) => c.id === editing.id) || editing : null;

  async function save(e) {
    e.preventDefault();
    setErr('');
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      url: form.url.trim(),
      notes: form.notes || null,
      group: form.group || null,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    };
    // Empty means "leave the stored token alone" — only send a real value.
    if (form.haToken.trim()) payload.haToken = form.haToken.trim();

    try {
      if (editingClient) {
        await api.patch(`/clients/${editingClient.id}`, payload);
        toast.success(`${payload.name} saved.`);
      } else {
        await api.post('/clients', payload);
        toast.success(`${payload.name} added. HA-Hub will check it shortly.`);
      }
      setEditing(null);
      await reload({ silent: true });
    } catch (e2) {
      setErr(e2.response?.data?.error || 'This site could not be saved. Check the address and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(c) {
    const ok = await confirm({
      title: `Delete ${c.name}?`,
      tone: 'danger',
      message:
        'This removes the site from HA-Hub along with its stored backup, emergency encryption key and access token. Home Assistant itself is not touched.',
      details: `${hostOf(c.url)}${c.backupFilename ? ` · backup ${c.backupFilename} will be deleted` : ''}`,
      requireText: c.name,
      confirmLabel: 'Delete site',
    });
    if (!ok) return;
    try {
      await api.delete(`/clients/${c.id}`);
      if (detailId === c.id) setDetailId(null);
      toast.success(`${c.name} deleted.`);
      reload({ silent: true });
    } catch (e) {
      toast.error(e.response?.data?.error || 'The site could not be deleted.');
    }
  }

  async function refresh(c) {
    setBusyId(c.id);
    try {
      const { data } = await api.post(`/clients/${c.id}/refresh`);
      patchClient({ id: c.id, ...data.client });
      toast.success(`${c.name} checked.`);
    } catch (e) {
      toast.error(e.response?.data?.error || `Could not reach ${c.name}.`);
    } finally {
      setBusyId(null);
    }
  }

  async function rotateAgentToken(c) {
    const ok = await confirm({
      title: `Rotate the agent token for ${c.name}?`,
      tone: 'danger',
      message:
        'Only needed if you run the optional heartbeat agent on this site. Any agent already installed stops reporting until you paste the new token into its configuration.',
      confirmLabel: 'Rotate token',
    });
    if (!ok) return;
    try {
      const { data } = await api.post(`/clients/${c.id}/rotate-token`);
      setNewToken({ token: data.apiToken, name: c.name });
    } catch (e) {
      toast.error(e.response?.data?.error || 'The token could not be rotated.');
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        kicker="Manage"
        title="Sites"
        description="Register Home Assistant installations, link access tokens and keep a backup for each one."
        meta={
          clients.length > 0 && (
            <span className="text-2xs tnum text-fg-faint">
              {num(clients.length)} {plural(clients.length, 'site', 'sites')} ·{' '}
              {num(clients.filter((c) => c.hasHaToken).length)} linked ·{' '}
              {num(clients.filter((c) => c.backupFilename).length)} with a backup
            </span>
          )
        }
        actions={
          <Button variant="primary" icon={Plus} onClick={() => openEditor(null)}>
            Add site
          </Button>
        }
      />

      {clients.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Search sites by name, address, group or tag"
            resultCount={filtered.length}
            totalCount={clients.length}
            className="min-w-[220px]"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((f) => (
              <FilterChip
                key={f.key}
                label={f.label}
                dot={f.dot}
                active={filter === f.key}
                onClick={() => setFilter(f.key)}
                count={
                  f.key === 'all'
                    ? clients.length
                    : clients.filter((c) => {
                        const t = triage(c);
                        if (f.key === 'attention') return t === 'down' || t === 'warn';
                        if (f.key === 'updates') return !!c.updateAvailable;
                        return !c.hasHaToken;
                      }).length
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────── */}
      {loading && clients.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No sites registered"
          description="Add a Home Assistant installation and HA-Hub starts tracking its reachability, version and pending updates straight away."
          action={<Button variant="primary" icon={Plus} onClick={() => openEditor(null)}>Add your first site</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          compact
          title="Nothing matches those filters"
          description="Try a different search term or clear the filters."
          action={<Button variant="secondary" onClick={() => { setQ(''); setFilter('all'); }}>Clear filters</Button>}
        />
      ) : (
        <>
          {/* Desktop: a real table, because this screen exists for comparison. */}
          <TableWrap className="hidden lg:block" label="Registered Home Assistant sites">
            <Table>
              <THead>
                <TR>
                  <TH className="w-[30%]">Site</TH>
                  <TH>Status</TH>
                  <TH>Version</TH>
                  <TH>Token</TH>
                  <TH>Backup</TH>
                  <TH>Last seen</TH>
                  <TH align="right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((c) => {
                  const t = triage(c);
                  const problems = faults(c).filter((f) => f !== 'Offline');
                  return (
                    <TR key={c.id} interactive>
                      <TD className={cn('rail pl-5', RAIL[t])}>
                        <button
                          type="button"
                          onClick={() => setDetailId(c.id)}
                          className="focus-ring block max-w-full rounded text-left"
                        >
                          <span className="block truncate text-sm font-medium text-fg hover:text-brand">
                            {c.name}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-3xs text-fg-faint">
                            {hostOf(c.url)}
                          </span>
                        </button>
                        {problems.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {problems.map((p) => <Badge key={p} tone="warn" size="sm">{p}</Badge>)}
                          </div>
                        )}
                      </TD>
                      <TD><StatusBadge status={c.status} size="sm" /></TD>
                      <TD><VersionChip client={c} size="sm" /></TD>
                      <TD>
                        <TokenCell client={c} />
                      </TD>
                      <TD>
                        {c.backupFilename ? (
                          <span className="inline-flex items-center gap-1.5 font-mono text-2xs tnum text-fg-muted">
                            <FileArchive size={11} className="text-fg-ghost" aria-hidden="true" />
                            {bytes(c.backupSize)}
                          </span>
                        ) : (
                          <span className="text-2xs text-fg-ghost">None</span>
                        )}
                      </TD>
                      <TD className="whitespace-nowrap font-mono text-2xs tnum text-fg-faint">
                        {relTime(c.lastSeenAt)}
                      </TD>
                      <TD align="right">
                        <div className="inline-flex items-center gap-0.5">
                          <IconButton icon={Info} size="sm" label={`Details for ${c.name}`} onClick={() => setDetailId(c.id)} />
                          <IconButton icon={RefreshCw} size="sm" label={`Check ${c.name} now`} loading={busyId === c.id} onClick={() => refresh(c)} />
                          <IconButton icon={Pencil} size="sm" label={`Edit ${c.name}`} onClick={() => openEditor(c)} />
                          <IconButton icon={Trash2} size="sm" variant="danger" label={`Delete ${c.name}`} onClick={() => remove(c)} />
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableWrap>

          {/* Phone and tablet: the same data stacked, no horizontal scrolling. */}
          <div className="space-y-2 lg:hidden">
            {filtered.map((c) => {
              const t = triage(c);
              return (
                <div key={c.id} className={cn('rail rounded-xl border border-line bg-panel p-3 pl-4 shadow-e1', RAIL[t])}>
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setDetailId(c.id)}
                      className="focus-ring min-w-0 flex-1 rounded text-left"
                    >
                      <span className="block truncate text-sm font-medium text-fg">{c.name}</span>
                      <span className="mt-0.5 block truncate font-mono text-3xs text-fg-faint">{hostOf(c.url)}</span>
                    </button>
                    <StatusBadge status={c.status} size="sm" />
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <VersionChip client={c} size="sm" />
                    <TokenCell client={c} />
                    {c.backupFilename && (
                      <Badge tone="neutral" size="sm" icon={FileArchive} mono>{bytes(c.backupSize)}</Badge>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5">
                    <span className="font-mono text-3xs tnum text-fg-faint">
                      Last seen {relTime(c.lastSeenAt)}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <IconButton icon={Info} size="sm" label={`Details for ${c.name}`} onClick={() => setDetailId(c.id)} />
                      <IconButton icon={RefreshCw} size="sm" label={`Check ${c.name} now`} loading={busyId === c.id} onClick={() => refresh(c)} />
                      <IconButton icon={Pencil} size="sm" label={`Edit ${c.name}`} onClick={() => openEditor(c)} />
                      <IconButton icon={Trash2} size="sm" variant="danger" label={`Delete ${c.name}`} onClick={() => remove(c)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Detail sheet ─────────────────────────────────────────────── */}
      {detail && (
        <Modal
          open
          size="lg"
          title={detail.name}
          description={hostOf(detail.url)}
          icon={Server}
          onClose={() => setDetailId(null)}
          footer={
            <>
              <Button variant="ghost" icon={ExternalLink} onClick={() => window.open(detail.url, '_blank', 'noreferrer')}>
                Open Home Assistant
              </Button>
              <Button variant="secondary" icon={Pencil} onClick={() => { setDetailId(null); openEditor(detail); }}>
                Edit site
              </Button>
            </>
          }
        >
          <SiteDetail client={detail} onRotate={() => rotateAgentToken(detail)} onChanged={() => reload({ silent: true })} />
        </Modal>
      )}

      {/* ── Add / edit ───────────────────────────────────────────────── */}
      {editing && !newToken && (
        <Modal
          open
          size="md"
          icon={editingClient ? Pencil : Plus}
          title={editingClient ? `Edit ${editingClient.name}` : 'Add a site'}
          description={
            editingClient
              ? 'Changes take effect on the next status check.'
              : 'Point HA-Hub at a Home Assistant installation you manage.'
          }
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="primary" form="site-form" type="submit" loading={saving}>
                {editingClient ? 'Save changes' : 'Add site'}
              </Button>
            </>
          }
        >
          <form id="site-form" onSubmit={save} className="space-y-4">
            {err && <Alert tone="error">{err}</Alert>}

            <Field label="Name" required>
              {(a) => (
                <Input
                  {...a}
                  required
                  maxLength={64}
                  value={form.name}
                  placeholder="Everton Engineering"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              )}
            </Field>

            <Field
              label="Address"
              required
              hint="The public hostname for this site — usually its Cloudflare Tunnel address. HA-Hub links straight to it and never proxies the traffic."
            >
              {(a) => (
                <Input
                  {...a}
                  required
                  type="url"
                  className="font-mono text-xs"
                  placeholder="https://client1.example.co.za"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
              )}
            </Field>

            <HaTokenField
              value={form.haToken}
              onChange={(v) => setForm({ ...form, haToken: v })}
              client={editingClient}
              onCleared={() => reload({ silent: true })}
            />

            <FieldRow>
              <Field label="Group" hint="Optional grouping, e.g. a region or a reseller.">
                {(a) => (
                  <Input {...a} value={form.group} placeholder="Gauteng" onChange={(e) => setForm({ ...form, group: e.target.value })} />
                )}
              </Field>
              <Field label="Tags" hint="Comma separated.">
                {(a) => (
                  <Input {...a} value={form.tags} placeholder="lodge, solar" onChange={(e) => setForm({ ...form, tags: e.target.value })} />
                )}
              </Field>
            </FieldRow>

            <Field label="Notes">
              {(a) => (
                <Textarea {...a} rows={3} value={form.notes} placeholder="Anything worth knowing next time this site needs attention." onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              )}
            </Field>
          </form>
        </Modal>
      )}

      {/* ── Agent token, shown once ──────────────────────────────────── */}
      {newToken && (
        <Modal
          open
          size="md"
          tone="danger"
          icon={ShieldAlert}
          title="Agent token"
          description={`For ${newToken.name}. This is the only time it will be shown.`}
          onClose={() => { setNewToken(null); setEditing(null); }}
          footer={<Button variant="primary" onClick={() => { setNewToken(null); setEditing(null); }}>Done</Button>}
        >
          <TokenReveal token={newToken.token} />
        </Modal>
      )}
    </div>
  );
}

/* ── Pieces ───────────────────────────────────────────────────────────── */

function TokenCell({ client: c }) {
  if (!c.hasHaToken) return <Badge tone="neutral" size="sm">Not linked</Badge>;
  const s = c.haTokenStatus;
  if (s === 'UNAUTHORIZED') return <Badge tone="down" size="sm" icon={KeyRound}>Rejected</Badge>;
  if (s === 'DECRYPT_FAILED') return <Badge tone="down" size="sm" icon={KeyRound}>Unreadable</Badge>;
  if (s === 'UNREACHABLE') return <Badge tone="warn" size="sm" icon={KeyRound}>Unreachable</Badge>;
  return <Badge tone="live" size="sm" icon={KeyRound}>Linked</Badge>;
}

function SiteDetail({ client: c, onRotate, onChanged }) {
  const problems = faults(c);
  const remarks = notes(c);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={c.status} />
        <VersionChip client={c} />
        <TokenCell client={c} />
        {problems.map((p) => <Badge key={p} tone={p === 'Offline' ? 'down' : 'warn'}>{p}</Badge>)}
        {remarks.map((r) => <Badge key={r} tone="brand">{r}</Badge>)}
      </div>

      {c.hasHaToken && c.entityCount != null && (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat icon={Boxes} label="Entities" value={num(c.entityCount)} />
          <Stat
            icon={AlertTriangle}
            label="Unavailable"
            value={num(c.unavailableCount)}
            hint={c.unavailableCount > 0 ? 'normal on most sites' : null}
          />
          <Stat icon={Puzzle} label="Integrations" value={num(c.integrationCount)} />
          <Stat icon={Zap} label="Automations" value={num(c.automationCount)} />
        </dl>
      )}

      {c.haDetails?.updates?.length > 0 && (
        <section>
          <h3 className="eyebrow mb-2">Pending updates</h3>
          <ul className="space-y-1">
            {c.haDetails.updates.map((u) => (
              <li
                key={u.entityId}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-ink/50 px-2.5 py-1.5 text-xs"
              >
                <span className="truncate text-fg-muted">{u.title}</span>
                <span className="shrink-0 font-mono tnum text-fg-faint">
                  {u.installed} <span className="text-brand">→ {u.latest}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <dl className="grid gap-x-6 sm:grid-cols-2">
        <DetailRow label="Location" value={c.locationName} />
        <DetailRow label="Time zone" value={c.timeZone} />
        <DetailRow label="Group" value={c.group} />
        <DetailRow label="Tags" value={(c.tags || []).join(', ')} />
        <DetailRow label="Last checked" value={c.lastDetailAt ? absTime(c.lastDetailAt) : null} mono />
        <DetailRow label="Last seen" value={c.lastSeenAt ? absTime(c.lastSeenAt) : null} mono />
      </dl>

      {c.notes && (
        <section>
          <h3 className="eyebrow mb-1.5">Notes</h3>
          <p className="whitespace-pre-wrap rounded-lg border border-line bg-ink/50 p-3 text-sm leading-relaxed text-fg-muted">
            {c.notes}
          </p>
        </section>
      )}

      <BackupCard client={c} isAdmin onChange={onChanged} />

      <section className="rounded-xl border border-down/25 bg-down/[0.05] p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <ShieldAlert size={14} className="text-down" aria-hidden="true" />
          Heartbeat agent
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">
          Only relevant if you run the optional agent on this site. Rotating the token invalidates the
          one the installed agent is using, and it stops reporting until you update its configuration.
        </p>
        <Button variant="danger" size="sm" icon={RefreshCw} className="mt-3" onClick={onRotate}>
          Rotate agent token
        </Button>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-lg border border-line bg-ink/50 px-3 py-2">
      <dt className="flex items-center gap-1.5 text-3xs uppercase tracking-wide text-fg-ghost">
        <Icon size={10} aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-lg tnum text-fg">{value}</dd>
      {hint && <p className="mt-0.5 text-3xs leading-tight text-fg-ghost">{hint}</p>}
    </div>
  );
}

function DetailRow({ label, value, mono }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/70 py-1.5 text-xs">
      <dt className="shrink-0 text-fg-faint">{label}</dt>
      <dd className={cn('truncate text-right text-fg-muted', mono && 'font-mono tnum text-2xs')}>
        {value || '—'}
      </dd>
    </div>
  );
}

function TokenReveal({ token }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="space-y-3">
      <Alert tone="warning" title="Copy this now">
        HA-Hub stores only a hash of this token. If you navigate away without copying it, you will have
        to rotate it again.
      </Alert>
      <code className="block break-all rounded-lg border border-line bg-ink p-3 font-mono text-xs leading-relaxed text-fg">
        {token}
      </code>
      <Button variant={copied ? 'outline' : 'secondary'} icon={copied ? Check : Copy} onClick={copy}>
        {copied ? 'Copied to clipboard' : 'Copy token'}
      </Button>
    </div>
  );
}
