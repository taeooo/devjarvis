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
