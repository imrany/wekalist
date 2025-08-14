-- Migration to fix BIGINT default values
-- This updates existing tables to use proper EXTRACT with BIGINT casting

-- Update migration_history table
ALTER TABLE migration_history 
ALTER COLUMN created_ts SET DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT;

-- Update user table
ALTER TABLE "user" 
ALTER COLUMN created_ts SET DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
ALTER COLUMN updated_ts SET DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT;

-- Update memo table
ALTER TABLE memo 
ALTER COLUMN created_ts SET DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
ALTER COLUMN updated_ts SET DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT;

-- Update resource table
ALTER TABLE resource 
ALTER COLUMN created_ts SET DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
ALTER COLUMN updated_ts SET DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT;

-- Update activity table
ALTER TABLE activity 
ALTER COLUMN created_ts SET DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT;

-- Update inbox table
ALTER TABLE inbox 
ALTER COLUMN created_ts SET DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT;

-- Update reaction table
ALTER TABLE reaction 
ALTER COLUMN created_ts SET DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT;