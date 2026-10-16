-- CreateTable
CREATE TABLE "backup_agent" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gdrive_configured" BOOLEAN NOT NULL DEFAULT false,
    "schedule" TEXT,
    "version" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_agent_pkey" PRIMARY KEY ("id")
);
