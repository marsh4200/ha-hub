// Runs an in-place update by writing a flag file the host watcher picks up.
const fs = require('fs');
const path = require('path');

// FIX v1.2: flag/state files live in /app/data (the only volume-mounted dir).
// Previously these were at /app which shadowed the entire app code.
const DATA_DIR   = '/app/data';
const FLAG_FILE  = path.join(DATA_DIR, 'update-requested');
const STATE_FILE = path.join(DATA_DIR, 'update-state.json');

function ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
}

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { status: 'idle', message: null, updatedAt: null, commit: null }; }
}

function writeState(s) {
  try { ensureDir(); fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }
  catch (_) {}
}

async function currentCommit() {
  // VERSION lives at the repo root. From backend/src/services/updater.js that's
  // ../../../../VERSION when bundled — try a few sensible paths.
  const tryPaths = [
    path.resolve(__dirname, '../../../VERSION'),
    path.resolve(__dirname, '../../../../VERSION'),
    '/app/VERSION',
    '/VERSION',
  ];
  for (const p of tryPaths) {
    try {
      const ver = fs.readFileSync(p, 'utf8').trim();
      if (ver) return { version: ver };
    } catch (_) {}
  }
  return { version: 'unknown' };
}

async function checkRemote(repoUrl) {
  const m = (repoUrl || '').match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/i);
  if (!m) return { error: 'Unsupported repo URL — only github.com is supported' };
  const owner = m[1], repo = m[2];
  const branch = process.env.UPDATE_BRANCH || 'main';
  try {
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${branch}`, {
      headers: { 'User-Agent': 'HA-Hub-updater', 'Accept': 'application/vnd.github+json' },
    });
    if (!r.ok) return { error: `GitHub responded HTTP ${r.status}` };
    const j = await r.json();
    return {
      sha: j.sha?.slice(0, 7),
      message: j.commit?.message?.split('\n')[0],
      date: j.commit?.author?.date,
      url: j.html_url,
    };
  } catch (e) {
    return { error: e.message };
  }
}

function requestUpdate() {
  const state = readState();
  if (state.status === 'running') return { error: 'Update already in progress' };
  writeState({ status: 'requested', message: 'Update requested', updatedAt: new Date(), commit: null });
  try {
    ensureDir();
    fs.writeFileSync(FLAG_FILE, String(Date.now()));
    return { ok: true };
  } catch (e) {
    writeState({ status: 'error', message: e.message, updatedAt: new Date(), commit: null });
    return { error: e.message };
  }
}

module.exports = { readState, writeState, currentCommit, checkRemote, requestUpdate };
