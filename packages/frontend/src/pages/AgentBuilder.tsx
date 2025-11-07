import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  MdSave,
  MdArrowBack,
  MdRocketLaunch,
  MdPlayArrow,
  MdMic,
  MdPsychology,
  MdSettings,
  MdCode,
  MdPhone
} from 'react-icons/md';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

interface AgentConfig {
  name: string;
  description: string;
  personality_tone: string;
  personality_instructions: string;
  language: string;
  voice_id: string;
  voice_model: string;
  voice_speed: number;
  voice_temperature: number;
  llm_model: string;
  llm_temperature: number;
  llm_max_tokens: number;
  functions_enabled: boolean;
  knowledge_base_ids: string[];
  stt_provider: string;
  tts_provider: string;
  interruption_sensitivity: number;
  response_delay: number;
  end_call_phrases: string[];
  max_call_duration: number;
  webhook_url: string;
}

const AgentBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [activeTab, setActiveTab] = useState<'basic' | 'voice' | 'llm' | 'advanced' | 'test'>('basic');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState<string | null>(null);

  const [config, setConfig] = useState<AgentConfig>({
    name: '',
    description: '',
    personality_tone: 'professional',
    personality_instructions: '',
    language: 'en-US',
    voice_id: '',
    voice_model: 'eleven_turbo_v2',
    voice_speed: 1.0,
    voice_temperature: 0.7,
    llm_model: 'gpt-4',
    llm_temperature: 0.7,
    llm_max_tokens: 1000,
    functions_enabled: true,
    knowledge_base_ids: [],
    stt_provider: 'openai',
    tts_provider: 'elevenlabs',
    interruption_sensitivity: 0.5,
    response_delay: 0,
    end_call_phrases: ['goodbye', 'bye', 'thank you'],
    max_call_duration: 3600000,
    webhook_url: ''
  });

  const [knowledgeBases, setKnowledgeBases] = useState<any[]>([]);

  useEffect(() => {
    loadKnowledgeBases();
    if (isEditing) {
      loadAgent();
    }
  }, [id]);

  const loadKnowledgeBases = async () => {
    try {
      const response = await apiClient.get('/api/knowledge-bases');
      setKnowledgeBases(response.data);
    } catch (error) {
      console.error('Failed to load knowledge bases:', error);
    }
  };

  const loadAgent = async () => {
    try {
      const response = await apiClient.get(`/api/agents/${id}`);
      setConfig(response.data);
    } catch (error) {
      console.error('Failed to load agent:', error);
      toast.error('Failed to load agent');
      navigate('/agents');
    }
  };

  const handleSave = async () => {
    if (!config.name.trim()) {
      toast.error('Agent name is required');
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await apiClient.put(`/api/agents/${id}`, config);
        toast.success('Agent updated successfully');
      } else {
        const response = await apiClient.post('/api/agents', config);
        toast.success('Agent created successfully');
        navigate(`/agents/${response.data.id}`);
      }
    } catch (error: any) {
      console.error('Failed to save agent:', error);
      toast.error(error.response?.data?.error || 'Failed to save agent');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!isEditing) {
      toast.error('Please save the agent first');
      return;
    }

    setPublishing(true);
    try {
      await apiClient.post(`/api/agents/${id}/publish`);
      toast.success('Agent published successfully');
      navigate('/agents');
    } catch (error: any) {
      console.error('Failed to publish agent:', error);
      toast.error(error.response?.data?.error || 'Failed to publish agent');
    } finally {
      setPublishing(false);
    }
  };

  const handleTest = async () => {
    if (!testMessage.trim()) {
      toast.error('Please enter a test message');
      return;
    }

    if (!isEditing) {
      toast.error('Please save the agent first');
      return;
    }

    setTesting(true);
    setTestResponse(null);

    try {
      const response = await apiClient.post(`/api/agents/${id}/test`, {
        message: testMessage
      });

      setTestResponse(response.data.response);
      toast.success('Test completed');
    } catch (error: any) {
      console.error('Failed to test agent:', error);
      toast.error(error.response?.data?.error || 'Failed to test agent');
    } finally {
      setTesting(false);
    }
  };

  const updateConfig = (updates: Partial<AgentConfig>) => {
    setConfig({ ...config, ...updates });
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: MdSettings },
    { id: 'voice', label: 'Voice', icon: MdMic },
    { id: 'llm', label: 'AI Model', icon: MdPsychology },
    { id: 'advanced', label: 'Advanced', icon: MdCode },
    { id: 'test', label: 'Test', icon: MdPlayArrow }
  ];

  return (
    <div>
      {/* Header */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => navigate('/agents')}
              style={{
                padding: '8px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                background: 'white',
                cursor: 'pointer',
                color: '#64748b'
              }}
            >
              <MdArrowBack size={20} />
            </button>
            <div>
              <h2 className="card-title">{isEditing ? 'Edit Agent' : 'Create Agent'}</h2>
              <p className="card-subtitle">Configure your AI voice agent</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-secondary"
            >
              <MdSave size={20} />
              <span>{saving ? 'Saving...' : 'Save'}</span>
            </button>
            {isEditing && (
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="btn btn-primary"
              >
                <MdRocketLaunch size={20} />
                <span>{publishing ? 'Publishing...' : 'Publish'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', borderBottom: '1px solid #f1f5f9' }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  border: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid #84cc16' : '2px solid transparent',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 300,
                  color: activeTab === tab.id ? '#84cc16' : '#64748b',
                  transition: 'all 0.2s'
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="card">
        {/* Basic Info Tab */}
        {activeTab === 'basic' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                Agent Name *
              </label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => updateConfig({ name: e.target.value })}
                placeholder="e.g., Customer Support Agent"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 300
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                Description
              </label>
              <textarea
                value={config.description}
                onChange={(e) => updateConfig({ description: e.target.value })}
                placeholder="Describe what this agent does..."
                rows={3}
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
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                Personality Tone
              </label>
              <select
                value={config.personality_tone}
                onChange={(e) => updateConfig({ personality_tone: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 300
                }}
              >
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="casual">Casual</option>
                <option value="formal">Formal</option>
                <option value="enthusiastic">Enthusiastic</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                Personality Instructions
              </label>
              <textarea
                value={config.personality_instructions}
                onChange={(e) => updateConfig({ personality_instructions: e.target.value })}
                placeholder="Provide specific instructions for how the agent should behave..."
                rows={5}
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
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                Language
              </label>
              <select
                value={config.language}
                onChange={(e) => updateConfig({ language: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 300
                }}
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="es-ES">Spanish</option>
                <option value="fr-FR">French</option>
                <option value="de-DE">German</option>
                <option value="it-IT">Italian</option>
                <option value="pt-BR">Portuguese (Brazil)</option>
                <option value="ja-JP">Japanese</option>
                <option value="ko-KR">Korean</option>
                <option value="zh-CN">Chinese (Simplified)</option>
              </select>
            </div>
          </div>
        )}

        {/* Voice Tab */}
        {activeTab === 'voice' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                Voice Provider
              </label>
              <select
                value={config.tts_provider}
                onChange={(e) => updateConfig({ tts_provider: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 300
                }}
              >
                <option value="elevenlabs">ElevenLabs</option>
                <option value="openai">OpenAI TTS</option>
                <option value="google">Google Cloud TTS</option>
                <option value="azure">Azure TTS</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                Voice Model
              </label>
              <select
                value={config.voice_model}
                onChange={(e) => updateConfig({ voice_model: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 300
                }}
              >
                <option value="eleven_turbo_v2">Eleven Turbo v2 (Fast)</option>
                <option value="eleven_multilingual_v2">Eleven Multilingual v2</option>
                <option value="eleven_monolingual_v1">Eleven Monolingual v1</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                Voice ID
              </label>
              <input
                type="text"
                value={config.voice_id}
                onChange={(e) => updateConfig({ voice_id: e.target.value })}
                placeholder="Enter voice ID from your provider"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 300
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                Voice Speed: {config.voice_speed}x
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={config.voice_speed}
                onChange={(e) => updateConfig({ voice_speed: parseFloat(e.target.value) })}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 300, color: '#64748b', marginTop: '4px' }}>
                <span>0.5x (Slower)</span>
                <span>2x (Faster)</span>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                Voice Temperature: {config.voice_temperature}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={config.voice_temperature}
                onChange={(e) => updateConfig({ voice_temperature: parseFloat(e.target.value) })}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 300, color: '#64748b', marginTop: '4px' }}>
                <span>0 (Consistent)</span>
                <span>1 (Variable)</span>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                Speech-to-Text Provider
              </label>
              <select
                value={config.stt_provider}
                onChange={(e) => updateConfig({ stt_provider: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 300
                }}
              >
                <option value="openai">OpenAI Whisper</option>
                <option value="google">Google Cloud STT</option>
                <option value="azure">Azure STT</option>
                <option value="deepgram">Deepgram</option>
              </select>
            </div>
          </div>
        )}

        {/* LLM Tab */}
        {activeTab === 'llm' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                AI Model
              </label>
              <select
                value={config.llm_model}
                onChange={(e) => updateConfig({ llm_model: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 300
                }}
              >
                <option value="gpt-4">GPT-4 (Most Capable)</option>
                <option value="gpt-4-turbo-preview">GPT-4 Turbo (Fast & Capable)</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Fast & Economical)</option>
                <option value="claude-3-opus">Claude 3 Opus</option>
                <option value="claude-3-sonnet">Claude 3 Sonnet</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                Temperature: {config.llm_temperature}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={config.llm_temperature}
                onChange={(e) => updateConfig({ llm_temperature: parseFloat(e.target.value) })}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 300, color: '#64748b', marginTop: '4px' }}>
                <span>0 (Focused)</span>
                <span>2 (Creative)</span>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                Max Tokens
              </label>
              <input
                type="number"
                value={config.llm_max_tokens}
                onChange={(e) => updateConfig({ llm_max_tokens: parseInt(e.target.value) })}
                min="100"
                max="4000"
                step="100"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 300
                }}
              />
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={config.functions_enabled}
                  onChange={(e) => updateConfig({ functions_enabled: e.target.checked })}
                  style={{ width: '18px', height: '18px' }}
                />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 400, color: '#0f172a' }}>
                    Enable Function Calling
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 300, color: '#64748b' }}>
                    Allow the agent to use functions for real-time data and actions
                  </div>
                </div>
              </label>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                Knowledge Bases
              </label>
              <div style={{ fontSize: '12px', fontWeight: 300, color: '#64748b', marginBottom: '12px' }}>
                Select knowledge bases to provide context to your agent
              </div>
              {knowledgeBases.length === 0 ? (
                <div style={{
                  padding: '16px',
                  border: '1px dashed #e2e8f0',
                  borderRadius: '8px',
                  textAlign: 'center',
                  fontSize: '13px',
                  fontWeight: 300,
                  color: '#64748b'
                }}>
                  No knowledge bases available.{' '}
                  <button
                    onClick={() => navigate('/knowledge-base')}
                    style={{
                      color: '#84cc16',
                      textDecoration: 'underline',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 300
                    }}
                  >
                    Create one
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {knowledgeBases.map(kb => (
                    <label
                      key={kb.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: config.knowledge_base_ids.includes(kb.id) ? '#f0fdf4' : 'white'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={config.knowledge_base_ids.includes(kb.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            updateConfig({ knowledge_base_ids: [...config.knowledge_base_ids, kb.id] });
                          } else {
                            updateConfig({ knowledge_base_ids: config.knowledge_base_ids.filter(id => id !== kb.id) });
                          }
                        }}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 400, color: '#0f172a' }}>
                          {kb.name}
                        </div>
                        {kb.description && (
                          <div style={{ fontSize: '12px', fontWeight: 300, color: '#64748b' }}>
                            {kb.description}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 300, color: '#64748b' }}>
                        {kb.document_count || 0} docs
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Advanced Tab */}
        {activeTab === 'advanced' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                Interruption Sensitivity: {config.interruption_sensitivity}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={config.interruption_sensitivity}
                onChange={(e) => updateConfig({ interruption_sensitivity: parseFloat(e.target.value) })}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 300, color: '#64748b', marginTop: '4px' }}>
                <span>0 (Less Sensitive)</span>
                <span>1 (More Sensitive)</span>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                Response Delay (ms)
              </label>
              <input
                type="number"
                value={config.response_delay}
                onChange={(e) => updateConfig({ response_delay: parseInt(e.target.value) })}
                min="0"
                max="5000"
                step="100"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 300
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                Max Call Duration (minutes)
              </label>
              <input
                type="number"
                value={config.max_call_duration / 60000}
                onChange={(e) => updateConfig({ max_call_duration: parseInt(e.target.value) * 60000 })}
                min="1"
                max="120"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 300
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                End Call Phrases (comma-separated)
              </label>
              <input
                type="text"
                value={config.end_call_phrases.join(', ')}
                onChange={(e) => updateConfig({ end_call_phrases: e.target.value.split(',').map(p => p.trim()) })}
                placeholder="goodbye, bye, thank you"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 300
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                Webhook URL
              </label>
              <input
                type="url"
                value={config.webhook_url}
                onChange={(e) => updateConfig({ webhook_url: e.target.value })}
                placeholder="https://your-server.com/webhook"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 300
                }}
              />
            </div>
          </div>
        )}

        {/* Test Tab */}
        {activeTab === 'test' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {!isEditing ? (
              <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                <MdPlayArrow size={64} style={{ margin: '0 auto 24px', color: '#cbd5e1' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                  Save to Test
                </h3>
                <p style={{ fontSize: '14px', fontWeight: 300, color: '#64748b', marginBottom: '24px' }}>
                  Save your agent configuration first to test it
                </p>
                <button onClick={handleSave} className="btn btn-primary">
                  <MdSave size={20} />
                  <span>Save Agent</span>
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                    Test Message
                  </label>
                  <textarea
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Enter a message to test your agent..."
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
                </div>

                <button
                  onClick={handleTest}
                  disabled={testing || !testMessage.trim()}
                  className="btn btn-primary"
                  style={{ alignSelf: 'flex-start' }}
                >
                  <MdPlayArrow size={20} />
                  <span>{testing ? 'Testing...' : 'Test Agent'}</span>
                </button>

                {testResponse && (
                  <div style={{
                    padding: '16px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px'
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '12px' }}>
                      Agent Response:
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 300, color: '#64748b', lineHeight: '1.6' }}>
                      {testResponse}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentBuilder;
