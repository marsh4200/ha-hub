import { useEffect, useRef, useState } from 'react';
import {
  Upload, Download, Trash2, FileArchive, AlertTriangle, Key, Eye, EyeOff,
  Save, FileText, CheckCircle2,
} from 'lucide-react';
import api from '../services/api';
import {
  Button, Card, CardHeader, CardBody, Badge, Modal, Alert, ProgressBar,
  useToast, useConfirm,
} from './ui';
import { bytes, absTime } from '../lib/format';

/**
 * Backup and emergency encryption key for one site.
 *
 * The transfer logic is unchanged from the previous version and deliberately
 * so — files above SINGLE_MAX are sliced into CHUNK_SIZE parts so every request
 * stays under the ~100 MB proxy body cap, and the server reassembles them. That
 * behaviour is load-bearing on real Cloudflare tunnels; only the presentation
 * around it has been rebuilt.
 */
const CHUNK_SIZE = 80 * 1024 * 1024; // 80 MB
const SINGLE_MAX = 90 * 1024 * 1024; // one-shot below this

function genUploadId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch (_) { /* fall through */ }
  return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export default function BackupCard({ client, isAdmin, onChange }) {
  const toast = useToast();
  const confirm = useConfirm();

  const [info, setInfo] = useState(null); // { backup, maxSize, key }
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadMsg, setUploadMsg] = useState('');
  const [confirmReplace, setConfirmReplace] = useState(null); // pending File
  const [err, setErr] = useState('');
  const inputRef = useRef(null);

  // Emergency encryption key (plain text)
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
      setErr(e.response?.data?.error || 'Backup details could not be loaded.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [client.id]);

  function onFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so re-picking the same file still fires onChange
    if (!file) return;

    if (info?.maxSize && file.size > info.maxSize) {
      setErr(`That file is ${bytes(file.size)}. The maximum is ${bytes(info.maxSize)}.`);
      return;
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith('.tar') && !name.endsWith('.tar.gz') && !name.endsWith('.tgz')) {
      setErr('Backups must be a .tar, .tar.gz or .tgz archive.');
      return;
    }
    setErr('');

    if (info?.backup) setConfirmReplace(file);
    else doUpload(file);
  }

  async function doUpload(file) {
    setConfirmReplace(null);
    setUploading(true);
    setUploadPct(0);
    setUploadMsg('');
    setErr('');
    try {
      if (file.size <= SINGLE_MAX) {
        const form = new FormData();
        form.append('backup', file);
        await api.post(`/clients/${client.id}/backup`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            if (e.total) setUploadPct(Math.round((e.loaded / e.total) * 100));
          },
          timeout: 0,
        });
      } else {
        await uploadChunked(file);
      }
      await load();
      onChange?.();
      toast.success(`Backup uploaded for ${client.name}.`);
    } catch (e) {
      setErr(e.response?.data?.error || e.message || 'The upload failed.');
    } finally {
      setUploading(false);
      setUploadPct(0);
      setUploadMsg('');
    }
  }

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
        setUploadMsg(`part ${index + 1} of ${total}`);
        // eslint-disable-next-line no-await-in-loop
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
      setUploadMsg('finalising…');
      await api.post(`/clients/${client.id}/backup/chunk/complete`, { uploadId, filename: file.name, total });
      setUploadPct(100);
    } catch (e) {
      // Best effort: tell the server to discard the staged parts.
      try { await api.post(`/clients/${client.id}/backup/chunk/abort`, { uploadId }); } catch (_) { /* ignore */ }
      throw e;
    }
  }

  async function doDownload() {
    setErr('');
    try {
      const res = await api.get(`/clients/${client.id}/backup/download`, { responseType: 'blob', timeout: 0 });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = info.backup.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      setErr(e.response?.data?.error || 'The download failed.');
    }
  }

  async function doDelete() {
    const ok = await confirm({
      title: 'Delete this backup?',
      tone: 'danger',
      message: `The stored archive for ${client.name} is removed from the server. This cannot be undone.`,
      details: `${info.backup.filename} · ${bytes(info.backup.size)}`,
      confirmLabel: 'Delete backup',
    });
    if (!ok) return;
    try {
      await api.delete(`/clients/${client.id}/backup`);
      await load();
      onChange?.();
      toast.success('Backup deleted.');
    } catch (e) {
      setErr(e.response?.data?.error || 'The backup could not be deleted.');
    }
  }

  /* ── Emergency encryption key ─────────────────────────────────────── */

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
    reader.onerror = () => setKeyErr('That file could not be read.');
    reader.readAsText(file);
  }

  async function saveKey() {
    const content = keyDraft.trim();
    if (!content) {
      setKeyErr('The encryption key cannot be empty.');
      return;
    }
    setSavingKey(true);
    setKeyErr('');
    try {
      await api.put(`/clients/${client.id}/backup/key`, { content });
      await load();
      onChange?.();
      toast.success('Encryption key saved.');
    } catch (e) {
      setKeyErr(e.response?.data?.error || 'The encryption key could not be saved.');
    } finally {
      setSavingKey(false);
    }
  }

  async function deleteKey() {
    const ok = await confirm({
      title: 'Delete the emergency encryption key?',
      tone: 'danger',
      message: `Without this key the stored backup for ${client.name} cannot be restored if it is encrypted. Keep an offline copy before deleting.`,
      confirmLabel: 'Delete key',
    });
    if (!ok) return;
    setKeyErr('');
    try {
      await api.delete(`/clients/${client.id}/backup/key`);
      await load();
      onChange?.();
      toast.success('Encryption key deleted.');
    } catch (e) {
      setKeyErr(e.response?.data?.error || 'The encryption key could not be deleted.');
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

  if (loading) {
    return (
      <Card>
        <CardBody className="space-y-2">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-12 w-full" />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        icon={FileArchive}
        title="Backup"
        description="One archive per site, kept on the hub so a rebuild never starts from nothing."
        actions={info?.backup ? <Badge tone="live" icon={CheckCircle2}>Stored</Badge> : <Badge tone="neutral">None</Badge>}
      />

      <CardBody className="space-y-3">
        {err && <Alert tone="error">{err}</Alert>}

        {info?.backup ? (
          <div className="rounded-lg border border-line bg-ink/50 p-3">
            <p className="truncate font-mono text-sm text-fg" title={info.backup.filename}>
              {info.backup.filename}
            </p>
            <p className="mt-1 text-2xs text-fg-faint">
              {bytes(info.backup.size)} · uploaded {absTime(info.backup.uploadedAt)}
              {info.backup.uploadedBy && <> by <span className="text-fg-muted">{info.backup.uploadedBy}</span></>}
            </p>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-line bg-ink/40 px-3 py-4 text-center text-sm text-fg-faint">
            No backup uploaded yet.
          </p>
        )}

        {uploading && (
          <ProgressBar
            value={uploadPct}
            showValue
            label={`Uploading${uploadMsg ? ` — ${uploadMsg}` : '…'}`}
          />
        )}

        <div className="flex flex-wrap gap-2">
          {info?.backup && (
            <Button icon={Download} onClick={doDownload} disabled={uploading}>
              Download
            </Button>
          )}
          {isAdmin && (
            <>
              <Button
                variant={info?.backup ? 'secondary' : 'primary'}
                icon={Upload}
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                {info?.backup ? 'Replace…' : 'Upload backup'}
              </Button>
              {info?.backup && (
                <Button variant="danger" icon={Trash2} onClick={doDelete} disabled={uploading}>
                  Delete
                </Button>
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

        <p className="text-2xs leading-relaxed text-fg-faint">
          Up to {bytes(info?.maxSize || 800 * 1024 * 1024)} · .tar or .tar.gz only · one backup per site.
          Large files are uploaded in parts automatically.
        </p>

        {/* ── Emergency encryption key ─────────────────────────────── */}
        <section className="space-y-2.5 border-t border-line pt-4">
          <div className="flex items-center gap-2">
            <Key size={14} className="text-brand" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-fg">Emergency encryption key</h3>
            {info?.key && <Badge tone="live" size="sm" className="ml-auto">Stored</Badge>}
          </div>

          {keyErr && <Alert tone="error">{keyErr}</Alert>}

          <div className="relative">
            <textarea
              aria-label="Emergency encryption key"
              value={showKey ? keyDraft : keyDraft ? '•'.repeat(Math.min(keyDraft.length, 64)) : ''}
              onChange={(e) => {
                if (showKey && isAdmin) {
                  setKeyDraft(e.target.value);
                  setKeyDirty(true);
                }
              }}
              readOnly={!isAdmin || !showKey}
              rows={3}
              spellCheck={false}
              placeholder={isAdmin ? 'Paste the emergency encryption key, or upload a .txt below' : 'No encryption key stored'}
              className="w-full resize-y rounded-lg border border-line bg-ink/70 p-2.5 pr-10 font-mono text-xs leading-relaxed text-fg placeholder:text-fg-ghost focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            {keyDraft && (
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                aria-label={showKey ? 'Hide encryption key' : 'Reveal encryption key'}
                className="focus-ring absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md text-fg-faint transition-colors hover:bg-raised hover:text-fg"
              >
                {showKey ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
              </button>
            )}
          </div>

          {info?.key && (
            <p className="text-2xs text-fg-faint">
              Updated {absTime(info.key.updatedAt)}
              {info.key.updatedBy && <> by <span className="text-fg-muted">{info.key.updatedBy}</span></>}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {keyDraft && (
              <Button size="sm" icon={FileText} onClick={downloadKey}>
                Download .txt
              </Button>
            )}
            {isAdmin && (
              <>
                <Button
                  size="sm"
                  variant="primary"
                  icon={Save}
                  loading={savingKey}
                  disabled={!keyDirty || !keyDraft.trim()}
                  onClick={saveKey}
                >
                  {info?.key ? 'Save changes' : 'Save key'}
                </Button>
                <Button size="sm" icon={Upload} disabled={savingKey} onClick={() => keyInputRef.current?.click()}>
                  Upload .txt
                </Button>
                {info?.key && (
                  <Button size="sm" variant="danger" icon={Trash2} disabled={savingKey} onClick={deleteKey}>
                    Delete
                  </Button>
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

          <p className="text-2xs leading-relaxed text-fg-faint">
            The plain-text key needed to restore an encrypted backup. It is stored alongside the
            archive, so keep an offline copy as well.
          </p>
        </section>
      </CardBody>

      {/* ── Replace confirmation ─────────────────────────────────────── */}
      {confirmReplace && (
        <Modal
          open
          size="md"
          tone="danger"
          icon={AlertTriangle}
          title="Replace the existing backup?"
          description={`${client.name} already has an archive stored.`}
          onClose={() => setConfirmReplace(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmReplace(null)}>Cancel</Button>
              <Button variant="secondary" icon={Download} onClick={doDownload}>Download existing first</Button>
              <Button variant="danger" onClick={() => doUpload(confirmReplace)}>Replace</Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-fg-muted">
              Uploading a new archive permanently overwrites the old one. Only one backup is kept per
              site.
            </p>
            <dl className="overflow-hidden rounded-lg border border-line bg-ink/50 text-xs">
              <div className="flex items-baseline justify-between gap-3 border-b border-line px-3 py-2">
                <dt className="text-fg-faint">Current</dt>
                <dd className="min-w-0 truncate text-right font-mono text-fg-muted">
                  {info.backup.filename} · {bytes(info.backup.size)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 px-3 py-2">
                <dt className="text-fg-faint">New</dt>
                <dd className="min-w-0 truncate text-right font-mono text-fg">
                  {confirmReplace.name} · {bytes(confirmReplace.size)}
                </dd>
              </div>
            </dl>
          </div>
        </Modal>
      )}
    </Card>
  );
}
