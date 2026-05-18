import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, X, Shield, User as UserIcon } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext.jsx';

const EMPTY = { username: '', email: '', password: '', role: 'USER', clientIds: [] };

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState('');

  async function load() {
    const [u, c] = await Promise.all([api.get('/users'), api.get('/clients')]);
    setUsers(u.data.users); setClients(c.data.clients);
  }
  useEffect(() => { load(); }, []);

  function open(u) {
    setEditing(u || null);
    setForm(u ? {
      username: u.username, email: u.email || '', password: '',
      role: u.role, clientIds: u.clientIds || [],
    } : EMPTY);
    setErr(''); setShowModal(true);
  }

  async function save(e) {
    e.preventDefault(); setErr('');
    try {
      if (editing) {
        const payload = { email: form.email || null, role: form.role, clientIds: form.clientIds };
        if (form.password) payload.password = form.password;
        await api.patch(`/users/${editing.id}`, payload);
      } else {
        await api.post('/users', {
          username: form.username, email: form.email || null,
          password: form.password, role: form.role, clientIds: form.clientIds,
        });
      }
      setShowModal(false); load();
    } catch (e) { setErr(e.response?.data?.error || 'Save failed'); }
  }

  async function remove(u) {
    if (!confirm(`Delete user "${u.username}"?`)) return;
    try { await api.delete(`/users/${u.id}`); load(); }
    catch (e) { alert(e.response?.data?.error || 'Delete failed'); }
  }

  function toggleClient(id) {
    setForm(f => ({ ...f, clientIds: f.clientIds.includes(id)
      ? f.clientIds.filter(x => x !== id) : [...f.clientIds, id] }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-slate-400 text-sm">Manage who can access the platform and which clients they see</p></div>
        <button className="btn-primary" onClick={() => open(null)}><Plus size={16}/>Add user</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-400 bg-bg-soft">
            <tr><th className="px-4 py-2.5 font-medium">User</th><th className="font-medium">Role</th>
              <th className="font-medium">Clients</th><th className="font-medium">Last login</th>
              <th className="px-4 font-medium text-right">Actions</th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t border-line">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    {u.role === 'ADMIN' ? <Shield className="text-amber-400" size={16}/> : <UserIcon className="text-slate-400" size={16}/>}
                    <div><div>{u.username}</div><div className="text-xs text-slate-500">{u.email || '—'}</div></div>
                  </div>
                </td>
                <td><span className={u.role === 'ADMIN' ? 'badge bg-amber-500/15 text-amber-400' : 'badge bg-slate-500/15 text-slate-300'}>{u.role}</span></td>
                <td className="text-slate-400">{u.role === 'ADMIN' ? 'All' : `${u.clientIds.length}`}</td>
                <td className="text-slate-400">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}</td>
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex gap-1">
                    <button className="btn-secondary !px-2 !py-1.5" onClick={() => open(u)}><Edit2 size={14}/></button>
                    {u.id !== me?.id && <button className="btn-danger !px-2 !py-1.5" onClick={() => remove(u)}><Trash2 size={14}/></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-40 bg-black/60 grid place-items-center p-4" onClick={() => setShowModal(false)}>
          <div className="card p-5 w-full max-w-lg" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{editing ? `Edit ${editing.username}` : 'Add user'}</h3>
              <button onClick={() => setShowModal(false)}><X size={18}/></button>
            </div>
            <form onSubmit={save} className="space-y-3">
              {err && <div className="text-sm bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg p-2">{err}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Username</label>
                  <input className="input" required disabled={!!editing} value={form.username} onChange={e=>setForm({...form, username:e.target.value})}/></div>
                <div><label className="label">Role</label>
                  <select className="input" value={form.role} onChange={e=>setForm({...form, role:e.target.value})}>
                    <option value="USER">User</option><option value="ADMIN">Admin</option>
                  </select></div>
              </div>
              <div><label className="label">Email (optional)</label><input className="input" type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/></div>
              <div><label className="label">{editing ? 'New password (leave blank to keep)' : 'Password'}</label>
                <input className="input" type="password" required={!editing} minLength={editing ? 0 : 8} value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/></div>
              {form.role === 'USER' && (
                <div>
                  <label className="label">Visible clients</label>
                  <div className="bg-bg-soft border border-line rounded-lg p-2 max-h-48 overflow-auto space-y-1">
                    {clients.map(c => (
                      <label key={c.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-bg-card cursor-pointer">
                        <input type="checkbox" checked={form.clientIds.includes(c.id)} onChange={() => toggleClient(c.id)}/>
                        <span>{c.name}</span><span className="text-xs text-slate-500 ml-auto">{c.url}</span>
                      </label>
                    ))}
                    {clients.length === 0 && <div className="text-slate-500 text-sm p-2">No clients yet.</div>}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn-primary">{editing ? 'Save' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
