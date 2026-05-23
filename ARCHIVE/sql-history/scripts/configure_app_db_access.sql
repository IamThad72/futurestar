-- Run as a role with database admin privileges.
GRANT CONNECT ON DATABASE estate_mgmt_db TO estate_user;
GRANT USAGE, CREATE ON SCHEMA public TO estate_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO estate_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO estate_user;
