import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Copy, RefreshCw, X, ChevronDown, ChevronUp, FileArchive } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge.jsx';
import BackupCard from '../components/BackupCard.jsx';

const EMPTY = { name: '', url: '', notes: '', group: '', tags: '' };

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [showModal, setShowModal] = useState(false);
  const [newToken, setNewToken] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [err, setErr] = useState('');

  async function load() {
    const { data } = await api.get('/clients');
    setClients(data.clients);
  }
  useEffect(() => { load(); }, []);

  function open(client) {
    setEditing(client || null);
    setForm(client ? {
      name: client.name, url: client.url, notes: client.notes || '',
      group: client.group || '', tags: (client.tags || []).join(', '),
    } : EMPTY);
    setErr(''); setNewToken(null); setShowAdvanced(false); setShowModal(true);
  }

  async function save(e) {
    e.preventDefault(); setErr('');
    const payload = {
      name: form.name, url: form.url, notes: form.notes || null,
      group: form.group || null,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    };
    try {
      if (editing) {
        await api.patch(`/clients/${editing.id}`, payload);
      } else {
        await api.post('/clients', payload);
      }
      setShowModal(false);
      await load();
    } catch (e) { setErr(e.response?.data?.error || 'Save failed'); }
  }

  async function remove(c) {
    if (!confirm(`Delete client "${c.name}"? This also deletes any stored backup. This cannot be undone.`)) return;
    await api.delete(`/clients/${c.id}`);
    load();
  }

  async function showToken(c) {
    if (!confirm(`Rotate API token for "${c.name}"?\n\nOnly needed if you want to install the optional agent for richer status info.`)) return;
    const { data } = await api.post(`/clients/${c.id}/rotate-token`);
    setNewToken({ token: data.apiToken, name: c.name });
  }

  function toggleExpand(id) {
    setExpandedId(prev => prev === id ? null : id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-slate-400 text-sm">Manage Home Assistant instances — status checked every 30s</p>
        </div>
        <button className="btn-primary" onClick={() => open(null)}><Plus size={16}/>Add client</button>
      </div>

      <div className="space-y-2">
        {clients.length === 0 && (
          <div className="card p-10 text-center text-slate-500">No clients yet — add your first one.</div>
        )}

        {clients.map(c => {
          const expanded = expandedId === c.id;
          return (
            <div key={c.id} className="card overflow-hidden">
              {/* Row */}
              <div className="flex items-center gap-3 p-3 hover:bg-bg-soft/40">
                <button
                  onClick={() => toggleExpand(c.id)}
                  className="text-slate-400 hover:text-slate-200 px-1"
                  aria-label={expanded ? 'Collapse' : 'Expand'}
                >
                  {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{c.name}</div>
                  <a href={c.url} target="_blank" rel="noreferrer"
                     className="text-xs text-slate-500 hover:text-brand truncate block">{c.url}</a>
                </div>

                <StatusBadge status={c.status}/>

                <span className="hidden md:inline text-xs text-slate-400 min-w-[60px]">
                  {c.haVersion || '—'}
                </span>

                <span className="hidden lg:inline text-xs text-slate-400 min-w-[80px]">
                  {c.group || '—'}
                </span>

                <div className="flex gap-1">
                  <button className="btn-secondary !px-2 !py-1.5" onClick={() => toggleExpand(c.id)} title="Backup">
                    <FileArchive size={14}/>
                  </button>
                  <button className="btn-secondary !px-2 !py-1.5" onClick={() => showToken(c)} title="Rotate token"><RefreshCw size={14}/></button>
                  <button className="btn-secondary !px-2 !py-1.5" onClick={() => open(c)} title="Edit"><Edit2 size={14}/></button>
                  <button className="btn-danger !px-2 !py-1.5" onClick={() => remove(c)} title="Delete"><Trash2 size={14}/></button>
                </div>
              </div>

              {/* Expanded section */}
              {expanded && (
                <div className="p-4 border-t border-line bg-bg-soft/30 space-y-3">
                  {c.notes && (
                    <div className="text-sm text-slate-300">
                      <div className="text-xs text-slate-500 mb-1">Notes</div>
                      <div className="whitespace-pre-wrap">{c.notes}</div>
                    </div>
                  )}
                  <BackupCard client={c} isAdmin={true} onChange={load}/>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add/edit modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)} title={editing ? `Edit ${editing.name}` : 'Add client'}>
          {newToken ? (
            <TokenShown token={newToken} onClose={() => { setShowModal(false); setNewToken(null); }} />
          ) : (
            <form onSubmit={save} className="space-y-3">
              {err && <div className="text-sm bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg p-2">{err}</div>}
              <div><label className="label">Name</label><input className="input" required value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/></div>
              <div>
                <label className="label">Cloudflare URL</label>
                <input className="input" required type="url" placeholder="https://client1.mydomain.com" value={form.url} onChange={e=>setForm({...form, url:e.target.value})}/>
                <p className="text-xs text-slate-500 mt-1">Online/offline is detected by polling this URL every 30s.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Group</label><input className="input" value={form.group} onChange={e=>setForm({...form, group:e.target.value})}/></div>
                <div><label className="label">Tags (comma separated)</label><input className="input" value={form.tags} onChange={e=>setForm({...form, tags:e.target.value})}/></div>
              </div>
              <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})}/></div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn-primary">{editing ? 'Save' : 'Create'}</button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose}><X size={18}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TokenShown({ token, onClose }) {
  const [copied, setCopied] = useState(false);
  function copy() { navigator.clipboard.writeText(token.token); setCopied(true); setTimeout(()=>setCopied(false), 1500); }
  return (
    <div className="space-y-3">
      <p className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
        ⚠ Agent token for <b>{token.name}</b>. This is shown only once — copy it now.
      </p>
      <div className="bg-bg-soft border border-line rounded-lg p-3 font-mono text-xs break-all">{token.token}</div>
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={copy}><Copy size={14}/>{copied ? 'Copied!' : 'Copy'}</button>
        <button className="btn-primary" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
