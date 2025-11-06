-- AI Agent Creator Platform - Initial Database Schema
-- This migration creates the core tables for agents, conversations, messages, and configurations

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE conversation_status AS ENUM ('active', 'ended', 'transferred');
CREATE TYPE message_role AS ENUM ('user', 'agent');
CREATE TYPE message_type AS ENUM ('text', 'audio');
CREATE TYPE channel_type AS ENUM ('widget', 'sip');
CREATE TYPE personality_tone AS ENUM ('professional', 'friendly', 'casual', 'formal');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent configurations table
CREATE TABLE public.agents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  personality_tone personality_tone DEFAULT 'professional',
  personality_style TEXT,
  personality_instructions TEXT,
  response_time INTEGER DEFAULT 1000, -- milliseconds
  max_conversation_length INTEGER DEFAULT 50, -- number of messages
  escalation_triggers TEXT[], -- array of trigger phrases
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge base documents table
CREATE TABLE public.knowledge_base_documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  file_url TEXT,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge base URLs table
CREATE TABLE public.knowledge_base_urls (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  content TEXT,
  last_crawled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge base FAQs table
CREATE TABLE public.knowledge_base_faqs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Widget configurations table
CREATE TABLE public.widget_configs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  theme TEXT DEFAULT 'light',
  primary_color TEXT DEFAULT '#007bff',
  position TEXT DEFAULT 'bottom-right',
  size TEXT DEFAULT 'medium',
  auto_open BOOLEAN DEFAULT FALSE,
  greeting TEXT DEFAULT 'Hello! How can I help you today?',
  placeholder TEXT DEFAULT 'Type your message...',
  voice_enabled BOOLEAN DEFAULT TRUE,
  push_to_talk BOOLEAN DEFAULT FALSE,
  logo_url TEXT,
  company_name TEXT,
  show_powered_by BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(agent_id)
);

-- SIP configurations table
CREATE TABLE public.sip_configs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  provider_host TEXT NOT NULL,
  provider_port INTEGER DEFAULT 5060,
  username TEXT NOT NULL,
  password_encrypted TEXT NOT NULL, -- encrypted password
  realm TEXT NOT NULL,
  inbound_numbers TEXT[], -- array of phone numbers
  outbound_number TEXT,
  record_calls BOOLEAN DEFAULT TRUE,
  max_call_duration INTEGER DEFAULT 1800, -- seconds (30 minutes)
  transfer_enabled BOOLEAN DEFAULT FALSE,
  transfer_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(agent_id)
);

-- Conversation sessions table
CREATE TABLE public.conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  channel channel_type NOT NULL,
  phone_number TEXT,
  status conversation_status DEFAULT 'active',
  context JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table
CREATE TABLE public.messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  role message_role NOT NULL,
  content TEXT NOT NULL,
  type message_type DEFAULT 'text',
  audio_url TEXT,
  transcription TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_agents_user_id ON public.agents(user_id);
CREATE INDEX idx_agents_created_at ON public.agents(created_at);
CREATE INDEX idx_knowledge_base_documents_agent_id ON public.knowledge_base_documents(agent_id);
CREATE INDEX idx_knowledge_base_urls_agent_id ON public.knowledge_base_urls(agent_id);
CREATE INDEX idx_knowledge_base_faqs_agent_id ON public.knowledge_base_faqs(agent_id);
CREATE INDEX idx_conversations_agent_id ON public.conversations(agent_id);
CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX idx_conversations_status ON public.conversations(status);
CREATE INDEX idx_conversations_started_at ON public.conversations(started_at);
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON public.agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_knowledge_base_documents_updated_at BEFORE UPDATE ON public.knowledge_base_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_knowledge_base_urls_updated_at BEFORE UPDATE ON public.knowledge_base_urls FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_knowledge_base_faqs_updated_at BEFORE UPDATE ON public.knowledge_base_faqs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_widget_configs_updated_at BEFORE UPDATE ON public.widget_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sip_configs_updated_at BEFORE UPDATE ON public.sip_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();