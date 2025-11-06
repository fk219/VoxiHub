import { Agent, WidgetConfig, SipConfig } from '@/types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    }

    const response = await fetch(url, config)

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // Agent endpoints
  async getAgents(): Promise<Agent[]> {
    return this.request<Agent[]>('/agents')
  }

  async getAgent(id: string): Promise<Agent> {
    return this.request<Agent>(`/agents/${id}`)
  }

  async createAgent(agent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>): Promise<Agent> {
    return this.request<Agent>('/agents', {
      method: 'POST',
      body: JSON.stringify(agent),
    })
  }

  async updateAgent(id: string, agent: Partial<Agent>): Promise<Agent> {
    return this.request<Agent>(`/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(agent),
    })
  }

  async deleteAgent(id: string): Promise<void> {
    return this.request<void>(`/agents/${id}`, {
      method: 'DELETE',
    })
  }

  // Widget configuration endpoints
  async updateWidgetConfig(agentId: string, config: Partial<WidgetConfig>): Promise<WidgetConfig> {
    return this.request<WidgetConfig>(`/agents/${agentId}/widget-config`, {
      method: 'POST',
      body: JSON.stringify(config),
    })
  }

  // SIP configuration endpoints
  async updateSipConfig(agentId: string, config: Partial<SipConfig>): Promise<SipConfig> {
    return this.request<SipConfig>(`/agents/${agentId}/sip-config`, {
      method: 'POST',
      body: JSON.stringify(config),
    })
  }

  // Deployment status endpoints
  async getDeploymentStatus(agentId: string): Promise<{
    widget: { status: 'active' | 'inactive' | 'error', lastDeployed?: string }
    sip: { status: 'active' | 'inactive' | 'error', lastDeployed?: string }
  }> {
    return this.request(`/agents/${agentId}/deployment-status`)
  }

  // Generate deployment code
  async generateWidgetCode(agentId: string): Promise<{ embedCode: string, scriptUrl: string }> {
    return this.request(`/agents/${agentId}/widget-code`)
  }

  // Admin endpoints for conversation monitoring
  async getConversations(filters: {
    agentId?: string
    channel?: string
    status?: string
    search?: string
    startDate?: string
    endDate?: string
    limit?: number
    offset?: number
  } = {}): Promise<any[]> {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key === 'agentId' ? 'agent_id' : 
                     key === 'startDate' ? 'start_date' :
                     key === 'endDate' ? 'end_date' : key, 
                     value.toString())
      }
    })
    
    return this.request<any[]>(`/admin/conversations?${params.toString()}`)
  }

  async getConversationStats(filters: {
    agentId?: string
    startDate?: string
    endDate?: string
  } = {}): Promise<any> {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key === 'agentId' ? 'agent_id' : 
                     key === 'startDate' ? 'start_date' :
                     key === 'endDate' ? 'end_date' : key, 
                     value.toString())
      }
    })
    
    return this.request(`/admin/conversations/stats?${params.toString()}`)
  }

  async getConversationTranscript(conversationId: string, format: 'json' | 'txt' | 'csv' = 'json'): Promise<any> {
    return this.request(`/admin/conversations/${conversationId}/transcript?format=${format}`)
  }

  async downloadConversationTranscript(conversationId: string, format: 'txt' | 'csv'): Promise<void> {
    const url = `${this.baseUrl}/admin/conversations/${conversationId}/transcript?format=${format}`
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to download transcript: ${response.status} ${response.statusText}`)
    }

    const blob = await response.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = `conversation-${conversationId}.${format}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)
  }

  async getOverviewAnalytics(filters: {
    startDate?: string
    endDate?: string
  } = {}): Promise<any> {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key === 'startDate' ? 'start_date' :
                     key === 'endDate' ? 'end_date' : key, 
                     value.toString())
      }
    })
    
    return this.request(`/admin/analytics/overview?${params.toString()}`)
  }

  async getPerformanceAnalytics(filters: {
    agentId?: string
    startDate?: string
    endDate?: string
  } = {}): Promise<any> {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key === 'agentId' ? 'agent_id' : 
                     key === 'startDate' ? 'start_date' :
                     key === 'endDate' ? 'end_date' : key, 
                     value.toString())
      }
    })
    
    return this.request(`/admin/analytics/performance?${params.toString()}`)
  }

  async getLiveConversations(): Promise<any[]> {
    return this.request<any[]>('/admin/conversations/live')
  }
}

export const apiClient = new ApiClient(API_BASE_URL)