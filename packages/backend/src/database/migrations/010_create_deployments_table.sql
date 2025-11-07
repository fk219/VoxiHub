-- Create deployments table
CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('twilio', 'chat_widget', 'voice_widget')),
  status VARCHAR(50) DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error')),
  config JSONB NOT NULL DEFAULT '{}',
  webhook_url TEXT,
  embed_code TEXT,
  phone_number VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_deployments_agent_id ON deployments(agent_id);
CREATE INDEX IF NOT EXISTS idx_deployments_type ON deployments(type);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
CREATE INDEX IF NOT EXISTS idx_deployments_phone_number ON deployments(phone_number) WHERE phone_number IS NOT NULL;

-- Add trigger to update deployments.updated_at
CREATE TRIGGER update_deployments_updated_at
    BEFORE UPDATE ON deployments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE deployments IS 'Stores agent deployment configurations for various channels';
COMMENT ON COLUMN deployments.type IS 'Deployment channel type: twilio, chat_widget, or voice_widget';
COMMENT ON COLUMN deployments.status IS 'Current deployment status: active, inactive, or error';
COMMENT ON COLUMN deployments.config IS 'JSON configuration specific to the deployment type';
COMMENT ON COLUMN deployments.webhook_url IS 'Webhook URL for receiving events (primarily for Twilio)';
COMMENT ON COLUMN deployments.embed_code IS 'HTML embed code for widget deployments';
COMMENT ON COLUMN deployments.phone_number IS 'Phone number for Twilio deployments';
