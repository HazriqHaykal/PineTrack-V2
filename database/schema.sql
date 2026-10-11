-- PineTrack V2.0 PostgreSQL/Supabase Schema
-- Farm Management System Database
--
-- Reference only: the backend creates these tables automatically on startup
-- (see backend/app/models.py). Run this file by hand only if you want to
-- create the tables yourself in PostgreSQL.

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    role VARCHAR(20) DEFAULT 'worker',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Harvest table
CREATE TABLE IF NOT EXISTS harvest (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    batch_number VARCHAR(50) NOT NULL UNIQUE,
    field_name VARCHAR(100) NOT NULL,
    harvest_date DATE NOT NULL,
    quantity_kg FLOAT NOT NULL CHECK (quantity_kg > 0),
    quality_grade VARCHAR(20),
    ripeness_level FLOAT CHECK (ripeness_level IS NULL OR (ripeness_level >= 0 AND ripeness_level <= 10)),
    harvest_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    spoilage_kg FLOAT NOT NULL DEFAULT 0 CHECK (spoilage_kg >= 0),
    rejected_kg FLOAT NOT NULL DEFAULT 0 CHECK (rejected_kg >= 0),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Quality targets table (management-defined thresholds for spoilage/rejection rates)
CREATE TABLE IF NOT EXISTS quality_targets (
    id SERIAL PRIMARY KEY,
    max_spoilage_rate FLOAT NOT NULL DEFAULT 5.0 CHECK (max_spoilage_rate >= 0 AND max_spoilage_rate <= 100),
    max_rejection_rate FLOAT NOT NULL DEFAULT 5.0 CHECK (max_rejection_rate >= 0 AND max_rejection_rate <= 100),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Transport table
CREATE TABLE IF NOT EXISTS transport (
    id SERIAL PRIMARY KEY,
    harvest_id INTEGER REFERENCES harvest(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    destination VARCHAR(200) NOT NULL,
    driver_name VARCHAR(100) NOT NULL DEFAULT '',
    vehicle_number VARCHAR(50) NOT NULL DEFAULT '',
    scheduled_date DATE NOT NULL,
    actual_delivery DATE,
    cargo_weight_kg FLOAT CHECK (cargo_weight_kg IS NULL OR cargo_weight_kg > 0),
    status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Schedules table
CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL REFERENCES users(id),
    task_type VARCHAR(50) NOT NULL,
    assigned_date DATE NOT NULL,
    scheduled_time TIME,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'pending',
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Waste table
CREATE TABLE IF NOT EXISTS waste (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    harvest_id INTEGER REFERENCES harvest(id),
    waste_type VARCHAR(100) NOT NULL,
    quantity_kg FLOAT NOT NULL CHECK (quantity_kg > 0),
    waste_date DATE NOT NULL,
    classification VARCHAR(30) NOT NULL DEFAULT 'compostable',
    disposal_method VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- AI Logs table
CREATE TABLE IF NOT EXISTS ai_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    harvest_id INTEGER REFERENCES harvest(id),
    prediction_type VARCHAR(100) NOT NULL,
    input_data TEXT NOT NULL,
    prediction_result TEXT NOT NULL,
    confidence_score FLOAT,
    model_version VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_harvest_user_date ON harvest(user_id, harvest_date);
CREATE INDEX IF NOT EXISTS idx_harvest_status ON harvest(harvest_status);
CREATE INDEX IF NOT EXISTS idx_transport_user_date ON transport(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_transport_harvest_id ON transport(harvest_id);
CREATE INDEX IF NOT EXISTS idx_transport_status ON transport(status);
CREATE INDEX IF NOT EXISTS idx_schedules_worker_date ON schedules(worker_id, assigned_date);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);
CREATE INDEX IF NOT EXISTS idx_waste_user_date ON waste(user_id, waste_date);
CREATE INDEX IF NOT EXISTS idx_ai_logs_harvest_id ON ai_logs(harvest_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created_at ON ai_logs(created_at);
