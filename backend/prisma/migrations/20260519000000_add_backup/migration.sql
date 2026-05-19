-- HA-Hub v1.8: add backup metadata columns to Client
ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "backupFilename" TEXT,
  ADD COLUMN IF NOT EXISTS "backupSize" BIGINT,
  ADD COLUMN IF NOT EXISTS "backupUploadedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "backupUploadedById" TEXT;

-- (No FK constraint on uploader so that deleting a user doesn't wipe the metadata.)
