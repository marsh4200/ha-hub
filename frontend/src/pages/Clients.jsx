import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Copy, RefreshCw, X, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge.jsx';

const EMPTY = { name: '', url: '', notes: '', group: '', tags: '' };

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [showModal, setShowModal] = useState(false);
  const [newToken, setNewToken] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
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
        setShowModal(false);
      } else {
        await api.post('/clients', payload);
        // No token modal — just close. Status will populate within 30 seconds.
        setShowModal(false);
      }
      await load();
    } catch (e) { setErr(e.response?.data?.error || 'Save failed'); }
  }

  async function remove(c) {
    if (!confirm(`Delete client "${c.name}"? This cannot be undone.`)) return;
    await api.delete(`/clients/${c.id}`);
    load();
  }

  async function showToken(c) {
    // Show the agent token for users who want to install the optional agent
    if (!confirm(`Rotate API token for "${c.name}"?\n\nOnly needed if you want to install the optional agent for richer status info (version, uptime). The current agent (if any) will stop working until updated.`)) return;
    const { data } = await api.post(`/clients/${c.id}/rotate-token`);
    setNewToken({ token: data.apiToken, name: c.name });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-slate-400 text-sm">Manage Home Assistant instances — status is checked automatically every 30 seconds</p></div>
        <button className="btn-primary" onClick={() => open(null)}><Plus size={16}/>Add client</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-400 bg-bg-soft">
            <tr><th className="px-4 py-2.5 font-medium">Name</th><th className="font-medium">Status</th>
              <th className="font-medium">URL</th><th className="font-medium">Version</th>
              <th className="font-medium">Group</th><th className="px-4 font-medium text-right">Actions</th></tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id} className="border-t border-line">
                <td className="px-4 py-2.5">{c.name}</td>
                <td><StatusBadge status={c.status}/></td>
                <td className="text-slate-400 truncate max-w-xs"><a className="hover:text-brand" href={c.url} target="_blank" rel="noreferrer">{c.url}</a></td>
                <td className="text-slate-400">{c.haVersion || '—'}</td>
                <td className="text-slate-400">{c.group || '—'}</td>
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex gap-1">
                    <button className="btn-secondary !px-2 !py-1.5" onClick={() => showToken(c)} title="Rotate agent token (optional)"><RefreshCw size={14}/></button>
                    <button className="btn-secondary !px-2 !py-1.5" onClick={() => open(c)} title="Edit"><Edit2 size={14}/></button>
                    <button className="btn-danger !px-2 !py-1.5" onClick={() => remove(c)} title="Delete"><Trash2 size={14}/></button>
                  </div>
                </td>
              </tr>
            ))}
            {clients.length === 0 && <tr><td colSpan="6" className="text-center text-slate-500 py-10">No clients yet — add your first one.</td></tr>}
          </tbody>
        </table>
      </div>

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
                <p className="text-xs text-slate-500 mt-1">Online/offline is detected by polling this URL every 30 seconds. No setup needed on the HA box.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Group</label><input className="input" value={form.group} onChange={e=>setForm({...form, group:e.target.value})}/></div>
                <div><label className="label">Tags (comma separated)</label><input className="input" value={form.tags} onChange={e=>setForm({...form, tags:e.target.value})}/></div>
              </div>
              <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})}/></div>

              {!editing && (
                <div className="border-t border-line pt-3">
                  <button type="button" onClick={() => setShowAdvanced(v => !v)} className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">
                    {showAdvanced ? <ChevronUp size={14}/> : <ChevronDown size={14}/>} Advanced: install optional agent
                  </button>
                  {showAdvanced && (
                    <div className="mt-2 text-xs text-slate-400 bg-bg-soft border border-line rounded-lg p-3 space-y-2">
                      <p>URL polling already shows online/offline. The agent is optional and adds:</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        <li>HA version (sometimes more reliable than URL polling)</li>
                        <li>Hostname & uptime</li>
                        <li>Detects HA process crashes even when the tunnel still responds</li>
                      </ul>
                      <p>After creating the client, click the <RefreshCw size={12} className="inline"/> icon next to it to generate a token, then install the agent. See <code className="text-brand">docs/AGENT.md</code> on GitHub.</p>
                    </div>
                  )}
                </div>
              )}

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
