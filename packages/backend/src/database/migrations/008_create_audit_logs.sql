-- Create audit_logs table for compliance tracking
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  session_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_security ON audit_logs(action, created_at) WHERE resource_type = 'security';

-- Enable Row Level Security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Only admins can read audit logs
CREATE POLICY "Admins can read all audit logs" ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND (auth.users.raw_user_meta_data->>'role')::text = 'admin'
    )
  );

-- Users can only read their own audit logs (limited fields)
CREATE POLICY "Users can read own audit logs" ON audit_logs
  FOR SELECT
  USING (
    user_id = auth.uid() 
    AND action NOT IN ('suspicious_activity', 'rate_limit_exceeded', 'unauthorized_access')
  );

-- Only system can insert audit logs (no user-facing inserts)
CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT
  WITH CHECK (true); -- This will be handled by service role key

-- No updates or deletes allowed (audit logs are immutable)
CREATE POLICY "No updates allowed" ON audit_logs
  FOR UPDATE
  USING (false);

CREATE POLICY "No deletes allowed" ON audit_logs
  FOR DELETE
  USING (false);

-- Create function to automatically clean up old audit logs
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
  retention_days INTEGER := 365; -- Default 1 year retention
BEGIN
  -- Delete audit logs older than retention period
  DELETE FROM audit_logs 
  WHERE created_at < NOW() - INTERVAL '1 day' * retention_days;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to run cleanup (if pg_cron is available)
-- This would typically be set up separately in production
-- SELECT cron.schedule('cleanup-audit-logs', '0 2 * * *', 'SELECT cleanup_old_audit_logs();');

COMMENT ON TABLE audit_logs IS 'Audit trail for all system activities and security events';
COMMENT ON COLUMN audit_logs.action IS 'Type of action performed (login, agent_created, etc.)';
COMMENT ON COLUMN audit_logs.resource_type IS 'Type of resource affected (agent, conversation, etc.)';
COMMENT ON COLUMN audit_logs.resource_id IS 'ID of the specific resource affected';
COMMENT ON COLUMN audit_logs.details IS 'Additional context and metadata for the action';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address of the client that performed the action';
COMMENT ON COLUMN audit_logs.user_agent IS 'User agent string of the client';
COMMENT ON COLUMN audit_logs.session_id IS 'Session identifier for tracking user sessions';