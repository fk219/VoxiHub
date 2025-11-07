import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  MdSmartToy, 
  MdChat, 
  MdPhone, 
  MdTrendingUp,
  MdAdd,
  MdArrowForward,
  MdVisibility
} from 'react-icons/md'
import { HiSparkles } from 'react-icons/hi2'
import { apiClient } from '@/lib/api'

interface DashboardStats {
  totalAgents: number
  totalConversations: number
  totalCalls: number
  successRate: number
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalAgents: 0,
    totalConversations: 0,
    totalCalls: 0,
    successRate: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardStats()
  }, [])

  const loadDashboardStats = async () => {
    try {
      // Try to load actual stats from API
      const agents = await apiClient.getAgents()
      setStats(prev => ({ ...prev, totalAgents: agents.length }))
      
      // You can add more API calls here for other stats
      // const conversations = await apiClient.getConversations({})
      // setStats(prev => ({ ...prev, totalConversations: conversations.length }))
    } catch (error) {
      console.error('Failed to load dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      label: 'Total Agents',
      value: stats.totalAgents,
      change: stats.totalAgents > 0 ? '+12%' : 'Get started',
      icon: MdSmartToy,
      color: '#84cc16'
    },
    {
      label: 'Chat Sessions',
      value: stats.totalConversations,
      change: stats.totalConversations > 0 ? '+23%' : 'No conversations yet',
      icon: MdChat,
      color: '#10b981'
    },
    {
      label: 'Phone Calls',
      value: stats.totalCalls,
      change: stats.totalCalls > 0 ? '+18%' : 'Configure SIP',
      icon: MdPhone,
      color: '#06b6d4'
    },
    {
      label: 'Success Rate',
      value: stats.successRate > 0 ? `${stats.successRate}%` : '--',
      change: stats.successRate > 0 ? '+5%' : 'Start tracking',
      icon: MdTrendingUp,
      color: '#8b5cf6'
    }
  ]

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Hero Section */}
      <div className="hero">
        <div className="hero-content">
          <div className="hero-subtitle">
            <HiSparkles style={{ display: 'inline', marginRight: '8px' }} />
            Welcome to VoxiHub
          </div>
          <h1 className="hero-title">AI Agent Platform</h1>
          <p className="hero-description">
            Create, deploy, and manage intelligent AI agents for conversations across multiple channels.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="stat-card">
              <div className="stat-header">
                <div className="stat-info">
                  <div className="stat-label">{stat.label}</div>
                  <div className="stat-value">{stat.value}</div>
                  <div className="stat-change">{stat.change}</div>
                </div>
                <div className="stat-icon" style={{ background: `linear-gradient(135deg, ${stat.color}dd 0%, ${stat.color} 100%)` }}>
                  <Icon size={24} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Quick Actions</h3>
            <p className="card-subtitle">Get started with these common tasks</p>
          </div>
        </div>

        <div className="action-grid">
          <Link to="/agents/new" className="action-card">
            <div className="action-icon">
              <MdAdd size={24} />
            </div>
            <div className="action-content">
              <div className="action-title">Create Your First Agent</div>
              <div className="action-description">Build an AI assistant in minutes</div>
            </div>
            <MdArrowForward size={20} style={{ color: '#84cc16' }} />
          </Link>

          <Link to="/agents" className="action-card">
            <div className="action-icon">
              <MdSmartToy size={24} />
            </div>
            <div className="action-content">
              <div className="action-title">View All Agents</div>
              <div className="action-description">Manage your AI agents</div>
            </div>
            <MdArrowForward size={20} style={{ color: '#84cc16' }} />
          </Link>

          <Link to="/conversations" className="action-card">
            <div className="action-icon">
              <MdVisibility size={24} />
            </div>
            <div className="action-content">
              <div className="action-title">Monitor Conversations</div>
              <div className="action-description">Track live interactions</div>
            </div>
            <MdArrowForward size={20} style={{ color: '#84cc16' }} />
          </Link>

          <Link to="/analytics" className="action-card">
            <div className="action-icon">
              <MdTrendingUp size={24} />
            </div>
            <div className="action-content">
              <div className="action-title">View Analytics</div>
              <div className="action-description">Performance insights</div>
            </div>
            <MdArrowForward size={20} style={{ color: '#84cc16' }} />
          </Link>
        </div>
      </div>

      {/* Getting Started */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Getting Started</h3>
            <p className="card-subtitle">Follow these steps to launch your first AI agent</p>
          </div>
        </div>

        <div className="action-grid">
          <div className="action-card" style={{ cursor: 'default', border: '2px dashed #e2e8f0' }}>
            <div className="action-icon" style={{ background: 'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)', color: 'white' }}>
              <span style={{ fontSize: '18px', fontWeight: 500 }}>1</span>
            </div>
            <div className="action-content">
              <div className="action-title">Create an Agent</div>
              <div className="action-description">Configure personality, knowledge base, and behavior</div>
            </div>
          </div>

          <div className="action-card" style={{ cursor: 'default', border: '2px dashed #e2e8f0' }}>
            <div className="action-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white' }}>
              <span style={{ fontSize: '18px', fontWeight: 500 }}>2</span>
            </div>
            <div className="action-content">
              <div className="action-title">Deploy Channels</div>
              <div className="action-description">Add widget to website or configure phone integration</div>
            </div>
          </div>

          <div className="action-card" style={{ cursor: 'default', border: '2px dashed #e2e8f0' }}>
            <div className="action-icon" style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', color: 'white' }}>
              <span style={{ fontSize: '18px', fontWeight: 500 }}>3</span>
            </div>
            <div className="action-content">
              <div className="action-title">Monitor & Optimize</div>
              <div className="action-description">Track conversations and improve performance</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Recent Activity</h3>
            <p className="card-subtitle">Your latest platform activity</p>
          </div>
        </div>

        <div className="empty-state">
          <div className="empty-icon">
            <MdChat size={32} />
          </div>
          <div className="empty-title">No recent activity</div>
          <div className="empty-description">Activity will appear here once you start using the platform</div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
