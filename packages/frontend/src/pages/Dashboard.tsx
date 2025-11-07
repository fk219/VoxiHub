import React from 'react'
import { Link } from 'react-router-dom'

const Dashboard: React.FC = () => {
  return (
    <div>
      {/* Hero Section */}
      <div className="hero">
        <div className="hero-content">
          <div className="hero-subtitle">✨ Welcome to VoxiHub</div>
          <h1 className="hero-title">AI Agent Platform</h1>
          <p className="hero-description">
            Create, deploy, and manage intelligent AI agents for conversations across multiple channels.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-info">
              <div className="stat-label">Total Agents</div>
              <div className="stat-value">0</div>
              <div className="stat-change">Get started by creating your first agent</div>
            </div>
            <div className="stat-icon">🤖</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-info">
              <div className="stat-label">Chat Sessions</div>
              <div className="stat-value">0</div>
              <div className="stat-change">No conversations yet</div>
            </div>
            <div className="stat-icon">💬</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-info">
              <div className="stat-label">Phone Calls</div>
              <div className="stat-value">0</div>
              <div className="stat-change">Configure SIP to enable calls</div>
            </div>
            <div className="stat-icon">📞</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-info">
              <div className="stat-label">Success Rate</div>
              <div className="stat-value">--</div>
              <div className="stat-change">Start conversations to track</div>
            </div>
            <div className="stat-icon">📈</div>
          </div>
        </div>
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
            <div className="action-icon">➕</div>
            <div className="action-content">
              <div className="action-title">Create Your First Agent</div>
              <div className="action-description">Build an AI assistant in minutes</div>
            </div>
          </Link>

          <Link to="/agents" className="action-card">
            <div className="action-icon">🤖</div>
            <div className="action-content">
              <div className="action-title">View All Agents</div>
              <div className="action-description">Manage your AI agents</div>
            </div>
          </Link>

          <Link to="/conversations" className="action-card">
            <div className="action-icon">👁️</div>
            <div className="action-content">
              <div className="action-title">Monitor Conversations</div>
              <div className="action-description">Track live interactions</div>
            </div>
          </Link>

          <Link to="/analytics" className="action-card">
            <div className="action-icon">📊</div>
            <div className="action-content">
              <div className="action-title">View Analytics</div>
              <div className="action-description">Performance insights</div>
            </div>
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
          <div className="action-card" style={{ cursor: 'default' }}>
            <div className="action-icon">1️⃣</div>
            <div className="action-content">
              <div className="action-title">Create an Agent</div>
              <div className="action-description">Configure personality, knowledge base, and behavior</div>
            </div>
          </div>

          <div className="action-card" style={{ cursor: 'default' }}>
            <div className="action-icon">2️⃣</div>
            <div className="action-content">
              <div className="action-title">Deploy Channels</div>
              <div className="action-description">Add widget to website or configure phone integration</div>
            </div>
          </div>

          <div className="action-card" style={{ cursor: 'default' }}>
            <div className="action-icon">3️⃣</div>
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
          <div className="empty-icon">📋</div>
          <div className="empty-title">No recent activity</div>
          <div className="empty-description">Activity will appear here once you start using the platform</div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
