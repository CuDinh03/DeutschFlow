-- Create async_jobs table for tracking background task status
CREATE TABLE async_jobs (
    id UUID PRIMARY KEY,
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    result_payload TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for querying jobs by status and type
CREATE INDEX idx_async_jobs_status ON async_jobs (status);
CREATE INDEX idx_async_jobs_job_type ON async_jobs (job_type);
CREATE INDEX idx_async_jobs_created_at ON async_jobs (created_at);
