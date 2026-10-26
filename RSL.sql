-- Enable RLS on the table
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policy: a user can only see rows where tenant_id = current_setting('app.current_tenant')
CREATE POLICY tenant_isolation ON documents
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- RLS gives cryptographically‑enforced isolation at the row level.
-- Helper function to set the tenant
-- Optional helper
CREATE OR REPLACE FUNCTION set_current_tenant(p_tenant uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM set_config('app.current_tenant', p_tenant::text, true);
END;
$$;
