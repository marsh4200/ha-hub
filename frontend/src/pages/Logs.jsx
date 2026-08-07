import { useEffect, useState } from 'react';
import api from '../services/api';

const LEVEL_CHIP = { INFO: 'chip-neutral', WARN: 'chip-warn', ERROR: 'chip-down', AUDIT: 'chip-brand' };

export default function Logs() {
  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 50 });
  const [category, setCategory] = useState(''); const [level, setLevel] = useState('');

  async function load(page = 1) {
    const params = new URLSearchParams({ page, pageSize: 50 });
    if (category) params.set('category', category);
    if (level) params.set('level', level);
    const { data } = await api.get(`/logs?${params}`);
    setData(data);
  }
  useEffect(() => { load(1); /* eslint-disable-next-line */ }, [category, level]);

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow mb-1">Administration</div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="input max-w-xs" value={category} onChange={e=>setCategory(e.target.value)}>
          <option value="">All categories</option><option value="auth">Auth</option>
          <option value="client">Client</option><option value="user">User</option><option value="system">System</option>
        </select>
        <select className="input max-w-xs" value={level} onChange={e=>setLevel(e.target.value)}>
          <option value="">All levels</option><option>INFO</option><option>WARN</option><option>ERROR</option><option>AUDIT</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="text-left text-2xs uppercase tracking-wider text-slate-500 bg-bg-soft">
            <tr><th className="px-4 py-2.5 font-medium">Time</th><th className="font-medium">Level</th>
              <th className="font-medium">Category</th><th className="font-medium">Message</th><th className="font-medium">User</th></tr>
          </thead>
          <tbody>
            {data.items.map(l => (
              <tr key={l.id} className="border-t border-line">
                <td className="px-4 py-2 text-slate-500 whitespace-nowrap font-mono text-2xs tnum">{new Date(l.createdAt).toLocaleString()}</td>
                <td><span className={LEVEL_CHIP[l.level] || 'chip-neutral'}>{l.level}</span></td>
                <td className="text-slate-400">{l.category}</td>
                <td>{l.message}</td>
                <td className="text-slate-400">{l.user?.username || '—'}</td>
              </tr>
            ))}
            {data.items.length === 0 && <tr><td colSpan="5" className="text-center text-slate-500 py-10">Nothing recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-400">
        <div>{data.total} entries</div>
        <div className="flex gap-2">
          <button className="btn-secondary" disabled={data.page <= 1} onClick={() => load(data.page - 1)}>Prev</button>
          <span className="px-2 py-1">Page {data.page} / {pages}</span>
          <button className="btn-secondary" disabled={data.page >= pages} onClick={() => load(data.page + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}
