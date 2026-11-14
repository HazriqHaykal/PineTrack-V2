-- Migration 002: grading breakdown (FR08) and marketability policy (FR09)
--
-- Adds two new tables. No existing table, column or row is changed or deleted.
--
-- The backend creates these tables by itself on startup (Base.metadata.create_all
-- only creates tables that are missing), so running this file is optional.
-- Run it by hand in the Supabase SQL editor if you prefer to apply schema
-- changes yourself. It is safe to run more than once.

-- Which grades the farm counts as marketable. Rows are never edited: each
-- change adds a row, so id is the policy version and the table is its history.
CREATE TABLE IF NOT EXISTS marketability_policies (
    id SERIAL PRIMARY KEY,
    marketable_grades VARCHAR(20) NOT NULL,   -- comma separated, e.g. 'A,B,C'
    note TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Kilograms of each grade in a harvest batch, entered by the farmer.
-- is_marketable is copied from the policy in force when the quantity was saved,
-- so changing the policy never alters an existing batch's yield.
CREATE TABLE IF NOT EXISTS harvest_grades (
    id SERIAL PRIMARY KEY,
    harvest_id INTEGER NOT NULL REFERENCES harvest(id) ON DELETE CASCADE,
    grade VARCHAR(1) NOT NULL,
    quantity_kg FLOAT NOT NULL,
    is_marketable BOOLEAN NOT NULL,
    policy_id INTEGER REFERENCES marketability_policies(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_harvest_grades_harvest_grade UNIQUE (harvest_id, grade),
    CONSTRAINT ck_harvest_grades_quantity_nonnegative CHECK (quantity_kg >= 0),
    CONSTRAINT ck_harvest_grades_grade CHECK (grade IN ('A', 'B', 'C', 'D'))
);

CREATE INDEX IF NOT EXISTS ix_harvest_grades_harvest_id ON harvest_grades(harvest_id);

-- Keep the tables out of Supabase's public REST API, like the other tables
ALTER TABLE marketability_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE harvest_grades ENABLE ROW LEVEL SECURITY;

-- Existing batches get no grade rows. A batch recorded with one overall grade
-- stays a "legacy" record and keeps its existing marketable quantity
-- (harvested - spoilage - rejected) until someone records its grade quantities.
-- No distribution is invented for them.
--
-- The first policy version (every grade, A to D, marketable) is created by the
-- backend the first time it is needed. Unsellable fruit is recorded as spoilage
-- or rejection on the batch, which is deducted from the graded quantities.
