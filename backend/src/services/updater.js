// In-portal updater. Writes a flag file the host watcher picks up.
const fs = require('fs');
const path = require('path');

const DATA_DIR   = '/app/data';
const FLAG_FILE  = path.join(DATA_DIR, 'update-requested');
const STATE_FILE = path.join(DATA_DIR, 'update-state.json');

function ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
}

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { status: 'idle', message: null, updatedAt: null }; }
}

function writeState(s) {
  try { ensureDir(); fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }
  catch (_) {}
}

async function currentCommit() {
  for (const p of ['/app/VERSION', path.resolve(__dirname, '../../../VERSION')]) {
    try {
      const ver = fs.readFileSync(p, 'utf8').trim();
      if (ver) return { version: ver };
    } catch (_) {}
  }
  return { version: 'unknown' };
}

// Fetch the VERSION file from the repo's raw URL — same source the user edits.
async function fetchRemoteVersion(repoUrl) {
  const m = (repoUrl || '').match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/i);
  if (!m) return { error: 'Unsupported repo URL — only github.com is supported' };
  const owner = m[1], repo = m[2];
  const branch = process.env.UPDATE_BRANCH || 'main';
  try {
    const r = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/VERSION`, {
      headers: { 'User-Agent': 'HA-Hub-updater' },
    });
    if (!r.ok) return { error: `Couldn't read VERSION (HTTP ${r.status})` };
    const version = (await r.text()).trim();
    return { version };
  } catch (e) {
    return { error: e.message };
  }
}

// Also fetch latest commit info to show the user
async function fetchLatestCommit(repoUrl) {
  const m = (repoUrl || '').match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/i);
  if (!m) return null;
  const owner = m[1], repo = m[2];
  const branch = process.env.UPDATE_BRANCH || 'main';
  try {
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${branch}`, {
      headers: { 'User-Agent': 'HA-Hub-updater', 'Accept': 'application/vnd.github+json' },
    });
    if (!r.ok) return null;
    const j = await r.json();
    return {
      sha: j.sha?.slice(0, 7),
      message: j.commit?.message?.split('\n')[0],
      date: j.commit?.author?.date,
    };
  } catch (_) {
    return null;
  }
}

// Combined check: compares local VERSION vs remote VERSION
async function checkRemote(repoUrl) {
  const [remote, commit, local] = await Promise.all([
    fetchRemoteVersion(repoUrl),
    fetchLatestCommit(repoUrl),
    currentCommit(),
  ]);
  if (remote.error) return { error: remote.error };
  return {
    localVersion: local.version,
    remoteVersion: remote.version,
    upToDate: local.version === remote.version,
    commit,
  };
}

function requestUpdate() {
  const state = readState();
  if (state.status === 'running' || state.status === 'requested') {
    return { error: 'An update is already in progress' };
  }
  writeState({ status: 'requested', message: 'Queued — waiting for watcher to pick up', step: 'queued', progress: 0, updatedAt: new Date() });
  try {
    ensureDir();
    fs.writeFileSync(FLAG_FILE, String(Date.now()));
    return { ok: true };
  } catch (e) {
    writeState({ status: 'error', message: e.message, updatedAt: new Date() });
    return { error: e.message };
  }
}

module.exports = { readState, writeState, currentCommit, checkRemote, requestUpdate };
