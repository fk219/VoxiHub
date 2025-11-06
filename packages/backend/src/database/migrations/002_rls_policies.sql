-- AI Agent Creator Platform - Row Level Security Policies
-- This migration sets up RLS policies for secure data access control

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.widget_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sip_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Users table policies
-- Users can only see and update their own profile
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Agents table policies
-- Users can only manage their own agents
CREATE POLICY "Users can view own agents" ON public.agents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own agents" ON public.agents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own agents" ON public.agents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own agents" ON public.agents
  FOR DELETE USING (auth.uid() = user_id);

-- Knowledge base documents policies
-- Users can only manage knowledge base for their own agents
CREATE POLICY "Users can view own agent knowledge base documents" ON public.knowledge_base_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = knowledge_base_documents.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert knowledge base documents for own agents" ON public.knowledge_base_documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = knowledge_base_documents.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update knowledge base documents for own agents" ON public.knowledge_base_documents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = knowledge_base_documents.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete knowledge base documents for own agents" ON public.knowledge_base_documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = knowledge_base_documents.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

-- Knowledge base URLs policies
CREATE POLICY "Users can view own agent knowledge base URLs" ON public.knowledge_base_urls
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = knowledge_base_urls.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert knowledge base URLs for own agents" ON public.knowledge_base_urls
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = knowledge_base_urls.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update knowledge base URLs for own agents" ON public.knowledge_base_urls
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = knowledge_base_urls.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete knowledge base URLs for own agents" ON public.knowledge_base_urls
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = knowledge_base_urls.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

-- Knowledge base FAQs policies
CREATE POLICY "Users can view own agent knowledge base FAQs" ON public.knowledge_base_faqs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = knowledge_base_faqs.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert knowledge base FAQs for own agents" ON public.knowledge_base_faqs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = knowledge_base_faqs.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update knowledge base FAQs for own agents" ON public.knowledge_base_faqs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = knowledge_base_faqs.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete knowledge base FAQs for own agents" ON public.knowledge_base_faqs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = knowledge_base_faqs.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

-- Widget configurations policies
CREATE POLICY "Users can view own agent widget configs" ON public.widget_configs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = widget_configs.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert widget configs for own agents" ON public.widget_configs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = widget_configs.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update widget configs for own agents" ON public.widget_configs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = widget_configs.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete widget configs for own agents" ON public.widget_configs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = widget_configs.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

-- SIP configurations policies
CREATE POLICY "Users can view own agent SIP configs" ON public.sip_configs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = sip_configs.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert SIP configs for own agents" ON public.sip_configs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = sip_configs.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update SIP configs for own agents" ON public.sip_configs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = sip_configs.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete SIP configs for own agents" ON public.sip_configs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = sip_configs.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

-- Conversations policies
-- Users can view conversations for their own agents
-- Also allow viewing conversations where they are the user (for customer support scenarios)
CREATE POLICY "Users can view conversations for own agents or own conversations" ON public.conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = conversations.agent_id 
      AND agents.user_id = auth.uid()
    ) OR auth.uid() = conversations.user_id
  );

CREATE POLICY "System can insert conversations" ON public.conversations
  FOR INSERT WITH CHECK (true); -- Allow system to create conversations

CREATE POLICY "Users can update conversations for own agents" ON public.conversations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.agents 
      WHERE agents.id = conversations.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

-- Messages policies
-- Users can view messages for conversations they have access to
CREATE POLICY "Users can view messages for accessible conversations" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations 
      JOIN public.agents ON agents.id = conversations.agent_id
      WHERE conversations.id = messages.conversation_id 
      AND (agents.user_id = auth.uid() OR conversations.user_id = auth.uid())
    )
  );

CREATE POLICY "System can insert messages" ON public.messages
  FOR INSERT WITH CHECK (true); -- Allow system to create messages

-- Create a function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create user profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();