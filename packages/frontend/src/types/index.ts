// Core types for the Agent Builder Studio

export interface Agent {
  id: string
  name: string
  description: string
  personality: {
    tone: 'professional' | 'friendly' | 'casual' | 'formal'
    style: string
    instructions: string
  }
  knowledgeBase: {
    documents: Document[]
    urls: string[]
    faqs: FAQ[]
  }
  settings: {
    responseTime: number
    maxConversationLength: number
    escalationTriggers: string[]
  }
  deployments?: {
    widget?: WidgetConfig
    sip?: SipConfig
  }
  createdAt: string
  updatedAt: string
}

export interface Document {
  id: string
  name: string
  type: string
  url: string
  size: number
  uploadedAt: string
}

export interface FAQ {
  id: string
  question: string
  answer: string
}

export interface WidgetConfig {
  id?: string
  agentId: string
  theme: 'light' | 'dark' | 'custom'
  primaryColor: string
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  size: 'small' | 'medium' | 'large'
  autoOpen: boolean
  greeting: string
  placeholder: string
  voiceEnabled: boolean
  pushToTalk: boolean
  logoUrl?: string
  companyName: string
  showPoweredBy: boolean
  createdAt?: string
  updatedAt?: string
}

export interface SipConfig {
  id?: string
  agentId: string
  providerHost: string
  providerPort: number
  username: string
  password: string
  realm: string
  inboundNumbers: string[]
  outboundNumber?: string
  recordCalls: boolean
  maxCallDuration: number
  transferEnabled: boolean
  transferNumber?: string
  createdAt?: string
  updatedAt?: string
}

export interface User {
  id: string
  email: string
  name?: string
  createdAt: string
}

export interface AppState {
  user: User | null
  agents: Agent[]
  currentAgent: Agent | null
  loading: boolean
  error: string | null
}

// Admin dashboard types
export interface ConversationWithDetails {
  id: string
  agent_id: string
  user_id?: string
  channel: 'widget' | 'sip'
  phone_number?: string
  status: 'active' | 'ended' | 'transferred'
  context: Record<string, any>
  metadata: Record<string, any>
  started_at: string
  ended_at?: string
  created_at: string
  updated_at: string
  agent?: {
    id: string
    name: string
  }
  messages?: Array<{
    id: string
    role: 'user' | 'agent'
    content: string
    type: 'text' | 'audio'
    created_at: string
  }>
}

export interface ConversationStats {
  totalConversations: number
  activeConversations: number
  totalMessages: number
  averageDuration: number
  channelBreakdown: Record<string, number>
  statusBreakdown: Record<string, number>
  dailyStats: Array<{
    date: string
    conversations: number
    messages: number
  }>
}

export interface OverviewAnalytics {
  totalAgents: number
  totalConversations: number
  activeConversations: number
  totalMessages: number
  averageResponseTime: number
  topPerformingAgents: Array<{
    agentId: string
    agentName: string
    conversationCount: number
    averageDuration: number
  }>
}

export interface PerformanceAnalytics {
  conversationSuccessRate: number
  averageConversationDuration: number
  averageMessagesPerConversation: number
  transferRate: number
  responseTimeMetrics: {
    average: number
    median: number
    p95: number
  }
  satisfactionScore: number
  hourlyDistribution: Array<{
    hour: number
    conversations: number
  }>
}