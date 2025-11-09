// Database type definitions based on the schema

export type ConversationStatus = 'active' | 'ended' | 'transferred';
export type MessageRole = 'user' | 'agent';
export type MessageType = 'text' | 'audio';
export type ChannelType = 'widget' | 'sip';
export type PersonalityTone = 'professional' | 'friendly' | 'casual' | 'formal';

export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  personality_tone: PersonalityTone;
  personality_style?: string;
  personality_instructions?: string;
  response_time: number;
  max_conversation_length: number;
  escalation_triggers: string[];
  knowledge_base_ids?: string[];
  
  // LLM Configuration
  llm_provider?: string;
  llm_model?: string;
  llm_temperature?: number;
  llm_max_tokens?: number;
  
  // TTS Configuration
  tts_provider?: string;
  tts_voice?: string;
  tts_speed?: number;
  
  // STT Configuration
  stt_provider?: string;
  stt_language?: string;
  
  // Advanced Features
  functions_enabled?: boolean;
  interruption_sensitivity?: number;
  max_call_duration?: number;
  webhook_url?: string;
  
  // Status
  status?: string;
  published_at?: string;
  
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseDocument {
  id: string;
  agent_id: string;
  title: string;
  content: string;
  file_url?: string;
  file_type?: string;
  file_size?: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseUrl {
  id: string;
  agent_id: string;
  url: string;
  title?: string;
  content?: string;
  last_crawled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseFaq {
  id: string;
  agent_id: string;
  question: string;
  answer: string;
  created_at: string;
  updated_at: string;
}

export interface WidgetConfig {
  id: string;
  agent_id: string;
  theme: string;
  primary_color: string;
  position: string;
  size: string;
  auto_open: boolean;
  greeting: string;
  placeholder: string;
  voice_enabled: boolean;
  push_to_talk: boolean;
  logo_url?: string;
  company_name?: string;
  show_powered_by: boolean;
  created_at: string;
  updated_at: string;
}

export interface SipConfig {
  id: string;
  agent_id: string;
  provider_host: string;
  provider_port: number;
  username: string;
  password_encrypted: string;
  realm: string;
  inbound_numbers: string[];
  outbound_number?: string;
  record_calls: boolean;
  max_call_duration: number;
  transfer_enabled: boolean;
  transfer_number?: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  agent_id: string;
  user_id?: string;
  channel: ChannelType;
  phone_number?: string;
  status: ConversationStatus;
  context: Record<string, any>;
  metadata: Record<string, any>;
  started_at: string;
  ended_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  type: MessageType;
  audio_url?: string;
  transcription?: string;
  metadata: Record<string, any>;
  created_at: string;
}

// Request/Response types for API
export interface CreateAgentRequest {
  name: string;
  description?: string;
  personality_tone?: PersonalityTone;
  personality_style?: string;
  personality_instructions?: string;
  response_time?: number;
  max_conversation_length?: number;
  escalation_triggers?: string[];
  knowledge_base_ids?: string[];
  
  // LLM Configuration
  llm_provider?: string;
  llm_model?: string;
  llm_temperature?: number;
  llm_max_tokens?: number;
  
  // TTS Configuration
  tts_provider?: string;
  tts_voice?: string;
  tts_speed?: number;
  
  // STT Configuration
  stt_provider?: string;
  stt_language?: string;
  
  // Advanced Features
  functions_enabled?: boolean;
  interruption_sensitivity?: number;
  max_call_duration?: number;
  webhook_url?: string;
  
  // Status
  status?: string;
  published_at?: string | null;
}

export interface UpdateAgentRequest extends Partial<CreateAgentRequest> {}

export interface CreateConversationRequest {
  agent_id: string;
  channel: ChannelType;
  phone_number?: string;
  metadata?: Record<string, any>;
}

export interface CreateMessageRequest {
  conversation_id: string;
  role: MessageRole;
  content: string;
  type?: MessageType;
  audio_url?: string;
  transcription?: string;
  metadata?: Record<string, any>;
}

export interface CreateKnowledgeBaseDocumentRequest {
  agent_id: string;
  title: string;
  content: string;
  file_url?: string;
  file_type?: string;
  file_size?: number;
}

export interface CreateWidgetConfigRequest {
  agent_id: string;
  theme?: string;
  primary_color?: string;
  position?: string;
  size?: string;
  auto_open?: boolean;
  greeting?: string;
  placeholder?: string;
  voice_enabled?: boolean;
  push_to_talk?: boolean;
  logo_url?: string;
  company_name?: string;
  show_powered_by?: boolean;
}

export interface CreateSipConfigRequest {
  agent_id: string;
  provider_host: string;
  provider_port?: number;
  username: string;
  password: string; // Will be encrypted before storage
  realm: string;
  inbound_numbers?: string[];
  outbound_number?: string;
  record_calls?: boolean;
  max_call_duration?: number;
  transfer_enabled?: boolean;
  transfer_number?: string;
}

// Database query result types
export interface AgentWithConfig extends Agent {
  widget_config?: WidgetConfig;
  sip_config?: SipConfig;
  knowledge_base_documents?: KnowledgeBaseDocument[];
  knowledge_base_urls?: KnowledgeBaseUrl[];
  knowledge_base_faqs?: KnowledgeBaseFaq[];
}

export interface ConversationWithMessages extends Conversation {
  messages?: Message[];
  agent?: Agent;
}