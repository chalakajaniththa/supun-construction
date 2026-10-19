-- CreateTable
CREATE TABLE "gdrive_link" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "action" TEXT,
    "state" TEXT NOT NULL DEFAULT 'IDLE',
    "auth_url" TEXT,
    "message" TEXT,
    "requested_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gdrive_link_pkey" PRIMARY KEY ("id")
);

-- The one row the app and the backup container share.
INSERT INTO "gdrive_link" ("id") VALUES (1) ON CONFLICT DO NOTHING;
