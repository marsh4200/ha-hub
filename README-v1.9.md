# HA-Hub v1.9.0 — Emergency encryption key

## What's new

🔑 **Store an emergency encryption key (plain text) alongside each client's backup.**

This is the key Home Assistant gives you when you create an *encrypted* backup — without it the `.tar` can't be restored. v1.9 lets you keep it next to the backup it belongs to.

- **Paste it in** or **upload a `.txt`** file (its contents are read into the field)
- **Reveal / hide** toggle so it isn't shown by default (masked until you click the eye)
- **Download as `.txt`** any time — filename `emergency-encryption-key-<client>.txt`
- **Admins** can add, edit, and delete the key
- **Admins + assigned users** can view and download it (same access as the backup itself)
- **Audit-logged** — every add / update / delete is recorded in the Logs page
- Lives in the same expandable Backup card on the Clients page, under the backup

## Files

| File | Status |
| --- | --- |
| `backend/prisma/schema.prisma` | **CHANGED** — adds `backupKey`, `backupKeyUpdatedAt`, `backupKeyUpdatedById` |
| `backend/prisma/migrations/20260520000000_add_backup_key/migration.sql` | **NEW** — DB migration |
| `backend/src/controllers/backup.controller.js` | **CHANGED** — `getBackupInfo` now returns the key; new `setBackupKey` / `deleteBackupKey` |
| `backend/src/routes/backup.routes.js` | **CHANGED** — `PUT /key` and `DELETE /key` (admin only) |
| `frontend/src/components/BackupCard.jsx` | **CHANGED** — key section: textarea, reveal toggle, upload/save/download/delete |
| `VERSION` | 1.9.0 |

## API

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/clients/:id/backup` | admin or assigned | now also returns `key: { content, updatedAt, updatedBy } \| null` |
| `PUT` | `/api/clients/:id/backup/key` | admin | JSON body `{ "content": "…" }`, max 8192 chars |
| `DELETE` | `/api/clients/:id/backup/key` | admin | clears the key |

## ⚠️ Security note

The key is stored as plain text in the database and returned to anyone who can access the backup. Storing the decryption key next to the encrypted backup reduces the protection encryption gives you against an attacker who compromises the hub. Treat it as convenience storage, **keep an offline copy of the key too**, and limit who is assigned to each client.

## Deploy

```bash
curl -sSL https://raw.githubusercontent.com/marsh4200/ha-hub/main/apply-update.sh | sudo bash
```

The migration auto-runs on container startup (via `npx prisma migrate deploy`).

## Test it

1. Expand a client's Backup card on the Clients page
2. Paste a key → **Save key** → reload and confirm it persists, masked by default
3. Click the eye to reveal; edit; **Save changes**
4. **Upload .txt** → the file's contents fill the field
5. **Download .txt** → file downloads with the client-named filename
6. As a non-admin assigned user → you can view/download but not edit or delete
7. **Delete** → key clears; check the Logs page for the audit entries
