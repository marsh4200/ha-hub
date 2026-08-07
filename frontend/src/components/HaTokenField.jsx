import { useState } from 'react';
import { KeyRound, CheckCircle2, XCircle, Trash2, Loader2, ExternalLink } from 'lucide-react';
import api from '../services/api';

/**
 * Home Assistant long-lived access token.
 *
 * Write-only by design: the stored token is never sent to the browser, so this
 * shows only a masked hint. Leaving the box empty on save keeps the existing
 * token — clearing it is a separate, explicit action.
 */
export default function HaTokenField({ value, onChange, client, onCleared }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);
  const [replacing, setReplacing] = useState(false);

  const hasStored = !!client?.hasHaToken;
  const showInput = !hasStored || replacing;

  async function test() {
    if (!client?.id) return;
    setTesting(true);
    setResult(null);
    try {
      const { data } = await api.post(`/clients/${client.id}/ha-token/test`, {
        haToken: value?.trim() || undefined,
      });
      setResult(data);
    } catch (err) {
      setResult({ ok: false, error: err.response?.data?.error || 'Test failed.' });
    } finally {
      setTesting(false);
    }
  }

  async function clear() {
    if (!client?.id) return;
    if (!confirm(`Remove the access token for "${client.name}"?\n\nHA-Hub will fall back to a basic reachability check and stop reporting version, entity and update data for this site.`)) return;
    try {
      await api.delete(`/clients/${client.id}/ha-token`);
      onChange('');
      setResult(null);
      setReplacing(false);
      onCleared?.();
    } catch (err) {
      alert(err.response?.data?.error || 'Could not remove the token.');
    }
  }

  return (
    <div>
      <label className="label flex items-center gap-1.5">
        <KeyRound size={11} /> Home Assistant access token
        <span className="text-slate-600 font-normal normal-case tracking-normal">— optional</span>
      </label>

      {hasStored && !replacing && (
        <div className="flex items-center gap-2 flex-wrap bg-bg/70 border border-line rounded-lg px-3 py-2.5">
          <CheckCircle2 size={14} className="text-live shrink-0" />
          <span className="font-mono text-sm text-slate-300 tnum">{client.haTokenMask}</span>
          <TokenStatus status={client.haTokenStatus} />
          <div className="ml-auto flex gap-1">
            <button type="button" className="btn-ghost !px-2 !py-1 !text-xs" onClick={() => setReplacing(true)}>
              Replace
            </button>
            <button type="button" className="btn-ghost !px-2 !py-1 !text-xs text-down hover:text-down" onClick={clear}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      )}

      {showInput && (
        <>
          <textarea
            className="input font-mono text-xs leading-relaxed"
            rows={3}
            spellCheck={false}
            autoComplete="off"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
            value={value}
            onChange={e => { onChange(e.target.value); setResult(null); }}
          />
          {hasStored && (
            <button
              type="button"
              className="btn-ghost !px-0 !py-1 !text-xs mt-1"
              onClick={() => { setReplacing(false); onChange(''); setResult(null); }}
            >
              Keep the existing token
            </button>
          )}
        </>
      )}

      <p className="hint">
        In Home Assistant, open your profile, go to the Security tab, and create a long-lived access
        token at the bottom of the page. HA-Hub stores it encrypted and uses it to read the version,
        entity counts and pending updates for this site.
        {' '}
        <a
          href="https://www.home-assistant.io/docs/authentication/#your-account-profile"
          target="_blank"
          rel="noreferrer"
          className="text-brand hover:underline inline-flex items-center gap-0.5"
        >
          Where to find it <ExternalLink size={10} />
        </a>
      </p>

      {client?.id && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn-secondary !py-1.5 !text-xs"
            onClick={test}
            disabled={testing || (showInput && !value?.trim() && !hasStored)}
          >
            {testing ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            {testing ? 'Checking…' : 'Test connection'}
          </button>
          {result && <TestResult result={result} />}
        </div>
      )}
    </div>
  );
}

function TokenStatus({ status }) {
  if (!status || status === 'OK') return null;
  const map = {
    UNAUTHORIZED:   'Rejected by Home Assistant',
    UNREACHABLE:    'Site unreachable',
    DECRYPT_FAILED: 'Unreadable — paste it again',
  };
  return <span className="chip-down">{map[status] || status}</span>;
}

function TestResult({ result }) {
  if (result.ok) {
    return (
      <span className="text-xs text-live flex items-center gap-1.5 flex-wrap">
        <CheckCircle2 size={13} />
        Connected to <b className="font-mono">{result.locationName || 'Home Assistant'}</b>
        <span className="chip-neutral font-mono">{result.version}</span>
        {result.latencyMs != null && <span className="text-slate-500 tnum">{result.latencyMs} ms</span>}
      </span>
    );
  }
  return (
    <span className="text-xs text-down flex items-start gap-1.5 max-w-md">
      <XCircle size={13} className="shrink-0 mt-0.5" />
      {result.error}
    </span>
  );
}
