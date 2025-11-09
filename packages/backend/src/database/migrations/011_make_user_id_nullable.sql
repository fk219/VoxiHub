-- Make user_id nullable in agents table for MVP
-- This allows creating agents without authentication

ALTER TABLE public.agents 
ALTER COLUMN user_id DROP NOT NULL;

-- Add index for better performance when user_id is used
CREATE INDEX IF NOT EXISTS idx_agents_user_id_null ON public.agents(user_id) WHERE user_id IS NOT NULL;
