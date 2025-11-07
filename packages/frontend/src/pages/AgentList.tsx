import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  MdAdd, 
  MdSearch, 
  MdMoreVert,
  MdEdit,
  MdDelete,
  MdRocketLaunch,
  MdSmartToy
} from 'react-icons/md'
import { apiClient } from '@/lib/api'
import { Agent } from '@/types'
import toast from 'react-hot-toast'

const AgentList: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showMenu, setShowMenu] = useState<string | null>(null)

  useEffect(() => {
    loadAgents()
  }, [])

  const loadAgents = async () => {
    try {
      const data = await apiClient.getAgents()
      setAgents(data)
    } catch (error) {
      console.error('Failed to load agents:', error)
      toast.error('Failed to load agents')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) return
    
    try {
      await apiClient.deleteAgent(agentId)
      setAgents(agents.filter(a => a.id !== agentId))
      toast.success('Agent deleted successfully')
    } catch (error) {
      console.error('Failed to delete agent:', error)
      toast.error('Failed to delete agent')
    }
  }

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div>
            <h2 className="card-title">AI Agents</h2>
            <p className="card-subtitle">Manage your intelligent AI assistants</p>
          </div>
          <Link to="/agents/new" className="btn btn-primary">
            <MdAdd size={20} />
            <span>Create Agent</span>
          </Link>
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <MdSearch 
            size={20} 
            style={{ 
              position: 'absolute', 
              left: '16px', 
              top: '50%', 
              transform: 'translateY(-50%)',
              color: '#64748b'
            }} 
          />
          <input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px 12px 48px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 300
            }}
          />
        </div>
      </div>

      {/* Agents Grid */}
      {filteredAgents.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">
              <MdSmartToy size={48} />
            </div>
            <div className="empty-title">
              {searchQuery ? 'No agents found' : 'No agents yet'}
            </div>
            <div className="empty-description">
              {searchQuery 
                ? 'Try adjusting your search query'
                : 'Create your first AI agent to get started'
              }
            </div>
            {!searchQuery && (
              <Link to="/agents/new" className="btn btn-primary" style={{ marginTop: '16px' }}>
                <MdAdd size={20} />
                <span>Create Your First Agent</span>
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="stats-grid">
          {filteredAgents.map((agent) => (
            <div key={agent.id} className="card" style={{ position: 'relative' }}>
              {/* Agent Card Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  background: 'linear-gradient(135deg, #a3e635 0%, #84cc16 100%)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white'
                }}>
                  <MdSmartToy size={24} />
                </div>
                
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowMenu(showMenu === agent.id ? null : agent.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      color: '#64748b'
                    }}
                  >
                    <MdMoreVert size={20} />
                  </button>
                  
                  {showMenu === agent.id && (
                    <div style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      minWidth: '160px',
                      zIndex: 10
                    }}>
                      <Link
                        to={`/agents/${agent.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '12px 16px',
                          color: '#0f172a',
                          textDecoration: 'none',
                          fontSize: '14px',
                          fontWeight: 300
                        }}
                      >
                        <MdEdit size={16} />
                        <span>Edit</span>
                      </Link>
                      <Link
                        to={`/agents/${agent.id}/deploy`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '12px 16px',
                          color: '#0f172a',
                          textDecoration: 'none',
                          fontSize: '14px',
                          fontWeight: 300,
                          borderTop: '1px solid #f1f5f9'
                        }}
                      >
                        <MdRocketLaunch size={16} />
                        <span>Deploy</span>
                      </Link>
                      <button
                        onClick={() => handleDeleteAgent(agent.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '12px 16px',
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          borderTop: '1px solid #f1f5f9',
                          color: '#ef4444',
                          fontSize: '14px',
                          fontWeight: 300,
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <MdDelete size={16} />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Agent Info */}
              <h3 style={{ fontSize: '16px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                {agent.name}
              </h3>
              <p style={{ fontSize: '13px', fontWeight: 300, color: '#64748b', marginBottom: '16px', lineHeight: '1.5' }}>
                {agent.description || 'No description provided'}
              </p>

              {/* Agent Stats */}
              <div style={{ 
                display: 'flex', 
                gap: '16px', 
                paddingTop: '16px', 
                borderTop: '1px solid #f1f5f9' 
              }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 300, color: '#64748b', marginBottom: '4px' }}>
                    Tone
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    fontWeight: 400, 
                    color: '#0f172a',
                    textTransform: 'capitalize'
                  }}>
                    {agent.personality_tone || 'Professional'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 300, color: '#64748b', marginBottom: '4px' }}>
                    Created
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 400, color: '#0f172a' }}>
                    {new Date(agent.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AgentList
