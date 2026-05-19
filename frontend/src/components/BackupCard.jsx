import { useEffect, useRef, useState } from 'react';
import { Upload, Download, Trash2, FileArchive, AlertTriangle, Loader2, X } from 'lucide-react';
import api from '../services/api';

function fmtSize(b) {
  if (b == null) return '—';
  const mb = b / 1024 / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
function fmtDate(d) { return d ? new Date(d).toLocaleString() : '—'; }

export default function BackupCard({ client, isAdmin, onChange }) {
  const [info, setInfo] = useState(null);     // { backup, maxSize }
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [confirmReplace, setConfirmReplace] = useState(null); // pending File
  const [err, setErr] = useState('');
  const inputRef = useRef(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get(`/clients/${client.id}/backup`);
      setInfo(data);
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to load backup info');
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [client.id]);

  function pickFile() { inputRef.current?.click(); }

  function onFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = '';     // reset so picking the same file re-fires onChange
    if (!file) return;

    // Client-side checks
    if (info?.maxSize && file.size > info.maxSize) {
      setErr(`File too large (${fmtSize(file.size)}). Max is ${fmtSize(info.maxSize)}.`);
      return;
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith('.tar') && !name.endsWith('.tar.gz') && !name.endsWith('.tgz')) {
      setErr('File must be .tar, .tar.gz, or .tgz');
      return;
    }
    setErr('');

    // If a backup already exists → confirm overwrite
    if (info?.backup) {
      setConfirmReplace(file);
    } else {
      doUpload(file);
    }
  }

  async function doUpload(file) {
    setConfirmReplace(null);
    setUploading(true); setUploadPct(0); setErr('');

    const form = new FormData();
    form.append('backup', file);

    try {
      await api.post(`/clients/${client.id}/backup`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setUploadPct(Math.round((e.loaded / e.total) * 100));
        },
        timeout: 0,
      });
      await load();
      onChange?.();
    } catch (e) {
      setErr(e.response?.data?.error || e.message || 'Upload failed');
    } finally {
      setUploading(false); setUploadPct(0);
    }
  }

  function doDownload() {
    // Use a hidden anchor so the browser handles streaming + filename
    const a = document.createElement('a');
    const token = localStorage.getItem('ha-hub-token');
    // Have to fetch with auth header → blob → URL since GET can't carry headers in <a>
    setErr('');
    (async () => {
      try {
        const res = await api.get(`/clients/${client.id}/backup/download`, { responseType: 'blob', timeout: 0 });
        const url = URL.createObjectURL(res.data);
        a.href = url;
        a.download = info.backup.filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
      } catch (e) {
        setErr(e.response?.data?.error || 'Download failed');
      }
    })();
  }

  async function doDelete() {
    if (!confirm(`Delete the backup for "${client.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/clients/${client.id}/backup`);
      await load();
      onChange?.();
    } catch (e) {
      setErr(e.response?.data?.error || 'Delete failed');
    }
  }

  if (loading) return <div className="card p-5 text-slate-500 text-sm">Loading backup…</div>;

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <FileArchive size={16} className="text-brand"/>
        <h3 className="font-medium">Backup</h3>
        {info?.backup && <span className="ml-auto text-xs text-slate-500">1 of 1 stored</span>}
      </div>

      {err && (
        <div className="text-sm bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg p-2 flex items-center gap-2">
          <AlertTriangle size={14}/>{err}
        </div>
      )}

      {info?.backup ? (
        <div className="bg-bg-soft border border-line rounded-lg p-3 space-y-1.5 text-sm">
          <div className="font-medium truncate" title={info.backup.filename}>{info.backup.filename}</div>
          <div className="text-xs text-slate-400">
            {fmtSize(info.backup.size)} • uploaded {fmtDate(info.backup.uploadedAt)}
            {info.backup.uploadedBy && <> by <span className="text-slate-300">{info.backup.uploadedBy}</span></>}
          </div>
        </div>
      ) : (
        <div className="text-sm text-slate-500 py-2">No backup uploaded yet.</div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Loader2 size={12} className="animate-spin text-brand"/> Uploading… {uploadPct}%
          </div>
          <div className="w-full h-2 bg-bg-soft rounded-full overflow-hidden">
            <div className="h-full bg-brand transition-all duration-200" style={{ width: `${uploadPct}%` }}/>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        {info?.backup && (
          <button className="btn-secondary" onClick={doDownload} disabled={uploading}>
            <Download size={14}/>Download
          </button>
        )}
        {isAdmin && (
          <>
            <button className="btn-primary" onClick={pickFile} disabled={uploading}>
              <Upload size={14}/>{info?.backup ? 'Replace…' : 'Upload backup'}
            </button>
            {info?.backup && (
              <button className="btn-danger" onClick={doDelete} disabled={uploading}>
                <Trash2 size={14}/>Delete
              </button>
            )}
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".tar,.tar.gz,.tgz,application/x-tar,application/gzip"
          className="hidden"
          onChange={onFileChosen}
        />
      </div>

      <p className="text-xs text-slate-500">
        Max size {fmtSize(info?.maxSize || 800 * 1024 * 1024)} • .tar or .tar.gz only • One backup stored per client
      </p>

      {/* Replace confirmation modal */}
      {confirmReplace && (
        <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-4" onClick={() => setConfirmReplace(null)}>
          <div className="card p-5 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle size={18}/>
                <h3 className="font-semibold">Replace existing backup?</h3>
              </div>
              <button onClick={() => setConfirmReplace(null)}><X size={18}/></button>
            </div>
            <p className="text-sm text-slate-300 mb-2">
              <b>{client.name}</b> already has a backup stored. Uploading a new one will permanently overwrite the old one.
            </p>
            <p className="text-sm text-slate-400 mb-4">
              Download the existing backup first if you want to keep it.
            </p>
            <div className="bg-bg-soft border border-line rounded-lg p-2 text-xs text-slate-400 mb-4">
              Old: <span className="text-slate-200">{info.backup.filename}</span> ({fmtSize(info.backup.size)})<br/>
              New: <span className="text-slate-200">{confirmReplace.name}</span> ({fmtSize(confirmReplace.size)})
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <button className="btn-secondary" onClick={() => setConfirmReplace(null)}>Cancel</button>
              <button className="btn-secondary" onClick={() => { doDownload(); }}>
                <Download size={14}/>Download existing first
              </button>
              <button className="btn-danger" onClick={() => doUpload(confirmReplace)}>
                Replace anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
