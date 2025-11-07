import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdAdd,
  MdSearch,
  MdMoreVert,
  MdEdit,
  MdDelete,
  MdRocketLaunch,
  MdSmartToy,
  MdContentCopy,
  MdPlayArrow,
  MdRefresh,
  MdCheckCircle,
  MdDrafts,
  MdSettings,
  MdBarChart
} from 'react-icons/md';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

interface Agent {
  id: string;
  name: string;
  description?: string;
  personality_tone?: string;
  language?: string;
  voice_id?: string;
  voice_model?: string;
  llm_model?: string;
  functions_enabled?: boolean;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
  published_at?: string;
}

const AgentList: React.FC = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [testingAgent, setTestingAgent] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const response = await apiClient.get('/api/agents');
      setAgents(response.data);
    } catch (error) {
      console.error('Failed to load agents:', error);
      toast.error('Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAgent = async (agentId: string, agentName: string) => {
    if (!confirm(`Are you sure you want to delete "${agentName}"?`)) return;

    try {
      await apiClient.delete(`/api/agents/${agentId}`);
      setAgents(agents.filter(a => a.id !== agentId));
      toast.success('Agent deleted successfully');
    } catch (error) {
      console.error('Failed to delete agent:', error);
      toast.error('Failed to delete agent');
    }
  };

  const handleDuplicateAgent = async (agentId: string) => {
    try {
      const response = await apiClient.post(`/api/agents/${agentId}/duplicate`);
      setAgents([response.data, ...agents]);
      toast.success('Agent duplicated successfully');
    } catch (error) {
      console.error('Failed to duplicate agent:', error);
      toast.error('Failed to duplicate agent');
    }
  };

  const handlePublishAgent = async (agentId: string) => {
    try {
      const response = await apiClient.post(`/api/agents/${agentId}/publish`);
      setAgents(agents.map(a => a.id === agentId ? response.data : a));
      toast.success('Agent published successfully');
    } catch (error: any) {
      console.error('Failed to publish agent:', error);
      toast.error(error.response?.data?.error || 'Failed to publish agent');
    }
  };

  const handleUnpublishAgent = async (agentId: string) => {
    try {
      const response = await apiClient.post(`/api/agents/${agentId}/unpublish`);
      setAgents(agents.map(a => a.id === agentId ? response.data : a));
      toast.success('Agent unpublished successfully');
    } catch (error) {
      console.error('Failed to unpublish agent:', error);
      toast.error('Failed to unpublish agent');
    }
  };

  const handleTestAgent = async (agentId: string) => {
    if (!testMessage.trim()) {
      toast.error('Please enter a test message');
      return;
    }

    setTestLoading(true);
    setTestResponse(null);

    try {
      const response = await apiClient.post(`/api/agents/${agentId}/test`, {
        message: testMessage
      });

      setTestResponse(response.data.response);
      toast.success('Test completed');
    } catch (error: any) {
      console.error('Failed to test agent:', error);
      toast.error(error.response?.data?.error || 'Failed to test agent');
    } finally {
      setTestLoading(false);
    }
  };

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div>
            <h2 className="card-title">AI Agents</h2>
            <p className="card-subtitle">Create and manage your voice AI agents</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={loadAgents} className="btn btn-secondary">
              <MdRefresh size={20} />
              <span>Refresh</span>
            </button>
            <button onClick={() => navigate('/agents/new')} className="btn btn-primary">
              <MdAdd size={20} />
              <span>Create Agent</span>
            </button>
          </div>
        </div>

        {/* Search and Stats */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
          <div style={{ position: 'relative', width: '300px' }}>
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

          <div style={{ display: 'flex', gap: '24px', fontSize: '14px', fontWeight: 300, color: '#64748b' }}>
            <div>
              <span style={{ fontWeight: 400, color: '#0f172a' }}>{filteredAgents.length}</span> Total
            </div>
            <div>
              <span style={{ fontWeight: 400, color: '#84cc16' }}>{agents.filter(a => a.status === 'published').length}</span> Published
            </div>
            <div>
              <span style={{ fontWeight: 400, color: '#64748b' }}>{agents.filter(a => a.status === 'draft').length}</span> Drafts
            </div>
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      {filteredAgents.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '64px 24px' }}>
          <MdSmartToy size={64} style={{ margin: '0 auto 24px', color: '#cbd5e1' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
            {searchQuery ? 'No agents found' : 'No agents yet'}
          </h3>
          <p style={{ fontSize: '14px', fontWeight: 300, color: '#64748b', marginBottom: '24px' }}>
            {searchQuery ? 'Try adjusting your search' : 'Create your first AI agent to get started'}
          </p>
          {!searchQuery && (
            <button onClick={() => navigate('/agents/new')} className="btn btn-primary">
              <MdAdd size={20} />
              <span>Create Agent</span>
            </button>
          )}
        </div>
      ) : (
        <div className="stats-grid">
          {filteredAgents.map(agent => (
            <div key={agent.id} className="card">
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                  <div style={{
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #a3e635 0%, #84cc16 100%)',
                    color: 'white',
                    flexShrink: 0
                  }}>
                    <MdSmartToy size={24} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 400, color: '#0f172a', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {agent.name}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {agent.status === 'published' ? (
                        <span style={{
                          fontSize: '12px',
                          fontWeight: 300,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: '#f0fdf4',
                          color: '#84cc16'
                        }}>
                          <MdCheckCircle size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                          Published
                        </span>
                      ) : (
                        <span style={{
                          fontSize: '12px',
                          fontWeight: 300,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: '#f1f5f9',
                          color: '#64748b'
                        }}>
                          <MdDrafts size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                          Draft
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Menu */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowMenu(showMenu === agent.id ? null : agent.id)}
                    style={{
                      padding: '6px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      background: 'white',
                      cursor: 'pointer',
                      color: '#64748b'
                    }}
                  >
                    <MdMoreVert size={20} />
                  </button>

                  {showMenu === agent.id && (
                    <>
                      <div
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 999
                        }}
                        onClick={() => setShowMenu(null)}
                      />
                      <div style={{
                        position: 'absolute',
                        right: 0,
                        top: '100%',
                        marginTop: '4px',
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        minWidth: '180px',
                        zIndex: 1000
                      }}>
                        <button
                          onClick={() => {
                            navigate(`/agents/${agent.id}`);
                            setShowMenu(null);
                          }}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: 'none',
                            background: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 300,
                            color: '#0f172a',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <MdEdit size={16} />
                          Edit
                        </button>

                        <button
                          onClick={() => {
                            setTestingAgent(agent.id);
                            setShowMenu(null);
                            setTestMessage('');
                            setTestResponse(null);
                          }}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: 'none',
                            background: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 300,
                            color: '#0f172a',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <MdPlayArrow size={16} />
                          Test Agent
                        </button>

                        <button
                          onClick={() => {
                            navigate(`/agents/${agent.id}/stats`);
                            setShowMenu(null);
                          }}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: 'none',
                            background: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 300,
                            color: '#0f172a',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <MdBarChart size={16} />
                          View Stats
                        </button>

                        {agent.status === 'draft' ? (
                          <button
                            onClick={() => {
                              handlePublishAgent(agent.id);
                              setShowMenu(null);
                            }}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: 'none',
                              background: 'none',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: 300,
                              color: '#84cc16',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                          >
                            <MdRocketLaunch size={16} />
                            Publish
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              handleUnpublishAgent(agent.id);
                              setShowMenu(null);
                            }}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: 'none',
                              background: 'none',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: 300,
                              color: '#64748b',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                          >
                            <MdDrafts size={16} />
                            Unpublish
                          </button>
                        )}

                        <button
                          onClick={() => {
                            handleDuplicateAgent(agent.id);
                            setShowMenu(null);
                          }}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: 'none',
                            background: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 300,
                            color: '#0f172a',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            borderTop: '1px solid #f1f5f9'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <MdContentCopy size={16} />
                          Duplicate
                        </button>

                        <button
                          onClick={() => {
                            handleDeleteAgent(agent.id, agent.name);
                            setShowMenu(null);
                          }}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: 'none',
                            background: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 300,
                            color: '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <MdDelete size={16} />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Description */}
              {agent.description && (
                <p style={{ fontSize: '13px', fontWeight: 300, color: '#64748b', marginBottom: '16px', lineHeight: '1.5' }}>
                  {agent.description}
                </p>
              )}

              {/* Configuration */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                {agent.language && (
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 300,
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: '#f1f5f9',
                    color: '#64748b'
                  }}>
                    {agent.language}
                  </span>
                )}
                {agent.voice_model && (
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 300,
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: '#f1f5f9',
                    color: '#64748b'
                  }}>
                    {agent.voice_model}
                  </span>
                )}
                {agent.llm_model && (
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 300,
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: '#f1f5f9',
                    color: '#64748b'
                  }}>
                    {agent.llm_model}
                  </span>
                )}
                {agent.functions_enabled && (
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 300,
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: '#f0fdf4',
                    color: '#84cc16'
                  }}>
                    Functions
                  </span>
                )}
              </div>

              {/* Footer */}
              <div style={{ paddingTop: '16px', borderTop: '1px solid #f1f5f9', fontSize: '12px', fontWeight: 300, color: '#64748b' }}>
                Created {formatDate(agent.created_at)}
                {agent.published_at && ` • Published ${formatDate(agent.published_at)}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Test Modal */}
      {testingAgent && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setTestingAgent(null)}>
          <div className="card" style={{ maxWidth: '600px', width: '90%', maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h3 className="card-title">Test Agent</h3>
            </div>

            <div style={{ marginTop: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 300, color: '#64748b', marginBottom: '8px' }}>
                Test Message
              </label>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Enter a message to test the agent..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 300,
                  resize: 'vertical'
                }}
              />

              {testResponse && (
                <div style={{
                  marginTop: '16px',
                  padding: '16px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                    Response:
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 300, color: '#64748b', lineHeight: '1.6' }}>
                    {testResponse}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button
                  onClick={() => setTestingAgent(null)}
                  className="btn btn-secondary"
                >
                  Close
                </button>
                <button
                  onClick={() => handleTestAgent(testingAgent)}
                  disabled={testLoading || !testMessage.trim()}
                  className="btn btn-primary"
                >
                  {testLoading ? 'Testing...' : 'Test'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentList;
