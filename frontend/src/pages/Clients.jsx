import { useEffect, useState } from 'react';
import {
  Plus, Edit2, Trash2, Copy, RefreshCw, X, ChevronDown, ChevronUp,
  FileArchive, KeyRound, ExternalLink, Loader2,
} from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge.jsx';
import VersionChip from '../components/VersionChip.jsx';
import BackupCard from '../components/BackupCard.jsx';
import HaTokenField from '../components/HaTokenField.jsx';
import { relTime, num, hostOf, triage, triageReasons, RAIL } from '../lib/format';

const EMPTY = { name: '', url: '', notes: '', group: '', tags: '', haToken: '' };

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [showModal, setShowModal] = useState(false);
  const [newToken, setNewToken] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    const { data } = await api.get('/clients');
    setClients(data.clients);
    // Keep the open modal in sync so the token panel reflects a save.
    setEditing(prev => (prev ? data.clients.find(c => c.id === prev.id) || prev : prev));
  }
  useEffect(() => { load(); }, []);

  function open(client) {
    setEditing(client || null);
    setForm(client ? {
      name: client.name,
      url: client.url,
      notes: client.notes || '',
      group: client.group || '',
      tags: (client.tags || []).join(', '),
      haToken: '',
    } : EMPTY);
    setErr('');
    setNewToken(null);
    setShowModal(true);
  }

  async function save(e) {
    e.preventDefault();
    setErr('');
    setSaving(true);
    const payload = {
      name: form.name,
      url: form.url,
      notes: form.notes || null,
      group: form.group || null,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    };
    // Empty means "leave the stored token alone" — only send a real value.
    if (form.haToken.trim()) payload.haToken = form.haToken.trim();

    try {
      if (editing) await api.patch(`/clients/${editing.id}`, payload);
      else await api.post('/clients', payload);
      setShowModal(false);
      await load();
    } catch (e2) {
      setErr(e2.response?.data?.error || 'Could not save this site.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(c) {
    if (!confirm(`Delete "${c.name}"?\n\nThis also deletes its stored backup and access token. It cannot be undone.`)) return;
    await api.delete(`/clients/${c.id}`);
    load();
  }

  async function refresh(c) {
    setBusyId(c.id);
    try {
      const { data } = await api.post(`/clients/${c.id}/refresh`);
      setClients(prev => prev.map(x => (x.id === c.id ? { ...x, ...data.client } : x)));
    } catch (e) {
      alert(e.response?.data?.error || 'Could not reach that site.');
    } finally {
      setBusyId(null);
    }
  }

  async function rotateAgentToken(c) {
    if (!confirm(`Rotate the agent token for "${c.name}"?\n\nOnly needed if you run the optional heartbeat agent. Any installed agent will stop reporting until you update it.`)) return;
    const { data } = await api.post(`/clients/${c.id}/rotate-token`);
    setNewToken({ token: data.apiToken, name: c.name });
    setShowModal(true);
  }

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-1">Administration</div>
          <h1 className="text-2xl font-semibold tracking-tight">Manage sites</h1>
        </div>
        <button className="btn-primary" onClick={() => open(null)}>
          <Plus size={16} /> Add site
        </button>
      </header>

      <div className="space-y-2">
        {clients.length === 0 && (
          <div className="card p-12 text-center">
            <p className="text-slate-300 font-medium">No sites yet</p>
            <p className="text-slate-500 text-sm mt-1">Add a Home Assistant instance to start monitoring it.</p>
            <button className="btn-primary mt-4" onClick={() => open(null)}><Plus size={16} /> Add site</button>
          </div>
        )}

        {clients.map(c => {
          const expanded = expandedId === c.id;
          const t = triage(c);
          const reasons = triageReasons(c);
          return (
            <div key={c.id} className={`card rail ${RAIL[t]} overflow-hidden`}>
              <div className="flex items-center gap-3 p-3 pl-4 hover:bg-bg-raised/40 transition-colors">
                <button
                  onClick={() => setExpandedId(expanded ? null : c.id)}
                  className="text-slate-600 hover:text-slate-200 p-1 shrink-0"
                  aria-label={expanded ? 'Collapse' : 'Expand'}
                >
                  {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{c.name}</span>
                    {c.hasHaToken && (
                      <KeyRound
                        size={11}
                        className={c.haTokenStatus === 'OK' || !c.haTokenStatus ? 'text-brand/70' : 'text-down'}
                        title={c.haTokenStatus === 'OK' || !c.haTokenStatus ? 'Access token linked' : `Token: ${c.haTokenStatus}`}
                      />
                    )}
                  </div>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-2xs text-slate-500 hover:text-brand truncate font-mono inline-flex items-center gap-1"
                  >
                    {hostOf(c.url)} <ExternalLink size={9} />
                  </a>
                </div>

                <div className="hidden md:flex items-center gap-2 shrink-0">
                  <VersionChip client={c} />
                </div>

                <StatusBadge status={c.status} />

                <div className="flex gap-1 shrink-0">
                  <button
                    className="btn-secondary btn-icon"
                    onClick={() => refresh(c)}
                    title="Check now"
                    disabled={busyId === c.id}
                  >
                    {busyId === c.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  </button>
                  <button className="btn-secondary btn-icon" onClick={() => setExpandedId(expanded ? null : c.id)} title="Backup">
                    <FileArchive size={14} />
                  </button>
                  <button className="btn-secondary btn-icon" onClick={() => open(c)} title="Edit">
                    <Edit2 size={14} />
                  </button>
                  <button className="btn-danger btn-icon" onClick={() => remove(c)} title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {reasons.length > 0 && (
                <div className="px-4 pb-2.5 pl-11 flex flex-wrap gap-1.5">
                  {reasons.map(r => <span key={r} className={t === 'down' ? 'chip-down' : 'chip-warn'}>{r}</span>)}
                </div>
              )}

              {expanded && (
                <div className="p-4 pl-4 border-t border-line bg-bg/40 space-y-4">
                  {c.hasHaToken && c.entityCount != null && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <Stat label="Entities" value={num(c.entityCount)} />
                      <Stat label="Unavailable" value={num(c.unavailableCount)} tone={c.unavailableCount > 0 ? 'warn' : null} />
                      <Stat label="Integrations" value={num(c.integrationCount)} />
                      <Stat label="Automations" value={num(c.automationCount)} />
                    </div>
                  )}

                  {c.haDetails?.updates?.length > 0 && (
                    <div>
                      <div className="eyebrow mb-2">Pending updates</div>
                      <div className="space-y-1">
                        {c.haDetails.updates.map(u => (
                          <div key={u.entityId} className="flex items-center justify-between gap-3 text-xs bg-bg-raised border border-line rounded-lg px-2.5 py-1.5">
                            <span className="truncate text-slate-300">{u.title}</span>
                            <span className="font-mono tnum text-slate-500 shrink-0">
                              {u.installed} <span className="text-warn">→ {u.latest}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    <Field label="Location" value={c.locationName} />
                    <Field label="Time zone" value={c.timeZone} />
                    <Field label="Group" value={c.group} />
                    <Field label="Last checked" value={c.lastDetailAt ? relTime(c.lastDetailAt) : null} />
                  </div>

                  {c.notes && (
                    <div>
                      <div className="eyebrow mb-1">Notes</div>
                      <div className="text-sm text-slate-300 whitespace-pre-wrap">{c.notes}</div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button className="btn-ghost !text-xs !px-2 !py-1" onClick={() => rotateAgentToken(c)}>
                      <RefreshCw size={12} /> Rotate agent token
                    </button>
                  </div>

                  <BackupCard client={c} isAdmin={true} onChange={load} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showModal && (
        <Modal
          onClose={() => setShowModal(false)}
          title={newToken ? 'Agent token' : editing ? `Edit ${editing.name}` : 'Add site'}
        >
          {newToken ? (
            <TokenShown token={newToken} onClose={() => { setShowModal(false); setNewToken(null); }} />
          ) : (
            <form onSubmit={save} className="space-y-4">
              {err && (
                <div className="text-sm bg-down/10 text-down border border-down/25 rounded-lg p-2.5">{err}</div>
              )}

              <div>
                <label className="label">Name</label>
                <input className="input" required value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>

              <div>
                <label className="label">Address</label>
                <input className="input font-mono text-xs" required type="url"
                  placeholder="https://client1.mydomain.com"
                  value={form.url}
                  onChange={e => setForm({ ...form, url: e.target.value })} />
                <p className="hint">The Cloudflare Tunnel hostname for this site. HA-Hub links straight here — it never proxies the traffic.</p>
              </div>

              <HaTokenField
                value={form.haToken}
                onChange={v => setForm({ ...form, haToken: v })}
                client={editing}
                onCleared={load}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Group</label>
                  <input className="input" value={form.group}
                    onChange={e => setForm({ ...form, group: e.target.value })} />
                </div>
                <div>
                  <label className="label">Tags</label>
                  <input className="input" placeholder="lodge, solar" value={form.tags}
                    onChange={e => setForm({ ...form, tags: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn-primary" disabled={saving}>
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {editing ? 'Save changes' : 'Add site'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="bg-bg-raised border border-line rounded-lg px-3 py-2">
      <div className="text-2xs uppercase tracking-wide text-slate-600">{label}</div>
      <div className={`text-lg font-mono tnum ${tone === 'warn' ? 'text-warn' : 'text-slate-200'}`}>{value}</div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line/60 py-1">
      <span className="text-slate-600">{label}</span>
      <span className="text-slate-300 truncate">{value || '—'}</span>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="card p-5 w-full max-w-lg my-8 animate-riseIn" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold tracking-tight">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 p-1" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TokenShown({ token, onClose }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(token.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-warn bg-warn/10 border border-warn/25 rounded-lg p-3">
        Agent token for <b>{token.name}</b>. This is the only time it is shown — copy it now.
      </p>
      <div className="bg-bg border border-line rounded-lg p-3 font-mono text-xs break-all">{token.token}</div>
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={copy}><Copy size={14} />{copied ? 'Copied' : 'Copy'}</button>
        <button className="btn-primary" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
