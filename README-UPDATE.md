# HA-Hub v1.1.0 update bundle

## How to deploy in ONE command

### Step 1 — Upload these files to GitHub (one time)

Drag & drop the contents of this zip into https://github.com/marsh4200/ha-hub so the folder structure matches. GitHub will overwrite changed files and add the new ones.

The most important new file is `apply-update.sh` at the repo root — that's what the one-liner will fetch.

### Step 2 — On your server, run this single command

```bash
curl -sSL https://raw.githubusercontent.com/marsh4200/ha-hub/main/apply-update.sh | sudo bash
```

It does everything:
- Pulls the latest code
- Installs the in-portal update watcher (only the first time)
- Rebuilds and restarts the containers
- Waits for health
- Prints the URL

### Step 3 — From now on

Future updates can be done either way:

**Easy:** Open the portal → Settings → Updates → click **Update now** ✨

**Or rerun the one-liner** any time, on any version, and it'll bring you up to date.

