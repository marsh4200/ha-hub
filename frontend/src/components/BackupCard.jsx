import { useEffect, useRef, useState } from 'react';
import { Upload, Download, Trash2, FileArchive, AlertTriangle, Loader2, X, Key, Eye, EyeOff, Save, FileText } from 'lucide-react';
import api from '../services/api';

function fmtSize(b) {
  if (b == null) return '—';
  const mb = b / 1024 / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
function fmtDate(d) { return d ? new Date(d).toLocaleString() : '—'; }

// Files above SINGLE_MAX are uploaded in CHUNK_SIZE slices so each request stays
// under the ~100 MB Cloudflare/proxy body cap. The server reassembles them.
const CHUNK_SIZE = 80 * 1024 * 1024;   // 80 MB
const SINGLE_MAX = 90 * 1024 * 1024;   // one-shot below this
function genUploadId() {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch (_) {}
  return 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
}

export default function BackupCard({ client, isAdmin, onChange }) {
  const [info, setInfo] = useState(null);     // { backup, maxSize }
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadMsg, setUploadMsg] = useState('');
  const [confirmReplace, setConfirmReplace] = useState(null); // pending File
  const [err, setErr] = useState('');
  const inputRef = useRef(null);

  // Emergency encryption key (text)
  const [keyDraft, setKeyDraft] = useState('');
  const [keyDirty, setKeyDirty] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [keyErr, setKeyErr] = useState('');
  const keyInputRef = useRef(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get(`/clients/${client.id}/backup`);
      setInfo(data);
      setKeyDraft(data.key?.content || '');
      setKeyDirty(false);
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
    setUploading(true); setUploadPct(0); setUploadMsg(''); setErr('');
    try {
      if (file.size <= SINGLE_MAX) {
        const form = new FormData();
        form.append('backup', file);
        await api.post(`/clients/${client.id}/backup`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => { if (e.total) setUploadPct(Math.round((e.loaded / e.total) * 100)); },
          timeout: 0,
        });
      } else {
        await uploadChunked(file);
      }
      await load();
      onChange?.();
    } catch (e) {
      setErr(e.response?.data?.error || e.message || 'Upload failed');
    } finally {
      setUploading(false); setUploadPct(0); setUploadMsg('');
    }
  }

  // Slice the file and send each part as its own request, then ask the server to
  // reassemble. Keeps every request under the proxy's body-size cap.
  async function uploadChunked(file) {
    const uploadId = genUploadId();
    const total = Math.ceil(file.size / CHUNK_SIZE);
    let sentBytes = 0;
    try {
      for (let index = 0; index < total; index++) {
        const start = index * CHUNK_SIZE;
        const blob = file.slice(start, Math.min(start + CHUNK_SIZE, file.size));
        const form = new FormData();
        form.append('uploadId', uploadId);
        form.append('index', String(index));
        form.append('total', String(total));
        form.append('chunk', blob, `${file.name}.part${index}`);
        const base = sentBytes;
        setUploadMsg(`part ${index + 1}/${total}`);
        await api.post(`/clients/${client.id}/backup/chunk`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            const loaded = base + (e.loaded || 0);
            setUploadPct(Math.min(99, Math.round((loaded / file.size) * 100)));
          },
          timeout: 0,
        });
        sentBytes += blob.size;
        setUploadPct(Math.min(99, Math.round((sentBytes / file.size) * 100)));
      }
      setUploadMsg('finalizing…');
      await api.post(`/clients/${client.id}/backup/chunk/complete`, { uploadId, filename: file.name, total });
      setUploadPct(100);
    } catch (e) {
      // best-effort: tell the server to discard the staged parts
      try { await api.post(`/clients/${client.id}/backup/chunk/abort`, { uploadId }); } catch (_) {}
      throw e;
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

  // ---- Emergency encryption key ----
  function pickKeyFile() { keyInputRef.current?.click(); }

  function onKeyFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setKeyErr('');
    const reader = new FileReader();
    reader.onload = () => {
      setKeyDraft(String(reader.result || ''));
      setKeyDirty(true);
      setShowKey(true);
    };
    reader.onerror = () => setKeyErr('Could not read that file');
    reader.readAsText(file);
  }

  async function saveKey() {
    const content = keyDraft.trim();
    if (!content) { setKeyErr('Encryption key text cannot be empty'); return; }
    setSavingKey(true); setKeyErr('');
    try {
      await api.put(`/clients/${client.id}/backup/key`, { content });
      await load();
      onChange?.();
    } catch (e) {
      setKeyErr(e.response?.data?.error || 'Failed to save encryption key');
    } finally {
      setSavingKey(false);
    }
  }

  async function deleteKey() {
    if (!confirm(`Delete the emergency encryption key for "${client.name}"?`)) return;
    setKeyErr('');
    try {
      await api.delete(`/clients/${client.id}/backup/key`);
      await load();
      onChange?.();
    } catch (e) {
      setKeyErr(e.response?.data?.error || 'Failed to delete encryption key');
    }
  }

  function downloadKey() {
    const content = info?.key?.content || keyDraft || '';
    if (!content) return;
    const safe = (client.slug || client.name || 'client').replace(/[^a-z0-9-_]+/gi, '-');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `emergency-encryption-key-${safe}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
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
            <Loader2 size={12} className="animate-spin text-brand"/> Uploading… {uploadPct}%{uploadMsg && ` (${uploadMsg})`}
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
        Max size {fmtSize(info?.maxSize || 800 * 1024 * 1024)} • .tar or .tar.gz only • One backup per client • Large files upload in parts automatically
      </p>

      {/* Emergency encryption key */}
      <div className="pt-3 mt-1 border-t border-line space-y-2">
        <div className="flex items-center gap-2">
          <Key size={16} className="text-brand"/>
          <h3 className="font-medium">Emergency encryption key</h3>
          {info?.key && <span className="ml-auto text-xs text-slate-500">stored</span>}
        </div>

        {keyErr && (
          <div className="text-sm bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg p-2 flex items-center gap-2">
            <AlertTriangle size={14}/>{keyErr}
          </div>
        )}

        <div className="relative">
          <textarea
            value={showKey ? keyDraft : (keyDraft ? '•'.repeat(Math.min(keyDraft.length, 64)) : '')}
            onChange={(e) => { if (showKey && isAdmin) { setKeyDraft(e.target.value); setKeyDirty(true); } }}
            readOnly={!isAdmin || !showKey}
            rows={3}
            placeholder={isAdmin ? 'Paste the emergency encryption key, or upload a .txt below' : 'No encryption key stored'}
            className="w-full text-sm font-mono bg-bg-soft border border-line rounded-lg p-2 pr-9 resize-y focus:outline-none focus:border-brand"
          />
          {keyDraft && (
            <button
              type="button"
              onClick={() => setShowKey(s => !s)}
              title={showKey ? 'Hide' : 'Reveal'}
              className="absolute top-2 right-2 text-slate-400 hover:text-slate-200"
            >
              {showKey ? <EyeOff size={16}/> : <Eye size={16}/>}
            </button>
          )}
        </div>

        {info?.key && (
          <div className="text-xs text-slate-400">
            Updated {fmtDate(info.key.updatedAt)}
            {info.key.updatedBy && <> by <span className="text-slate-300">{info.key.updatedBy}</span></>}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {keyDraft && (
            <button className="btn-secondary" onClick={downloadKey}>
              <FileText size={14}/>Download .txt
            </button>
          )}
          {isAdmin && (
            <>
              <button className="btn-primary" onClick={saveKey} disabled={savingKey || !keyDirty || !keyDraft.trim()}>
                {savingKey ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
                {info?.key ? 'Save changes' : 'Save key'}
              </button>
              <button className="btn-secondary" onClick={pickKeyFile} disabled={savingKey}>
                <Upload size={14}/>Upload .txt
              </button>
              {info?.key && (
                <button className="btn-danger" onClick={deleteKey} disabled={savingKey}>
                  <Trash2 size={14}/>Delete
                </button>
              )}
              <input
                ref={keyInputRef}
                type="file"
                accept=".txt,text/plain"
                className="hidden"
                onChange={onKeyFileChosen}
              />
            </>
          )}
        </div>

        <p className="text-xs text-slate-500">
          Plain-text key needed to restore an encrypted backup. Stored alongside the backup — keep an offline copy too.
        </p>
      </div>

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
