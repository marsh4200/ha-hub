-- HA-Hub v1.9: add emergency encryption key (text) alongside the per-client backup
ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "backupKey" TEXT,
  ADD COLUMN IF NOT EXISTS "backupKeyUpdatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "backupKeyUpdatedById" TEXT;

-- (No FK constraint on the editor so that deleting a user doesn't wipe the metadata.)
