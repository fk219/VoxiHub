import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdRocketLaunch,
  MdCloud,
  MdPhone,
  MdWeb,
  MdCode,
  MdSettings,
  MdDelete,
  MdContentCopy,
  MdVisibility,
  MdVisibilityOff,
  MdCheckCircle,
  MdError,
  MdPending,
  MdRefresh,
  MdAdd,
} from 'react-icons/md';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

interface Deployment {
  id: string;
  agent_id: string;
  agent_name: string;
  type: 'api' | 'widget' | 'phone' | 'whatsapp';
  status: 'active' | 'inactive' | 'error';
  endpoint?: string;
  phone_number?: string;
  api_key?: string;
  created_at: string;
  last_used?: string;
  total_calls?: number;
}

const Deployments: React.FC = () => {
  const navigate = useNavigate();
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');

  useEffect(() => {
    loadDeployments();
  }, []);

  const loadDeployments = async () => {
    try {
      // Mock data for now - replace with actual API call
      const mockDeployments: Deployment[] = [
        {
          id: '1',
          agent_id: 'agent-1',
          agent_name: 'Customer Support Agent',
          type: 'api',
          status: 'active',
          endpoint: 'https://api.voxihub.com/v1/agents/agent-1',
          api_key: 'vxh_sk_1234567890abcdef',
          created_at: new Date().toISOString(),
          total_calls: 1250,
        },
        {
          id: '2',
          agent_id: 'agent-2',
          agent_name: 'Sales Assistant',
          type: 'widget',
          status: 'active',
          endpoint: 'https://widget.voxihub.com/agent-2',
          created_at: new Date().toISOString(),
          total_calls: 850,
        },
        {
          id: '3',
          agent_id: 'agent-3',
          agent_name: 'Phone Support',
          type: 'phone',
          status: 'active',
          phone_number: '+1 (555) 123-4567',
          created_at: new Date().toISOString(),
          total_calls: 420,
        },
      ];
      setDeployments(mockDeployments);
    } catch (error) {
      console.error('Failed to load deployments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'api':
        return <MdCode size={20} />;
      case 'widget':
        return <MdWeb size={20} />;
      case 'phone':
        return <MdPhone size={20} />;
      case 'whatsapp':
        return <MdCloud size={20} />;
      default:
        return <MdRocketLaunch size={20} />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'api':
        return 'REST API';
      case 'widget':
        return 'Web Widget';
      case 'phone':
        return 'Phone Number';
      case 'whatsapp':
        return 'WhatsApp';
      default:
        return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#84cc16';
      case 'inactive':
        return '#94a3b8';
      case 'error':
        return '#ef4444';
      default:
        return '#64748b';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <MdCheckCircle size={16} />;
      case 'inactive':
        return <MdPending size={16} />;
      case 'error':
        return <MdError size={16} />;
      default:
        return <MdPending size={16} />;
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the deployment for "${name}"?`)) return;

    try {
      // await apiClient.delete(`/api/deployments/${id}`);
      setDeployments(deployments.filter(d => d.id !== id));
      toast.success('Deployment deleted successfully');
    } catch (error) {
      console.error('Failed to delete deployment:', error);
      toast.error('Failed to delete deployment');
    }
  };

  const filteredDeployments = selectedType === 'all' 
    ? deployments 
    : deployments.filter(d => d.type === selectedType);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 500, color: '#0f172a', marginBottom: '8px' }}>
          Deployments
        </h1>
        <p style={{ fontSize: '15px', color: '#64748b' }}>
          Manage and monitor your agent deployments across different channels
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ padding: '8px', background: '#f0fdf4', borderRadius: '8px', color: '#84cc16' }}>
              <MdCheckCircle size={24} />
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 500, color: '#0f172a' }}>
                {deployments.filter(d => d.status === 'active').length}
              </div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>Active</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ padding: '8px', background: '#eff6ff', borderRadius: '8px', color: '#3b82f6' }}>
              <MdRocketLaunch size={24} />
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 500, color: '#0f172a' }}>
                {deployments.length}
              </div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>Total Deployments</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ padding: '8px', background: '#fef3c7', borderRadius: '8px', color: '#f59e0b' }}>
              <MdPhone size={24} />
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 500, color: '#0f172a' }}>
                {deployments.reduce((sum, d) => sum + (d.total_calls || 0), 0).toLocaleString()}
              </div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>Total Calls</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['all', 'api', 'widget', 'phone', 'whatsapp'].map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '8px',
                background: selectedType === type ? '#84cc16' : '#f8fafc',
                color: selectedType === type ? 'white' : '#64748b',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 400,
                textTransform: 'capitalize'
              }}
            >
              {type === 'all' ? 'All' : getTypeLabel(type)}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={loadDeployments}
            style={{
              padding: '10px 16px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              background: 'white',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px'
            }}
          >
            <MdRefresh size={18} />
            Refresh
          </button>
          <button
            onClick={() => navigate('/agents')}
            className="btn btn-primary"
          >
            <MdAdd size={18} />
            New Deployment
          </button>
        </div>
      </div>

      {/* Deployments List */}
      {filteredDeployments.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <MdRocketLaunch size={48} color="#cbd5e1" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 500, color: '#0f172a', marginBottom: '8px' }}>
            No deployments yet
          </h3>
          <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>
            Deploy your agents to start receiving calls and messages
          </p>
          <button
            onClick={() => navigate('/agents')}
            className="btn btn-primary"
          >
            <MdRocketLaunch size={18} />
            Deploy Your First Agent
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {filteredDeployments.map(deployment => (
            <div key={deployment.id} className="card">
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'start', flex: 1 }}>
                    <div style={{
                      padding: '12px',
                      background: '#f8fafc',
                      borderRadius: '12px',
                      color: '#64748b'
                    }}>
                      {getTypeIcon(deployment.type)}
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 500, color: '#0f172a' }}>
                          {deployment.agent_name}
                        </h3>
                        <span style={{
                          padding: '4px 12px',
                          background: '#f8fafc',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: '#64748b',
                          fontWeight: 400
                        }}>
                          {getTypeLabel(deployment.type)}
                        </span>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 12px',
                          background: deployment.status === 'active' ? '#f0fdf4' : '#f8fafc',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: getStatusColor(deployment.status),
                          fontWeight: 400
                        }}>
                          {getStatusIcon(deployment.status)}
                          {deployment.status}
                        </div>
                      </div>

                      {/* Deployment Details */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px' }}>
                        {deployment.endpoint && (
                          <div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>
                              Endpoint
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <code style={{
                                fontSize: '13px',
                                color: '#0f172a',
                                background: '#f8fafc',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                flex: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {deployment.endpoint}
                              </code>
                              <button
                                onClick={() => copyToClipboard(deployment.endpoint!, 'Endpoint')}
                                style={{
                                  padding: '6px',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '6px',
                                  background: 'white',
                                  cursor: 'pointer',
                                  color: '#64748b'
                                }}
                              >
                                <MdContentCopy size={16} />
                              </button>
                            </div>
                          </div>
                        )}

                        {deployment.phone_number && (
                          <div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>
                              Phone Number
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <code style={{
                                fontSize: '13px',
                                color: '#0f172a',
                                background: '#f8fafc',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                flex: 1
                              }}>
                                {deployment.phone_number}
                              </code>
                              <button
                                onClick={() => copyToClipboard(deployment.phone_number!, 'Phone number')}
                                style={{
                                  padding: '6px',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '6px',
                                  background: 'white',
                                  cursor: 'pointer',
                                  color: '#64748b'
                                }}
                              >
                                <MdContentCopy size={16} />
                              </button>
                            </div>
                          </div>
                        )}

                        {deployment.api_key && (
                          <div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>
                              API Key
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <code style={{
                                fontSize: '13px',
                                color: '#0f172a',
                                background: '#f8fafc',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                flex: 1
                              }}>
                                {showApiKey === deployment.id ? deployment.api_key : '••••••••••••••••'}
                              </code>
                              <button
                                onClick={() => setShowApiKey(showApiKey === deployment.id ? null : deployment.id)}
                                style={{
                                  padding: '6px',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '6px',
                                  background: 'white',
                                  cursor: 'pointer',
                                  color: '#64748b'
                                }}
                              >
                                {showApiKey === deployment.id ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
                              </button>
                              <button
                                onClick={() => copyToClipboard(deployment.api_key!, 'API key')}
                                style={{
                                  padding: '6px',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '6px',
                                  background: 'white',
                                  cursor: 'pointer',
                                  color: '#64748b'
                                }}
                              >
                                <MdContentCopy size={16} />
                              </button>
                            </div>
                          </div>
                        )}

                        <div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>
                            Total Calls
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: 500, color: '#0f172a' }}>
                            {deployment.total_calls?.toLocaleString() || 0}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => navigate(`/agents/${deployment.agent_id}/deploy`)}
                      style={{
                        padding: '8px 16px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        background: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '14px',
                        color: '#64748b'
                      }}
                    >
                      <MdSettings size={16} />
                      Configure
                    </button>
                    <button
                      onClick={() => handleDelete(deployment.id, deployment.agent_name)}
                      style={{
                        padding: '8px 16px',
                        border: '1px solid #fee2e2',
                        borderRadius: '8px',
                        background: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '14px',
                        color: '#ef4444'
                      }}
                    >
                      <MdDelete size={16} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Deployments;
