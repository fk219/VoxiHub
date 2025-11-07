import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MdArrowBack,
  MdPhone,
  MdChat,
  MdMic,
  MdContentCopy,
  MdCheck,
  MdDelete,
  MdAdd,
  MdPublic,
  MdSettings
} from 'react-icons/md';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

interface Agent {
  id: string;
  name: string;
  description: string;
  status: string;
}

interface Deployment {
  id: string;
  agent_id: string;
  type: 'twilio' | 'chat_widget' | 'voice_widget';
  status: 'active' | 'inactive' | 'error';
  config: any;
  webhook_url?: string;
  embed_code?: string;
  phone_number?: string;
  created_at: string;
  updated_at: string;
}

export default function AgentDeployment() {
  const { agentId } = useParams();
  const navigate = useNavigate();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deploymentType, setDeploymentType] = useState<'twilio' | 'chat_widget' | 'voice_widget'>('chat_widget');
  const [creating, setCreating] = useState(false);

  // Twilio Config
  const [twilioConfig, setTwilioConfig] = useState({
    phoneNumber: '',
    recordCalls: true,
    transcribeVoicemail: false,
  });

  // Chat Widget Config
  const [chatConfig, setChatConfig] = useState({
    websiteUrl: '',
    widgetPosition: 'bottom-right' as const,
    primaryColor: '#3B82F6',
    welcomeMessage: 'Hi! How can I help you today?',
    placeholder: 'Type your message...',
    showAvatar: true,
    allowFileUpload: false,
  });

  // Voice Widget Config
  const [voiceConfig, setVoiceConfig] = useState({
    websiteUrl: '',
    buttonText: 'Talk to us',
    buttonPosition: 'bottom-right' as const,
    primaryColor: '#3B82F6',
    allowMute: true,
    showDuration: true,
    maxCallDuration: 1800,
  });

  useEffect(() => {
    fetchAgent();
    fetchDeployments();
  }, [agentId]);

  const fetchAgent = async () => {
    try {
      const response = await apiClient.get(`/agents/${agentId}`);
      setAgent(response.data);
    } catch (error) {
      console.error('Error fetching agent:', error);
      toast.error('Failed to fetch agent details');
    }
  };

  const fetchDeployments = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/deployments/agent/${agentId}`);
      setDeployments(response.data);
    } catch (error) {
      console.error('Error fetching deployments:', error);
    } finally {
      setLoading(false);
    }
  };

  const createDeployment = async () => {
    if (!agentId) return;

    setCreating(true);
    try {
      let config;
      switch (deploymentType) {
        case 'twilio':
          config = twilioConfig;
          break;
        case 'chat_widget':
          if (!chatConfig.websiteUrl) {
            toast.error('Website URL is required');
            return;
          }
          config = chatConfig;
          break;
        case 'voice_widget':
          if (!voiceConfig.websiteUrl) {
            toast.error('Website URL is required');
            return;
          }
          config = voiceConfig;
          break;
      }

      await apiClient.post('/deployments', {
        type: deploymentType,
        agentId,
        config,
      });

      toast.success('Deployment created successfully');
      setShowCreateDialog(false);
      fetchDeployments();
    } catch (error) {
      console.error('Error creating deployment:', error);
      toast.error('Failed to create deployment');
    } finally {
      setCreating(false);
    }
  };

  const deleteDeployment = async (deploymentId: string) => {
    if (!confirm('Are you sure you want to delete this deployment?')) return;

    try {
      await apiClient.delete(`/deployments/${deploymentId}`);
      toast.success('Deployment deleted successfully');
      fetchDeployments();
    } catch (error) {
      console.error('Error deleting deployment:', error);
      toast.error('Failed to delete deployment');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Copied to clipboard');
  };

  const getDeploymentIcon = (type: string) => {
    switch (type) {
      case 'twilio':
        return <MdPhone size={24} />;
      case 'chat_widget':
        return <MdChat size={24} />;
      case 'voice_widget':
        return <MdMic size={24} />;
      default:
        return <MdPublic size={24} />;
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <button
            onClick={() => navigate('/agents')}
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
              fontWeight: 300
            }}
          >
            <MdArrowBack size={20} />
            Back to Agents
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
              Deploy Agent
            </h1>
            <p style={{ fontSize: '14px', fontWeight: 300, color: '#64748b' }}>
              {agent?.name} - Deploy to multiple channels
            </p>
          </div>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="btn btn-primary"
          >
            <MdAdd size={20} />
            <span>New Deployment</span>
          </button>
        </div>
      </div>

      {/* Deployments List */}
      <div style={{ display: 'grid', gap: '24px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
            <div className="spinner"></div>
          </div>
        ) : deployments.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '64px 24px' }}>
            <MdPublic size={64} style={{ margin: '0 auto 24px', color: '#cbd5e1' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
              No Deployments Yet
            </h3>
            <p style={{ fontSize: '14px', fontWeight: 300, color: '#64748b', marginBottom: '24px' }}>
              Deploy your agent to Twilio, chat widget, or voice widget
            </p>
            <button onClick={() => setShowCreateDialog(true)} className="btn btn-primary">
              <MdAdd size={20} />
              <span>Create First Deployment</span>
            </button>
          </div>
        ) : (
          deployments.map((deployment) => (
            <div key={deployment.id} className="card" style={{ borderLeft: '4px solid #84cc16' }}>
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      padding: '12px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #a3e635 0%, #84cc16 100%)',
                      color: 'white'
                    }}>
                      {getDeploymentIcon(deployment.type)}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: 400, color: '#0f172a', marginBottom: '4px' }}>
                        {deployment.type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: 300,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: deployment.status === 'active' ? '#f0fdf4' : '#f1f5f9',
                          color: deployment.status === 'active' ? '#84cc16' : '#64748b'
                        }}>
                          {deployment.status}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 300, color: '#64748b' }}>
                          Created {new Date(deployment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteDeployment(deployment.id)}
                    style={{
                      padding: '8px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      background: 'white',
                      cursor: 'pointer',
                      color: '#ef4444'
                    }}
                  >
                    <MdDelete size={20} />
                  </button>
                </div>

                {/* Twilio Deployment */}
                {deployment.type === 'twilio' && deployment.phone_number && (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 300, color: '#64748b', marginBottom: '4px' }}>
                            Phone Number
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: 400, fontFamily: 'monospace' }}>
                            {deployment.phone_number}
                          </div>
                        </div>
                        <button
                          onClick={() => copyToClipboard(deployment.phone_number!, `phone-${deployment.id}`)}
                          style={{
                            padding: '8px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            background: 'white',
                            cursor: 'pointer'
                          }}
                        >
                          {copiedId === `phone-${deployment.id}` ? (
                            <MdCheck size={20} style={{ color: '#84cc16' }} />
                          ) : (
                            <MdContentCopy size={20} />
                          )}
                        </button>
                      </div>
                    </div>
                    {deployment.webhook_url && (
                      <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 300, color: '#64748b', marginBottom: '4px' }}>
                              Webhook URL
                            </div>
                            <div style={{ fontSize: '14px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {deployment.webhook_url}
                            </div>
                          </div>
                          <button
                            onClick={() => copyToClipboard(deployment.webhook_url!, `webhook-${deployment.id}`)}
                            style={{
                              padding: '8px',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              background: 'white',
                              cursor: 'pointer',
                              marginLeft: '16px'
                            }}
                          >
                            {copiedId === `webhook-${deployment.id}` ? (
                              <MdCheck size={20} style={{ color: '#84cc16' }} />
                            ) : (
                              <MdContentCopy size={20} />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Chat/Voice Widget Deployment */}
                {(deployment.type === 'chat_widget' || deployment.type === 'voice_widget') && deployment.embed_code && (
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 300, color: '#64748b', marginBottom: '8px' }}>
                      Embed Code
                    </div>
                    <div style={{ position: 'relative' }}>
                      <pre style={{
                        padding: '16px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                        overflow: 'auto',
                        maxHeight: '200px'
                      }}>
                        <code>{deployment.embed_code}</code>
                      </pre>
                      <button
                        onClick={() => copyToClipboard(deployment.embed_code!, `embed-${deployment.id}`)}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          padding: '8px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          background: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        {copiedId === `embed-${deployment.id}` ? (
                          <MdCheck size={20} style={{ color: '#84cc16' }} />
                        ) : (
                          <MdContentCopy size={20} />
                        )}
                      </button>
                    </div>
                    <p style={{ fontSize: '12px', fontWeight: 300, color: '#64748b', marginTop: '8px' }}>
                      Copy and paste this code into your website's HTML, just before the closing &lt;/body&gt; tag
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Dialog */}
      {showCreateDialog && (
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
        }} onClick={() => setShowCreateDialog(false)}>
          <div className="card" style={{ maxWidth: '800px', width: '90%', maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 400, color: '#0f172a', marginBottom: '24px' }}>
                Create New Deployment
              </h2>

              {/* Type Selection */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '14px', fontWeight: 300, color: '#64748b', marginBottom: '12px' }}>
                  Select Deployment Type
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <button
                    onClick={() => setDeploymentType('twilio')}
                    style={{
                      padding: '16px',
                      border: `2px solid ${deploymentType === 'twilio' ? '#84cc16' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      background: deploymentType === 'twilio' ? '#f0fdf4' : 'white',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <MdPhone size={32} style={{ margin: '0 auto 8px', color: deploymentType === 'twilio' ? '#84cc16' : '#64748b' }} />
                    <div style={{ fontSize: '14px', fontWeight: 400 }}>Twilio</div>
                  </button>
                  <button
                    onClick={() => setDeploymentType('chat_widget')}
                    style={{
                      padding: '16px',
                      border: `2px solid ${deploymentType === 'chat_widget' ? '#84cc16' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      background: deploymentType === 'chat_widget' ? '#f0fdf4' : 'white',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <MdChat size={32} style={{ margin: '0 auto 8px', color: deploymentType === 'chat_widget' ? '#84cc16' : '#64748b' }} />
                    <div style={{ fontSize: '14px', fontWeight: 400 }}>Chat Widget</div>
                  </button>
                  <button
                    onClick={() => setDeploymentType('voice_widget')}
                    style={{
                      padding: '16px',
                      border: `2px solid ${deploymentType === 'voice_widget' ? '#84cc16' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      background: deploymentType === 'voice_widget' ? '#f0fdf4' : 'white',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <MdMic size={32} style={{ margin: '0 auto 8px', color: deploymentType === 'voice_widget' ? '#84cc16' : '#64748b' }} />
                    <div style={{ fontSize: '14px', fontWeight: 400 }}>Voice Widget</div>
                  </button>
                </div>
              </div>

              {/* Configuration Forms */}
              {deploymentType === 'twilio' && (
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 300, color: '#64748b', marginBottom: '8px' }}>
                      Phone Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={twilioConfig.phoneNumber}
                      onChange={(e) => setTwilioConfig({ ...twilioConfig, phoneNumber: e.target.value })}
                      placeholder="+1234567890"
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                    <p style={{ fontSize: '12px', fontWeight: 300, color: '#64748b', marginTop: '4px' }}>
                      Leave empty to auto-purchase a new number
                    </p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 400 }}>Record Calls</div>
                      <div style={{ fontSize: '12px', fontWeight: 300, color: '#64748b' }}>Save call recordings</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={twilioConfig.recordCalls}
                      onChange={(e) => setTwilioConfig({ ...twilioConfig, recordCalls: e.target.checked })}
                      style={{ width: '20px', height: '20px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 400 }}>Transcribe Voicemail</div>
                      <div style={{ fontSize: '12px', fontWeight: 300, color: '#64748b' }}>Convert voicemails to text</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={twilioConfig.transcribeVoicemail}
                      onChange={(e) => setTwilioConfig({ ...twilioConfig, transcribeVoicemail: e.target.checked })}
                      style={{ width: '20px', height: '20px' }}
                    />
                  </div>
                </div>
              )}

              {deploymentType === 'chat_widget' && (
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 300, color: '#64748b', marginBottom: '8px' }}>
                      Website URL *
                    </label>
                    <input
                      type="text"
                      value={chatConfig.websiteUrl}
                      onChange={(e) => setChatConfig({ ...chatConfig, websiteUrl: e.target.value })}
                      placeholder="https://example.com"
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 300, color: '#64748b', marginBottom: '8px' }}>
                      Welcome Message
                    </label>
                    <textarea
                      value={chatConfig.welcomeMessage}
                      onChange={(e) => setChatConfig({ ...chatConfig, welcomeMessage: e.target.value })}
                      rows={2}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '14px',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 300, color: '#64748b', marginBottom: '8px' }}>
                      Primary Color
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="color"
                        value={chatConfig.primaryColor}
                        onChange={(e) => setChatConfig({ ...chatConfig, primaryColor: e.target.value })}
                        style={{ width: '60px', height: '40px', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                      />
                      <input
                        type="text"
                        value={chatConfig.primaryColor}
                        onChange={(e) => setChatConfig({ ...chatConfig, primaryColor: e.target.value })}
                        style={{
                          flex: 1,
                          padding: '12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {deploymentType === 'voice_widget' && (
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 300, color: '#64748b', marginBottom: '8px' }}>
                      Website URL *
                    </label>
                    <input
                      type="text"
                      value={voiceConfig.websiteUrl}
                      onChange={(e) => setVoiceConfig({ ...voiceConfig, websiteUrl: e.target.value })}
                      placeholder="https://example.com"
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 300, color: '#64748b', marginBottom: '8px' }}>
                      Button Text
                    </label>
                    <input
                      type="text"
                      value={voiceConfig.buttonText}
                      onChange={(e) => setVoiceConfig({ ...voiceConfig, buttonText: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 300, color: '#64748b', marginBottom: '8px' }}>
                      Primary Color
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="color"
                        value={voiceConfig.primaryColor}
                        onChange={(e) => setVoiceConfig({ ...voiceConfig, primaryColor: e.target.value })}
                        style={{ width: '60px', height: '40px', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                      />
                      <input
                        type="text"
                        value={voiceConfig.primaryColor}
                        onChange={(e) => setVoiceConfig({ ...voiceConfig, primaryColor: e.target.value })}
                        style={{
                          flex: 1,
                          padding: '12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e2e8f0' }}>
                <button
                  onClick={() => setShowCreateDialog(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={createDeployment}
                  disabled={creating}
                  className="btn btn-primary"
                >
                  {creating ? 'Creating...' : 'Create Deployment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
