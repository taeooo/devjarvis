-- DevJarvis Backend
-- File: devjarvis-backend/docs/sql/001_create_dev_projects.sql
-- Purpose: Create project metadata table for DevJarvis MVP.
-- Execute manually in DBeaver against the devjarvis database.

CREATE TABLE IF NOT EXISTS dev_projects (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    root_path_alias VARCHAR(500),
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_dev_projects_name UNIQUE (name),
    CONSTRAINT ck_dev_projects_status CHECK (status IN ('ACTIVE', 'ARCHIVED', 'DELETED'))
);

CREATE INDEX IF NOT EXISTS idx_dev_projects_status_created_at
    ON dev_projects (status, created_at DESC);

COMMENT ON TABLE dev_projects IS 'DevJarvis registered developer projects.';
COMMENT ON COLUMN dev_projects.id IS 'Project primary key.';
COMMENT ON COLUMN dev_projects.name IS 'Project display name. Unique in MVP scope.';
COMMENT ON COLUMN dev_projects.root_path_alias IS 'Client-side project root path alias. Do not store sensitive absolute paths in production.';
COMMENT ON COLUMN dev_projects.description IS 'Project description.';
COMMENT ON COLUMN dev_projects.status IS 'Project status: ACTIVE, ARCHIVED, DELETED.';
COMMENT ON COLUMN dev_projects.created_at IS 'Created timestamp.';
COMMENT ON COLUMN dev_projects.updated_at IS 'Updated timestamp.';
