-- Create IVR Menus table
CREATE TABLE IF NOT EXISTS ivr_menus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  prompt TEXT NOT NULL,
  items JSONB NOT NULL,
  timeout INTEGER DEFAULT 30000,
  max_retries INTEGER DEFAULT 3,
  invalid_prompt TEXT,
  timeout_prompt TEXT,
  parent_menu_id UUID REFERENCES ivr_menus(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create IVR Sessions table
CREATE TABLE IF NOT EXISTS ivr_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id VARCHAR(255) NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  current_menu_id UUID REFERENCES ivr_menus(id) ON DELETE SET NULL,
  menu_stack JSONB NOT NULL DEFAULT '[]',
  retry_count INTEGER DEFAULT 0,
  start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for ivr_menus
CREATE INDEX idx_ivr_menus_user_id ON ivr_menus(user_id);
CREATE INDEX idx_ivr_menus_parent_menu_id ON ivr_menus(parent_menu_id);

-- Create indexes for ivr_sessions
CREATE INDEX idx_ivr_sessions_session_id ON ivr_sessions(session_id);
CREATE INDEX idx_ivr_sessions_user_id ON ivr_sessions(user_id);
CREATE INDEX idx_ivr_sessions_current_menu_id ON ivr_sessions(current_menu_id);
CREATE INDEX idx_ivr_sessions_last_activity ON ivr_sessions(last_activity);

-- Create updated_at trigger for ivr_menus
CREATE TRIGGER update_ivr_menus_updated_at
  BEFORE UPDATE ON ivr_menus
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies for ivr_menus
ALTER TABLE ivr_menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own IVR menus"
  ON ivr_menus FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own IVR menus"
  ON ivr_menus FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own IVR menus"
  ON ivr_menus FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own IVR menus"
  ON ivr_menus FOR DELETE
  USING (auth.uid() = user_id);

-- Add RLS policies for ivr_sessions
ALTER TABLE ivr_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own IVR sessions"
  ON ivr_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage IVR sessions"
  ON ivr_sessions FOR ALL
  USING (true)
  WITH CHECK (true);
