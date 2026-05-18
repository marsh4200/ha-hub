// Runs an in-place update: git pull on the host, then rebuild & restart containers.
// IMPORTANT: this runs inside the container — it triggers an update script on the host
// via a shared volume + flag file, OR (simpler) writes status and tells the user to run
// update.sh. We use the "flag file" pattern so the container can request its own rebuild.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);

const STATE_FILE = '/app/update-state.json';

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { status: 'idle', message: null, updatedAt: null, commit: null }; }
}

function writeState(s) {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); } catch (_) {}
}

async function currentCommit() {
  // The container has the source baked in — we read VERSION + commit hash if present
  try {
    const ver = fs.readFileSync(path.resolve(__dirname, '../../../VERSION'), 'utf8').trim();
    return { version: ver };
  } catch {
    return { version: 'unknown' };
  }
}

// Fetch latest commit from GitHub's API without needing git in the container
async function checkRemote(repoUrl) {
  // Convert https://github.com/USER/REPO.git → API URL
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

// Request an update by writing a flag file the host watcher picks up.
function requestUpdate() {
  const flag = '/app/update-requested';
  const state = readState();
  if (state.status === 'running') return { error: 'Update already in progress' };
  writeState({ status: 'requested', message: 'Update requested', updatedAt: new Date(), commit: null });
  try {
    fs.writeFileSync(flag, String(Date.now()));
    return { ok: true };
  } catch (e) {
    writeState({ status: 'error', message: e.message, updatedAt: new Date(), commit: null });
    return { error: e.message };
  }
}

module.exports = { readState, writeState, currentCommit, checkRemote, requestUpdate };
