import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MdSave, MdArrowBack, MdRocketLaunch } from 'react-icons/md';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

interface AgentConfig {
  name: string;
  description: string;
  personality_tone: string;
  personality_instructions: string;
  
  // LLM Configuration
  llm_provider: 'openai' | 'anthropic' | 'google' | 'groq';
  llm_model: string;
  llm_temperature: number;
  llm_max_tokens: number;
  
  // TTS Configuration
  tts_provider: 'openai' | 'elevenlabs' | 'google' | 'azure';
  tts_voice: string;
  tts_speed: number;
  
  // STT Configuration
  stt_provider: 'openai' | 'google' | 'azure' | 'deepgram';
  stt_language: string;
  
  // Advanced
  functions_enabled: boolean;
  knowledge_base_ids: string[];
  interruption_sensitivity: number;
  max_call_duration: number;
  webhook_url: string;
}

const ImprovedAgentBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AgentConfig>({
    name: '',
    description: '',
    personality_tone: 'professional',
    personality_instructions: '',
    llm_provider: 'openai',
    llm_model: 'gpt-4-turbo-preview',
    llm_temperature: 0.7,
    llm_max_tokens: 1000,
    tts_provider: 'openai',
    tts_voice: 'alloy',
    tts_speed: 1.0,
    stt_provider: 'openai',
    stt_language: 'en',
    functions_enabled: true,
    knowledge_base_ids: [],
    interruption_sensitivity: 0.5,
    max_call_duration: 3600000,
    webhook_url: ''
  });

  useEffect(() => {
    if (isEditing) {
      loadAgent();
    }
  }, [id]);

  const loadAgent = async () => {
    try {
      const agent = await apiClient.getAgent(id!);
      setConfig(agent as any);
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
        await apiClient.updateAgent(id!, config as any);
        toast.success('Agent updated successfully');
      } else {
        const response = await apiClient.createAgent(config as any);
        toast.success('Agent created successfully');
        navigate(`/agents/${response.id}`);
      }
    } catch (error: any) {
      console.error('Failed to save agent:', error);
      toast.error(error.message || 'Failed to save agent');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (updates: Partial<AgentConfig>) => {
    setConfig({ ...config, ...updates });
  };

  // Provider options
  const llmModels = {
    openai: ['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo'],
    anthropic: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    google: ['gemini-pro', 'gemini-pro-vision'],
    groq: ['llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768', 'gemma-7b-it']
  };

  const ttsVoices = {
    openai: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
    elevenlabs: ['Sarah', 'Rachel', 'Domi', 'Bella'],
    google: ['en-US-Neural2-A', 'en-US-Neural2-C', 'en-US-Neural2-D'],
    azure: ['en-US-JennyNeural', 'en-US-GuyNeural', 'en-US-AriaNeural']
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/agents')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MdArrowBack size={24} />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {isEditing ? 'Edit Agent' : 'Create New Agent'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Configure your AI voice agent with multi-provider support
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-lime-500 text-white rounded-lg hover:bg-lime-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <MdSave size={20} />
            <span>{saving ? 'Saving...' : 'Save Agent'}</span>
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Agent Name *
              </label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => updateConfig({ name: e.target.value })}
                placeholder="e.g., Customer Support Agent"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={config.description}
                onChange={(e) => updateConfig({ description: e.target.value })}
                placeholder="Describe what this agent does..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Personality Tone
              </label>
              <select
                value={config.personality_tone}
                onChange={(e) => updateConfig({ personality_tone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent"
              >
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="casual">Casual</option>
                <option value="formal">Formal</option>
                <option value="enthusiastic">Enthusiastic</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Personality Instructions
              </label>
              <textarea
                value={config.personality_instructions}
                onChange={(e) => updateConfig({ personality_instructions: e.target.value })}
                placeholder="Provide specific instructions for how the agent should behave..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent resize-none"
              />
            </div>
          </div>
        </div>

        {/* LLM Configuration */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Model (LLM)</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Provider
                </label>
                <select
                  value={config.llm_provider}
                  onChange={(e) => updateConfig({ 
                    llm_provider: e.target.value as any,
                    llm_model: llmModels[e.target.value as keyof typeof llmModels][0]
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="google">Google (Gemini)</option>
                  <option value="groq">Groq (Llama 3, Mixtral)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Model
                </label>
                <select
                  value={config.llm_model}
                  onChange={(e) => updateConfig({ llm_model: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                >
                  {llmModels[config.llm_provider].map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Temperature: {config.llm_temperature}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={config.llm_temperature}
                onChange={(e) => updateConfig({ llm_temperature: parseFloat(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Focused</span>
                <span>Creative</span>
              </div>
            </div>
          </div>
        </div>

        {/* Voice Configuration */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Voice Configuration</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  TTS Provider
                </label>
                <select
                  value={config.tts_provider}
                  onChange={(e) => updateConfig({ 
                    tts_provider: e.target.value as any,
                    tts_voice: ttsVoices[e.target.value as keyof typeof ttsVoices][0]
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                >
                  <option value="openai">OpenAI TTS</option>
                  <option value="elevenlabs">ElevenLabs</option>
                  <option value="google">Google Cloud TTS</option>
                  <option value="azure">Azure TTS</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Voice
                </label>
                <select
                  value={config.tts_voice}
                  onChange={(e) => updateConfig({ tts_voice: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                >
                  {ttsVoices[config.tts_provider].map(voice => (
                    <option key={voice} value={voice}>{voice}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                STT Provider
              </label>
              <select
                value={config.stt_provider}
                onChange={(e) => updateConfig({ stt_provider: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent"
              >
                <option value="openai">OpenAI Whisper</option>
                <option value="google">Google Cloud STT</option>
                <option value="azure">Azure STT</option>
                <option value="deepgram">Deepgram</option>
              </select>
            </div>
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Advanced Settings</h2>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={config.functions_enabled}
                onChange={(e) => updateConfig({ functions_enabled: e.target.checked })}
                className="w-4 h-4 text-lime-500 border-gray-300 rounded focus:ring-lime-500"
              />
              <label className="ml-2 text-sm text-gray-700">
                Enable Function Calling
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Webhook URL (Optional)
              </label>
              <input
                type="url"
                value={config.webhook_url}
                onChange={(e) => updateConfig({ webhook_url: e.target.value })}
                placeholder="https://your-server.com/webhook"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImprovedAgentBuilder;
