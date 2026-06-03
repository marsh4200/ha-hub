# HA-Hub v1.10.0 — Chunked backup upload (large files through the tunnel)

## The problem

Uploading a backup through the Cloudflare Tunnel hostname (`hub.mydomain.com`) failed at the end with **413 Payload Too Large** for anything over ~100 MB. That's Cloudflare's per-request body cap (100 MB Free/Pro, 200 MB Business, 500 MB Enterprise) — enforced at the edge, before the request reaches the server, and not configurable below Enterprise.

## The fix

Large uploads are now split client-side into **80 MB parts**. Each part is its own request, so every one stays under the proxy cap and goes through the tunnel fine. The server stages the parts and reassembles them into the full `.tar`, then runs the exact same validation/storage path as a normal upload.

- **Automatic** — files under 90 MB still upload in a single request (unchanged). Bigger files chunk transparently; no setting to flip.
- **Works remotely** — no new DNS record, TLS cert, port-forward, or exposed origin. Keeps using the tunnel you already have.
- **Progress** — the bar shows `part 3/8` then `finalizing…`.
- **Resumable-ish** — a failed upload calls an abort endpoint to clear staged parts server-side; just retry.
- Same 800 MB overall limit, same magic-byte `.tar`/`.tar.gz` validation, same "one backup per client", same audit log.

## Why not "send uploads straight to the server IP"?

A browser that's off the LAN can't reach a private `192.168.x.x` address, an HTTPS page can't POST to a plain-HTTP IP (mixed content), and the login cookie is scoped to the portal hostname so it wouldn't authenticate. The only no-infra way to beat the cap for remote users is chunking — which is what this does.

## Files

| File | Status |
| --- | --- |
| `backend/src/controllers/backup.controller.js` | **CHANGED** — extracted `finalizeBackupFile`; added `uploadChunk`, `completeChunkedUpload`, `abortChunkedUpload` |
| `backend/src/routes/backup.routes.js` | **CHANGED** — `chunkUpload` multer (95 MB/part) + `POST /chunk`, `/chunk/complete`, `/chunk/abort` (admin) |
| `frontend/src/components/BackupCard.jsx` | **CHANGED** — size-aware upload: single-shot ≤90 MB, sliced above; part/finalize progress |
| `VERSION` | 1.10.0 |

## API (all admin-only)

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/clients/:id/backup/chunk` | multipart: `uploadId`, `index`, `total`, `chunk` | one part; capped at 95 MB |
| `POST` | `/api/clients/:id/backup/chunk/complete` | JSON: `{ uploadId, filename, total }` | reassemble + validate + store |
| `POST` | `/api/clients/:id/backup/chunk/abort` | JSON: `{ uploadId }` | discard staged parts |

Tunables (env): `BACKUP_CHUNK_MAX_BYTES` (default 95 MB per part), `BACKUP_CHUNK_DIR` (default `<BACKUP_TMP_DIR>/chunks`).

## Test it

1. Through the **tunnel** hostname, upload your 298 MB tar → progress shows `part 1/4 … 4/4 … finalizing…` → succeeds (no 413)
2. Confirm size/filename/uploader on the card match the file
3. Download it back and verify it restores in Home Assistant
4. Upload a small (<90 MB) tar → still a single request, works as before
5. Kill the network mid-upload → it errors and the staged parts are discarded; retry cleanly
