import { useState } from 'react';
import { KeyRound, CheckCircle2, XCircle, Trash2, ExternalLink } from 'lucide-react';
import api from '../services/api';
import { Button, Badge, Field, Textarea, useToast, useConfirm } from './ui';

/**
 * Home Assistant long-lived access token.
 *
 * Write-only by design: the stored token never leaves the server, so this can
 * only ever show a masked hint. Leaving the box empty on save keeps whatever is
 * stored — clearing it is a separate, explicit action, because silently
 * dropping a working token when someone edits a site's name would be the worst
 * kind of surprise.
 */
export default function HaTokenField({ value, onChange, client, onCleared }) {
  const toast = useToast();
  const confirm = useConfirm();
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
      setResult({ ok: false, error: err.response?.data?.error || 'The connection test failed.' });
    } finally {
      setTesting(false);
    }
  }

  async function clear() {
    if (!client?.id) return;
    const ok = await confirm({
      title: `Remove the access token for ${client.name}?`,
      tone: 'danger',
      message:
        'HA-Hub falls back to a basic reachability check for this site and stops reporting its version, entity counts and pending updates.',
      confirmLabel: 'Remove token',
    });
    if (!ok) return;
    try {
      await api.delete(`/clients/${client.id}/ha-token`);
      onChange('');
      setResult(null);
      setReplacing(false);
      onCleared?.();
      toast.success('Access token removed.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'The token could not be removed.');
    }
  }

  return (
    <Field
      label={
        <span className="inline-flex items-center gap-1.5">
          <KeyRound size={11} aria-hidden="true" />
          Home Assistant access token
        </span>
      }
      labelSuffix="— optional"
      hint={
        <>
          In Home Assistant open your profile, go to the Security tab and create a long-lived access
          token at the bottom of the page. HA-Hub stores it encrypted and uses it to read the version,
          entity counts and pending updates for this site.{' '}
          <a
            href="https://www.home-assistant.io/docs/authentication/#your-account-profile"
            target="_blank"
            rel="noreferrer"
            className="focus-ring inline-flex items-center gap-0.5 rounded text-brand hover:underline"
          >
            Where to find it
            <ExternalLink size={10} aria-hidden="true" />
          </a>
        </>
      }
    >
      {(a) => (
        <>
          {hasStored && !replacing && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-ink/70 px-3 py-2.5">
              <CheckCircle2 size={14} className="shrink-0 text-live" aria-hidden="true" />
              <span className="font-mono text-sm tnum text-fg-muted">{client.haTokenMask}</span>
              <TokenStatus status={client.haTokenStatus} />
              <div className="ml-auto flex items-center gap-1">
                <Button size="xs" variant="ghost" onClick={() => setReplacing(true)}>
                  Replace
                </Button>
                <Button size="xs" variant="ghost" icon={Trash2} className="text-down hover:text-down" onClick={clear}>
                  <span className="sr-only">Remove token</span>
                </Button>
              </div>
            </div>
          )}

          {showInput && (
            <>
              <Textarea
                {...a}
                rows={3}
                spellCheck={false}
                autoComplete="off"
                className="font-mono text-xs"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
                value={value}
                onChange={(e) => {
                  onChange(e.target.value);
                  setResult(null);
                }}
              />
              {hasStored && (
                <Button
                  size="xs"
                  variant="ghost"
                  className="mt-1 !px-0"
                  onClick={() => {
                    setReplacing(false);
                    onChange('');
                    setResult(null);
                  }}
                >
                  Keep the existing token
                </Button>
              )}
            </>
          )}

          {client?.id && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                icon={CheckCircle2}
                loading={testing}
                onClick={test}
                disabled={showInput && !value?.trim() && !hasStored}
              >
                {testing ? 'Checking…' : 'Test connection'}
              </Button>
              {result && <TestResult result={result} />}
            </div>
          )}
        </>
      )}
    </Field>
  );
}

function TokenStatus({ status }) {
  if (!status || status === 'OK') return null;
  const map = {
    UNAUTHORIZED: 'Rejected by Home Assistant',
    UNREACHABLE: 'Site unreachable',
    DECRYPT_FAILED: 'Unreadable — paste it again',
  };
  return <Badge tone={status === 'UNREACHABLE' ? 'warn' : 'down'} size="sm">{map[status] || status}</Badge>;
}

function TestResult({ result }) {
  if (result.ok) {
    return (
      <span className="flex flex-wrap items-center gap-1.5 text-xs text-live">
        <CheckCircle2 size={13} aria-hidden="true" />
        Connected to <b className="font-mono">{result.locationName || 'Home Assistant'}</b>
        <Badge tone="neutral" size="sm" mono>{result.version}</Badge>
        {result.latencyMs != null && <span className="tnum text-fg-faint">{result.latencyMs} ms</span>}
      </span>
    );
  }
  return (
    <span className="flex max-w-md items-start gap-1.5 text-xs text-down">
      <XCircle size={13} className="mt-px shrink-0" aria-hidden="true" />
      {result.error}
    </span>
  );
}
