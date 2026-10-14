-- Allocations are plans that must never overlap for the same worker / asset.
-- Enforced in the database (btree_gist exclusion constraints). Half-open ranges [start, end)
-- so back-to-back allocations (10:00–12:00 then 12:00–14:00) are allowed.
-- Cancelled allocations are ignored. The API maps SQLSTATE 23P01 to HTTP 409 ALLOCATION_OVERLAP.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "WorkerAllocation" ADD CONSTRAINT worker_alloc_no_overlap
  EXCLUDE USING gist ("workerId" WITH =, tstzrange("startAt", "endAt", '[)') WITH &&)
  WHERE (status <> 'CANCELLED');

ALTER TABLE "AssetAllocation" ADD CONSTRAINT asset_alloc_no_overlap
  EXCLUDE USING gist ("assetId" WITH =, tstzrange("startAt", "endAt", '[)') WITH &&)
  WHERE (status <> 'CANCELLED');

ALTER TABLE "WorkerAllocation" ADD CONSTRAINT worker_alloc_range CHECK ("endAt" > "startAt");
ALTER TABLE "AssetAllocation" ADD CONSTRAINT asset_alloc_range CHECK ("endAt" > "startAt");
