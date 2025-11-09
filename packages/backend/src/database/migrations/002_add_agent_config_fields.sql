-- Add LLM configuration fields to agents table
ALTER TABLE public.agents 
ADD COLUMN IF NOT EXISTS llm_provider TEXT DEFAULT 'openai',
ADD COLUMN IF NOT EXISTS llm_model TEXT DEFAULT 'gpt-4-turbo-preview',
ADD COLUMN IF NOT EXISTS llm_temperature DECIMAL(3,2) DEFAULT 0.7,
ADD COLUMN IF NOT EXISTS llm_max_tokens INTEGER DEFAULT 1000;

-- Add TTS configuration fields
ALTER TABLE public.agents
ADD COLUMN IF NOT EXISTS tts_provider TEXT DEFAULT 'groq',
ADD COLUMN IF NOT EXISTS tts_voice TEXT DEFAULT 'Fritz-PlayAI',
ADD COLUMN IF NOT EXISTS tts_speed DECIMAL(3,2) DEFAULT 1.0;

-- Add STT configuration fields
ALTER TABLE public.agents
ADD COLUMN IF NOT EXISTS stt_provider TEXT DEFAULT 'groq',
ADD COLUMN IF NOT EXISTS stt_language TEXT DEFAULT 'en';

-- Add advanced features
ALTER TABLE public.agents
ADD COLUMN IF NOT EXISTS functions_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS knowledge_base_ids TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS interruption_sensitivity DECIMAL(3,2) DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS max_call_duration INTEGER DEFAULT 3600000,
ADD COLUMN IF NOT EXISTS webhook_url TEXT DEFAULT '';

-- Add status and publishing fields
ALTER TABLE public.agents
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;

-- Create index on status for faster queries
CREATE INDEX IF NOT EXISTS idx_agents_status ON public.agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_user_id_status ON public.agents(user_id, status);
