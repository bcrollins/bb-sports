-- Baseline migration: proves the versioned migration path.
-- Full table DDL remains owned by lib/db/bootstrap.ts until expand/contract
-- migrations are cut from live dumps. This file intentionally only documents
-- the ledger (created by the migrator) and a no-op select for fresh DBs.
SELECT 1;
