import { useEffect, useRef, useState } from 'react';
import {
  Download, KeyRound, RefreshCw, GitBranch, CheckCircle2, AlertCircle,
  Sparkles, ArrowRight, Info, ExternalLink, User as UserIcon, Package,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext.jsx';
import { useUpdate } from '../context/UpdateContext.jsx';
import {
  Button, Card, CardHeader, CardBody, CardFooter, Badge, Field, FieldRow,
  PasswordInput, PageHeader, Alert, ProgressBar, useToast, useConfirm,
} from '../components/ui';
import cn from '../lib/cn';

const VERSION_BEFORE_KEY = 'ha-hub-version-before-update';

// Used if the status call hasn't returned yet, or if UPDATE_REPO is unset in
// .env. Matches the backend's own default.
const FALLBACK_REPO = 'https://github.com/marsh4200/ha-hub';

// The Repository row links to GitHub but reads as the product name — the raw
// URL is on the link's title attribute for anyone who wants it.
const REPO_LABEL = 'AR Smart Home Server';

/**
 * Settings.
 *
 * Grouped by what the setting belongs to rather than by which API serves it:
 * your account, then the software, then data you can take away with you. The
 * update panel is the only one that can change the running system, so it is
 * the only one that states a version, a target and a progress bar — everything
 * else stays quiet.
 */
export default function Settings() {
  const { user } = useAuth();
  const { state: updateState, updating, refresh: refreshUpdate, setUpdating } = useUpdate();
  const toast = useToast();
  const confirm = useConfirm();
  const isAdmin = user?.role === 'ADMIN';

  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwErr, setPwErr] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSavedAt, setPwSavedAt] = useState(null);

  const [info, setInfo] = useState(null);
  const [checking, setChecking] = useState(false);
  const [requestErr, setRequestErr] = useState('');
  const [upToDateMsg, setUpToDateMsg] = useState('');
  const [justUpdated, setJustUpdated] = useState(null);
  const [exporting, setExporting] = useState(false);
  const fadeTimer = useRef(null);

  async function loadInfo() {
    try {
      const { data } = await api.get('/system/update/status');
      setInfo((prev) => ({ ...(prev || {}), local: data.local, repo: data.repo, remote: prev?.remote || null }));
      return data.local?.version || null;
    } catch (_) {
      return null;
    }
  }

  useEffect(() => { if (isAdmin) loadInfo(); /* eslint-disable-next-line */ }, [isAdmin]);

  // On mount: did we just come back from an update reload?
  useEffect(() => {
    const beforeRaw = localStorage.getItem(VERSION_BEFORE_KEY);
    if (!beforeRaw) return undefined;

    let before;
    try { before = JSON.parse(beforeRaw); } catch { localStorage.removeItem(VERSION_BEFORE_KEY); return undefined; }

    // Stale stash (>10 min) means an aborted update — drop it.
    if (Date.now() - before.at > 10 * 60 * 1000) {
      localStorage.removeItem(VERSION_BEFORE_KEY);
      return undefined;
    }

    (async () => {
      const currentVersion = await loadInfo();
      if (currentVersion && currentVersion !== before.version) {
        setJustUpdated({ from: before.version, to: currentVersion });
        fadeTimer.current = setTimeout(() => setJustUpdated(null), 8000);
      }
      localStorage.removeItem(VERSION_BEFORE_KEY);
    })();

    return () => fadeTimer.current && clearTimeout(fadeTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkUpdates() {
    setChecking(true);
    setRequestErr('');
    setUpToDateMsg('');
    try {
      const { data } = await api.get('/system/update/check');
      if (data.error) {
        setRequestErr(data.error);
      } else {
        setInfo((prev) => ({
          ...(prev || {}),
          local: { version: data.localVersion },
          remote: { version: data.remoteVersion, sha: data.commit?.sha, message: data.commit?.message },
          repo: data.repo,
          upToDate: data.upToDate,
        }));
        if (data.upToDate) {
          setUpToDateMsg(`Already up to date — version ${data.localVersion}`);
          setTimeout(() => setUpToDateMsg(''), 6000);
        }
      }
    } catch (e) {
      setRequestErr(e.response?.data?.error || 'The update check failed.');
    } finally {
      setChecking(false);
    }
  }

  async function runUpdate() {
    const ok = await confirm({
      title: 'Update AR Smart Home Server now?',
      message:
        'The latest code is pulled from GitHub and the containers rebuild. This takes roughly one to two minutes, during which the hub is briefly unavailable. You stay signed in and the page reloads itself when it is done.',
      details: info?.remote?.version
        ? `${info.local?.version || 'current'} → ${info.remote.version}`
        : 'Monitoring continues; sites are not affected.',
      confirmLabel: 'Update now',
    });
    if (!ok) return;

    setRequestErr('');
    setUpToDateMsg('');

    // Stash the current version BEFORE starting — it survives the reload.
    if (info?.local?.version) {
      localStorage.setItem(VERSION_BEFORE_KEY, JSON.stringify({ version: info.local.version, at: Date.now() }));
    }

    setUpdating(true);
    try {
      const { data } = await api.post('/system/update');
      if (data?.upToDate) {
        setUpToDateMsg(data.message || 'Already up to date');
        setUpdating(false);
        localStorage.removeItem(VERSION_BEFORE_KEY);
        setTimeout(() => setUpToDateMsg(''), 6000);
        return;
      }
      await refreshUpdate();
    } catch (e) {
      setRequestErr(e.response?.data?.error || 'The update request failed.');
      setUpdating(false);
      localStorage.removeItem(VERSION_BEFORE_KEY);
    }
  }

  async function changePw(e) {
    e.preventDefault();
    setPwErr('');
    if (pw.newPassword.length < 8) return setPwErr('The new password must be at least 8 characters.');
    if (pw.newPassword !== pw.confirm) return setPwErr('The two new passwords do not match.');
    if (pw.newPassword === pw.currentPassword) return setPwErr('The new password must be different from the current one.');

    setPwSaving(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: pw.currentPassword,
        newPassword: pw.newPassword,
      });
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      setPwSavedAt(Date.now());
      toast.success('Password changed.');
      setTimeout(() => setPwSavedAt(null), 6000);
    } catch (e2) {
      setPwErr(e2.response?.data?.error || 'The password could not be changed.');
    } finally {
      setPwSaving(false);
    }
  }

  async function exportData() {
    setExporting(true);
    try {
      const res = await api.get('/system/export', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ha-hub-export-${Date.now()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast.success('Export downloaded.');
    } catch (e) {
      toast.error(e.response?.data?.error || 'The export could not be created.');
    } finally {
      setExporting(false);
    }
  }

  const s = updateState || {};
  const isRunning = s.status === 'running' || s.status === 'requested';
  const progress = s.progress ?? 0;
  const updateReady = info?.remote?.version && info.upToDate === false;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        kicker="System"
        title="Settings"
        description="Your account, the AR Smart Home Server software itself, and the data you can take with you."
      />

      {justUpdated && (
        <Alert tone="success" icon={Sparkles} title="Update complete">
          <span className="inline-flex flex-wrap items-center gap-1.5 font-mono text-xs">
            <span className="text-fg-faint">v{justUpdated.from}</span>
            <ArrowRight size={11} className="text-fg-ghost" aria-hidden="true" />
            <span className="font-semibold text-live">v{justUpdated.to}</span>
          </span>
        </Alert>
      )}

      {/* ── Account ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          icon={KeyRound}
          title="Change your password"
          description="Applies to the account you are signed in as right now."
          actions={
            pwSavedAt ? (
              <Badge tone="live" icon={CheckCircle2}>Saved</Badge>
            ) : null
          }
        />
        <form onSubmit={changePw}>
          <CardBody className="space-y-4">
            {pwErr && <Alert tone="error">{pwErr}</Alert>}

            <Field label="Current password" required>
              {(a) => (
                <PasswordInput
                  {...a}
                  required
                  autoComplete="current-password"
                  value={pw.currentPassword}
                  onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
                />
              )}
            </Field>

            <FieldRow>
              <Field label="New password" required hint="At least 8 characters.">
                {(a) => (
                  <PasswordInput
                    {...a}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={pw.newPassword}
                    onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Confirm new password" required>
                {(a) => (
                  <PasswordInput
                    {...a}
                    required
                    autoComplete="new-password"
                    invalid={!!pw.confirm && pw.confirm !== pw.newPassword}
                    value={pw.confirm}
                    onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                  />
                )}
              </Field>
            </FieldRow>
          </CardBody>
          <CardFooter className="justify-end">
            <Button
              type="submit"
              variant="primary"
              loading={pwSaving}
              disabled={!pw.currentPassword || !pw.newPassword || !pw.confirm}
            >
              Change password
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* ── Software ─────────────────────────────────────────────────── */}
      {isAdmin && (
        <Card>
          <CardHeader
            icon={GitBranch}
            title="AR Smart Home Server"
            description="Pulls the latest code from GitHub and rebuilds the containers."
            actions={
              updateReady ? (
                <Badge tone="brand">Update ready</Badge>
              ) : info?.upToDate ? (
                <Badge tone="live" icon={CheckCircle2}>Up to date</Badge>
              ) : null
            }
          />
          <CardBody className="space-y-4">
            {!info ? (
              <div className="space-y-2">
                <div className="skeleton h-4 w-48" />
                <div className="skeleton h-4 w-64" />
              </div>
            ) : (
              <>
                <dl className="space-y-0">
                  <InfoRow label="Installed version" value={info.local?.version || 'unknown'} mono />
                  {info.remote?.version && (
                    <InfoRow
                      label="Latest available"
                      value={info.remote.version}
                      mono
                      tone={updateReady ? 'brand' : undefined}
                    />
                  )}
                  {info.remote?.sha && <InfoRow label="Latest commit" value={info.remote.sha} mono />}
                  <InfoRow
                    label="Repository"
                    value={
                      <a
                        href={(info.repo || FALLBACK_REPO).replace('.git', '')}
                        target="_blank"
                        rel="noreferrer"
                        title={(info.repo || FALLBACK_REPO).replace('.git', '')}
                        className="focus-ring inline-flex items-center gap-1 rounded text-brand hover:underline"
                      >
                        <span className="truncate">{REPO_LABEL}</span>
                        <ExternalLink size={11} aria-hidden="true" />
                      </a>
                    }
                  />
                </dl>

                {upToDateMsg && <Alert tone="success" icon={CheckCircle2}>{upToDateMsg}</Alert>}
                {requestErr && <Alert tone="error">{requestErr}</Alert>}
                {s.status === 'error' && !isRunning && (
                  <Alert tone="error" icon={AlertCircle} title="The last update failed">
                    {s.message || 'No further detail was recorded.'}
                  </Alert>
                )}

                {isRunning && (
                  <div className="rounded-lg border border-brand/25 bg-brand/[0.06] p-3">
                    <ProgressBar
                      value={progress}
                      showValue
                      label={s.message || s.step || 'Updating…'}
                    />
                    <p className="mt-2 text-xs text-fg-muted">
                      You stay signed in. The page reloads on its own when the rebuild finishes.
                    </p>
                  </div>
                )}
              </>
            )}
          </CardBody>
          <CardFooter className="justify-end">
            <Button icon={RefreshCw} onClick={checkUpdates} loading={checking} disabled={updating}>
              Check for updates
            </Button>
            <Button variant="primary" icon={Package} onClick={runUpdate} loading={updating}>
              {updating ? 'Updating…' : 'Update now'}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ── Data ─────────────────────────────────────────────────────── */}
      {isAdmin && (
        <Card>
          <CardHeader
            icon={Download}
            title="Export configuration"
            description="Downloads users, sites and permissions as a JSON file."
          />
          <CardBody>
            <Alert tone="info" icon={Info}>
              Secrets are never exported. Home Assistant access tokens and agent tokens stay on the
              server, so an export cannot be used to reach your sites.
            </Alert>
          </CardBody>
          <CardFooter className="justify-end">
            <Button icon={Download} onClick={exportData} loading={exporting}>
              Download export
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ── About ────────────────────────────────────────────────────── */}
      <Card tone="ghost">
        <CardBody className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
            <UserIcon size={14} className="text-fg-faint" aria-hidden="true" />
            About this session
          </h2>
          <dl className="space-y-0">
            <InfoRow label="Signed in as" value={user?.username} />
            <InfoRow
              label="Role"
              value={isAdmin ? 'Administrator — full access' : 'Standard — assigned sites only'}
            />
            <InfoRow label="Server version" value={info?.local?.version || '—'} mono />
          </dl>
          <a
            href="/api/docs"
            target="_blank"
            rel="noreferrer"
            className="focus-ring inline-flex items-center gap-1.5 rounded text-xs text-brand hover:underline"
          >
            API documentation
            <ExternalLink size={11} aria-hidden="true" />
          </a>
        </CardBody>
      </Card>
    </div>
  );
}

function InfoRow({ label, value, mono, tone }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/70 py-2 last:border-0 text-sm">
      <dt className="shrink-0 text-fg-faint">{label}</dt>
      <dd
        className={cn(
          'min-w-0 truncate text-right',
          mono && 'font-mono text-xs tnum',
          tone === 'brand' ? 'font-semibold text-brand' : 'text-fg'
        )}
      >
        {value}
      </dd>
    </div>
  );
}
