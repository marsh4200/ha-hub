-- HA-Hub v1.11: read live data from each client's Home Assistant REST API
-- using a long-lived access token stored encrypted (AES-256-GCM).

ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "haToken"          TEXT,
  ADD COLUMN IF NOT EXISTS "haTokenHint"      TEXT,
  ADD COLUMN IF NOT EXISTS "haTokenSetAt"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "haTokenStatus"    TEXT,
  ADD COLUMN IF NOT EXISTS "haTokenCheckedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "locationName"     TEXT,
  ADD COLUMN IF NOT EXISTS "timeZone"         TEXT,
  ADD COLUMN IF NOT EXISTS "haState"          TEXT,
  ADD COLUMN IF NOT EXISTS "entityCount"      INTEGER,
  ADD COLUMN IF NOT EXISTS "unavailableCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "integrationCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "automationCount"  INTEGER,
  ADD COLUMN IF NOT EXISTS "updateAvailable"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "latestVersion"    TEXT,
  ADD COLUMN IF NOT EXISTS "pendingUpdates"   INTEGER,
  ADD COLUMN IF NOT EXISTS "latencyMs"        INTEGER,
  ADD COLUMN IF NOT EXISTS "lastDetailAt"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "haDetails"        JSONB;

-- Sites needing attention are the common dashboard filter.
CREATE INDEX IF NOT EXISTS "Client_status_idx" ON "Client" ("status");
CREATE INDEX IF NOT EXISTS "Client_updateAvailable_idx" ON "Client" ("updateAvailable");
