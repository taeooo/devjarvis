-- DevJarvis Backend
-- File: devjarvis-backend/docs/sql/002_create_project_file_indexing.sql
-- Purpose: Create project file manifest and indexing job foundation tables.
-- Execute manually in DBeaver against the devjarvis database.

CREATE TABLE IF NOT EXISTS dev_project_files (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL,
    relative_path VARCHAR(1000) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    extension VARCHAR(50) NOT NULL DEFAULT '',
    language VARCHAR(50) NOT NULL DEFAULT 'unknown',
    size_bytes BIGINT NOT NULL,
    sha256 VARCHAR(128),
    indexing_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    excluded BOOLEAN NOT NULL DEFAULT FALSE,
    excluded_reason VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_dev_project_files_project
        FOREIGN KEY (project_id)
        REFERENCES dev_projects (id)
        ON DELETE CASCADE,
    CONSTRAINT uk_dev_project_files_project_relative_path
        UNIQUE (project_id, relative_path),
    CONSTRAINT ck_dev_project_files_size_bytes
        CHECK (size_bytes >= 0),
    CONSTRAINT ck_dev_project_files_indexing_status
        CHECK (indexing_status IN ('PENDING', 'INDEXED', 'FAILED', 'EXCLUDED')),
    CONSTRAINT ck_dev_project_files_excluded_reason
        CHECK ((excluded = FALSE AND excluded_reason IS NULL) OR (excluded = TRUE))
);

CREATE INDEX IF NOT EXISTS idx_dev_project_files_project_id
    ON dev_project_files (project_id);

CREATE INDEX IF NOT EXISTS idx_dev_project_files_project_status
    ON dev_project_files (project_id, indexing_status);

CREATE INDEX IF NOT EXISTS idx_dev_project_files_project_excluded
    ON dev_project_files (project_id, excluded);

CREATE INDEX IF NOT EXISTS idx_dev_project_files_extension
    ON dev_project_files (extension);

CREATE TABLE IF NOT EXISTS dev_indexing_jobs (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    requested_file_count INTEGER NOT NULL DEFAULT 0,
    target_file_count INTEGER NOT NULL DEFAULT 0,
    processed_file_count INTEGER NOT NULL DEFAULT 0,
    failed_file_count INTEGER NOT NULL DEFAULT 0,
    total_chunk_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_dev_indexing_jobs_project
        FOREIGN KEY (project_id)
        REFERENCES dev_projects (id)
        ON DELETE CASCADE,
    CONSTRAINT ck_dev_indexing_jobs_status
        CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED')),
    CONSTRAINT ck_dev_indexing_jobs_requested_file_count
        CHECK (requested_file_count >= 0),
    CONSTRAINT ck_dev_indexing_jobs_target_file_count
        CHECK (target_file_count >= 0),
    CONSTRAINT ck_dev_indexing_jobs_processed_file_count
        CHECK (processed_file_count >= 0),
    CONSTRAINT ck_dev_indexing_jobs_failed_file_count
        CHECK (failed_file_count >= 0),
    CONSTRAINT ck_dev_indexing_jobs_total_chunk_count
        CHECK (total_chunk_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_dev_indexing_jobs_project_created_at
    ON dev_indexing_jobs (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dev_indexing_jobs_project_status
    ON dev_indexing_jobs (project_id, status);

COMMENT ON TABLE dev_project_files IS 'File manifest metadata registered for each DevJarvis project.';
COMMENT ON COLUMN dev_project_files.id IS 'Project file primary key.';
COMMENT ON COLUMN dev_project_files.project_id IS 'Parent project ID.';
COMMENT ON COLUMN dev_project_files.relative_path IS 'Project-root-relative path only. Absolute OS paths must not be stored.';
COMMENT ON COLUMN dev_project_files.file_name IS 'File name derived from the relative path.';
COMMENT ON COLUMN dev_project_files.extension IS 'Normalized file extension without dot.';
COMMENT ON COLUMN dev_project_files.language IS 'Client-detected or backend-normalized programming language.';
COMMENT ON COLUMN dev_project_files.size_bytes IS 'File size in bytes.';
COMMENT ON COLUMN dev_project_files.sha256 IS 'Client-calculated content hash. No file content is stored in this table.';
COMMENT ON COLUMN dev_project_files.indexing_status IS 'File indexing status: PENDING, INDEXED, FAILED, EXCLUDED.';
COMMENT ON COLUMN dev_project_files.excluded IS 'Whether this file is excluded from future RAG indexing.';
COMMENT ON COLUMN dev_project_files.excluded_reason IS 'Reason code for exclusion, such as SENSITIVE_FILE_PATTERN or CLIENT_EXCLUDED.';
COMMENT ON COLUMN dev_project_files.created_at IS 'Created timestamp.';
COMMENT ON COLUMN dev_project_files.updated_at IS 'Updated timestamp.';

COMMENT ON TABLE dev_indexing_jobs IS 'Project indexing job state for future async indexing pipeline.';
COMMENT ON COLUMN dev_indexing_jobs.id IS 'Indexing job primary key.';
COMMENT ON COLUMN dev_indexing_jobs.project_id IS 'Parent project ID.';
COMMENT ON COLUMN dev_indexing_jobs.status IS 'Indexing job status: PENDING, RUNNING, COMPLETED, FAILED, CANCELED.';
COMMENT ON COLUMN dev_indexing_jobs.requested_file_count IS 'Total project file count at job creation time.';
COMMENT ON COLUMN dev_indexing_jobs.target_file_count IS 'Non-excluded file count targeted by indexing at job creation time.';
COMMENT ON COLUMN dev_indexing_jobs.processed_file_count IS 'Processed file count.';
COMMENT ON COLUMN dev_indexing_jobs.failed_file_count IS 'Failed file count.';
COMMENT ON COLUMN dev_indexing_jobs.total_chunk_count IS 'Total generated chunk count. Filled by a future chunking pipeline.';
COMMENT ON COLUMN dev_indexing_jobs.error_message IS 'Failure reason or operational error summary.';
COMMENT ON COLUMN dev_indexing_jobs.started_at IS 'Indexing start timestamp.';
COMMENT ON COLUMN dev_indexing_jobs.finished_at IS 'Indexing finish timestamp.';
COMMENT ON COLUMN dev_indexing_jobs.created_at IS 'Created timestamp.';
COMMENT ON COLUMN dev_indexing_jobs.updated_at IS 'Updated timestamp.';
