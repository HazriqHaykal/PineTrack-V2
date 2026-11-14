-- Migration 001: batch traceability timeline
--
-- Adds one new table. No existing table or row is changed.
--
-- The backend creates this table by itself on startup (Base.metadata.create_all
-- only creates tables that are missing), so running this file is optional.
-- Run it by hand in the Supabase SQL editor if you prefer to apply schema
-- changes yourself. It is safe to run more than once.

CREATE TABLE IF NOT EXISTS batch_events (
    id SERIAL PRIMARY KEY,
    batch_id INTEGER NOT NULL REFERENCES harvest(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    actor_user_id INTEGER REFERENCES users(id),
    related_module VARCHAR(20) NOT NULL,      -- harvest, transport, waste
    related_record_id INTEGER,                -- id of the transport/waste/harvest row involved
    description TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',      -- JSON describing the change
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_batch_events_batch_id ON batch_events(batch_id);

-- Keep the table out of Supabase's public REST API, like the other tables
ALTER TABLE batch_events ENABLE ROW LEVEL SECURITY;

-- Existing batches get no back-filled events: their earlier history cannot be
-- reconstructed reliably, so the app shows a "history unavailable" notice instead.
