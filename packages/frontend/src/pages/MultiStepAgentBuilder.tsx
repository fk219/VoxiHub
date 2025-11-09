import React, { useState, useEffect, Component } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  MdSave, 
  MdArrowBack, 
  MdArrowForward,
  MdCheck,
  MdPerson,
  MdSmartToy,
  MdRecordVoiceOver,
  MdSettings
} from 'react-icons/md';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

// Error Boundary to catch and display errors
class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('MultiStepAgentBuilder Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
            <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
              <p className="text-sm font-mono text-red-800">{this.state.error?.toString()}</p>
              <pre className="text-xs text-red-600 mt-2 overflow-auto">{this.state.error?.stack}</pre>
            </div>
            <button
              onClick={() => window.location.href = '/agents'}
              className="px-4 py-2 bg-lime-500 text-white rounded hover:bg-lime-600"
            >
              Go Back to Agents
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface AgentConfig {
  name: string;
  description: string;
  personality_tone: string;
  personality_instructions: string;
  llm_provider: 'openai' | 'anthropic' | 'google' | 'groq';
  llm_model: string;
  llm_temperature: number;
  llm_max_tokens: number;
  tts_provider: 'groq' | 'openai' | 'elevenlabs' | 'google' | 'azure';
  tts_voice: string;
  tts_speed: number;
  stt_provider: 'groq' | 'openai' | 'google' | 'azure' | 'deepgram';
  stt_language: string;
  functions_enabled: boolean;
  knowledge_base_ids: string[];
  interruption_sensitivity: number;
  max_call_duration: number;
  webhook_url: string;
}

interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  type: string;
  document_count?: number;
}

// Provider options - defined outside component to avoid re-creation
const llmProviders = [
  { value: 'openai', label: 'OpenAI', description: 'GPT-4, GPT-3.5' },
  { value: 'anthropic', label: 'Anthropic', description: 'Claude 3' },
  { value: 'google', label: 'Google', description: 'Gemini Pro' },
  { value: 'groq', label: 'Groq', description: 'Llama 3, Mixtral (Ultra-fast)' }
];

const llmModels = {
  openai: [
    { value: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
  ],
  anthropic: [
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' }
  ],
  google: [
    { value: 'gemini-pro', label: 'Gemini Pro' },
    { value: 'gemini-pro-vision', label: 'Gemini Pro Vision' }
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile (Recommended)' },
    { value: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B Versatile' },
    { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant (Fastest)' },
    { value: 'llama3-70b-8192', label: 'Llama 3 70B (8K)' },
    { value: 'llama3-8b-8192', label: 'Llama 3 8B (8K)' },
    { value: 'gemma2-9b-it', label: 'Gemma 2 9B' },
    { value: 'gemma-7b-it', label: 'Gemma 7B' }
  ]
};

const ttsProviders = [
  { value: 'groq', label: 'Groq PlayAI', description: '⚡ Ultra-fast & FREE' },
  { value: 'openai', label: 'OpenAI TTS', description: 'Natural voices' },
  { value: 'elevenlabs', label: 'ElevenLabs', description: 'Premium quality' },
  { value: 'google', label: 'Google Cloud', description: 'Neural voices' },
  { value: 'azure', label: 'Azure', description: 'Microsoft voices' }
];

const ttsVoices = {
  groq: ['Fritz-PlayAI', 'Celeste-PlayAI', 'Mason-PlayAI', 'Quinn-PlayAI', 'Thunder-PlayAI', 'Arista-PlayAI', 'Atlas-PlayAI', 'Basil-PlayAI', 'Briggs-PlayAI', 'Calum-PlayAI', 'Cheyenne-PlayAI', 'Chip-PlayAI', 'Cillian-PlayAI', 'Deedee-PlayAI', 'Gail-PlayAI', 'Indigo-PlayAI', 'Mamaw-PlayAI', 'Mikail-PlayAI', 'Mitch-PlayAI'],
  openai: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
  elevenlabs: ['Sarah', 'Rachel', 'Domi', 'Bella'],
  google: ['en-US-Neural2-A', 'en-US-Neural2-C', 'en-US-Neural2-D'],
  azure: ['en-US-JennyNeural', 'en-US-GuyNeural', 'en-US-AriaNeural']
};

const sttProviders = [
  { value: 'groq', label: 'Groq Whisper', description: '⚡ Ultra-fast & FREE' },
  { value: 'openai', label: 'OpenAI Whisper', description: 'Accurate transcription' },
  { value: 'google', label: 'Google Cloud', description: 'Real-time STT' },
  { value: 'azure', label: 'Azure', description: 'Microsoft STT' },
  { value: 'deepgram', label: 'Deepgram', description: 'Nova-2 model' }
];

const MultiStepAgentBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [config, setConfig] = useState<AgentConfig>({
    name: '',
    description: '',
    personality_tone: 'professional',
    personality_instructions: '',
    llm_provider: 'openai',
    llm_model: 'gpt-4-turbo-preview',
    llm_temperature: 0.7,
    llm_max_tokens: 1000,
    tts_provider: 'groq',
    tts_voice: 'Fritz-PlayAI',
    tts_speed: 1.0,
    stt_provider: 'groq',
    stt_language: 'en',
    functions_enabled: true,
    knowledge_base_ids: [],
    interruption_sensitivity: 0.5,
    max_call_duration: 3600000,
    webhook_url: ''
  });

  const steps = [
    { number: 1, title: 'Basic Info', icon: MdPerson },
    { number: 2, title: 'AI Model', icon: MdSmartToy },
    { number: 3, title: 'Voice', icon: MdRecordVoiceOver },
    { number: 4, title: 'Advanced', icon: MdSettings }
  ];

  const loadKnowledgeBases = async () => {
    try {
      const response = await apiClient.get('/api/knowledge-bases');
      setKnowledgeBases((response as KnowledgeBase[]) || []);
    } catch (error) {
      console.error('Failed to load knowledge bases:', error);
      setKnowledgeBases([]);
    }
  };

  const loadAgent = async () => {
    setLoading(true);
    try {
      const agent = await apiClient.getAgent(id!);
      
      // Ensure the loaded agent has a valid llm_model for its provider
      const loadedConfig = agent as any;
      const provider = loadedConfig.llm_provider || 'openai';
      const availableModels = llmModels[provider as keyof typeof llmModels];
      
      // If the model doesn't exist for this provider, use the first available model
      if (!availableModels?.find(m => m.value === loadedConfig.llm_model)) {
        loadedConfig.llm_model = availableModels?.[0]?.value || 'gpt-4-turbo-preview';
      }
      
      // Ensure tts_voice is valid for the provider
      const ttsProvider = loadedConfig.tts_provider || 'groq';
      const availableVoices = ttsVoices[ttsProvider as keyof typeof ttsVoices];
      if (!availableVoices?.includes(loadedConfig.tts_voice)) {
        loadedConfig.tts_voice = availableVoices?.[0] || 'Fritz-PlayAI';
      }
      
      // Ensure all numeric fields are properly typed (convert strings to numbers if needed)
      loadedConfig.llm_temperature = parseFloat(loadedConfig.llm_temperature) || 0.7;
      loadedConfig.llm_max_tokens = parseInt(loadedConfig.llm_max_tokens) || 1000;
      loadedConfig.tts_speed = parseFloat(loadedConfig.tts_speed) || 1.0;
      loadedConfig.interruption_sensitivity = parseFloat(loadedConfig.interruption_sensitivity) || 0.5;
      loadedConfig.max_call_duration = parseInt(loadedConfig.max_call_duration) || 3600000;
      
      // Ensure arrays are properly typed
      loadedConfig.knowledge_base_ids = Array.isArray(loadedConfig.knowledge_base_ids) 
        ? loadedConfig.knowledge_base_ids 
        : [];
      
      setConfig(loadedConfig);
    } catch (error) {
      console.error('Failed to load agent:', error);
      toast.error('Failed to load agent. Using default configuration.');
      // Don't navigate away, let user create new agent instead
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isEditing && id) {
      loadAgent();
    }
    loadKnowledgeBases();
  }, [id, isEditing]);

  const handleSave = async () => {
    if (!config.name.trim()) {
      toast.error('Agent name is required');
      return;
    }

    setSaving(true);
    try {
      // Prepare the agent data
      const agentData = {
        name: config.name,
        description: config.description,
        personality_tone: config.personality_tone,
        personality_instructions: config.personality_instructions,
        llm_provider: config.llm_provider,
        llm_model: config.llm_model,
        llm_temperature: config.llm_temperature,
        llm_max_tokens: config.llm_max_tokens,
        tts_provider: config.tts_provider,
        tts_voice: config.tts_voice,
        tts_speed: config.tts_speed,
        stt_provider: config.stt_provider,
        stt_language: config.stt_language,
        functions_enabled: config.functions_enabled,
        knowledge_base_ids: config.knowledge_base_ids,
        interruption_sensitivity: config.interruption_sensitivity,
        max_call_duration: config.max_call_duration,
        webhook_url: config.webhook_url
      };

      if (isEditing) {
        await apiClient.updateAgent(id!, agentData as any);
        toast.success('Agent updated successfully');
        navigate('/agents');
      } else {
        await apiClient.createAgent(agentData as any);
        toast.success('Agent created successfully');
        navigate('/agents');
      }
    } catch (error: any) {
      console.error('Failed to save agent:', error);
      toast.error(error.message || 'Failed to save agent. Please check console for details.');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (updates: Partial<AgentConfig>) => {
    setConfig({ ...config, ...updates });
  };

  const nextStep = () => {
    if (currentStep === 1 && !config.name.trim()) {
      toast.error('Please enter an agent name');
      return;
    }
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Show loading spinner while fetching agent data
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading agent...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
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
                  Step {currentStep} of 4: {steps[currentStep - 1].title}
                </p>
              </div>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.number;
              const isCompleted = currentStep > step.number;
              
              return (
                <React.Fragment key={step.number}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-lime-500 text-white scale-110'
                          : isCompleted
                          ? 'bg-lime-100 text-lime-600'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {isCompleted ? <MdCheck size={24} /> : <Icon size={24} />}
                    </div>
                    <span
                      className={`text-sm mt-2 font-medium ${
                        isActive ? 'text-lime-600' : isCompleted ? 'text-gray-700' : 'text-gray-400'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-4 rounded transition-all ${
                        isCompleted ? 'bg-lime-500' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-6">
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>
                <p className="text-gray-600 mb-6">
                  Let's start with the basics. Give your agent a name and describe what it does.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agent Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => updateConfig({ name: e.target.value })}
                  placeholder="e.g., Customer Support Agent"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent text-lg"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={config.description}
                  onChange={(e) => updateConfig({ description: e.target.value })}
                  placeholder="Describe what this agent does and how it helps users..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Personality Tone
                </label>
                <select
                  value={config.personality_tone}
                  onChange={(e) => updateConfig({ personality_tone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent"
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
                  placeholder="Provide specific instructions for how the agent should behave, respond, and interact with users..."
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent resize-none"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Example: "Always greet users warmly, be patient with questions, and provide clear step-by-step instructions."
                </p>
              </div>
            </div>
          )}

          {/* Step 2: AI Model Configuration */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">AI Model (LLM)</h2>
                <p className="text-gray-600 mb-6">
                  Choose the AI model that will power your agent's intelligence and responses.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  LLM Provider
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {llmProviders.map((provider) => (
                    <button
                      key={provider.value}
                      onClick={() => {
                        const models = llmModels[provider.value as keyof typeof llmModels];
                        updateConfig({ 
                          llm_provider: provider.value as any,
                          llm_model: models?.[0]?.value || 'gpt-4-turbo-preview'
                        });
                      }}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        config.llm_provider === provider.value
                          ? 'border-lime-500 bg-lime-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-semibold text-gray-900">{provider.label}</div>
                      <div className="text-sm text-gray-600 mt-1">{provider.description}</div>
                      {provider.value === 'groq' && (
                        <div className="text-xs text-lime-600 font-medium mt-2">⚡ Ultra-fast inference</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Model
                </label>
                <select
                  value={config.llm_model}
                  onChange={(e) => updateConfig({ llm_model: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                >
                  {(llmModels[config.llm_provider] || []).map(model => (
                    <option key={model.value} value={model.value}>{model.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Temperature: {(config.llm_temperature || 0.7).toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={config.llm_temperature}
                  onChange={(e) => updateConfig({ llm_temperature: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-lime-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>Focused & Consistent</span>
                  <span>Creative & Varied</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Tokens: {config.llm_max_tokens}
                </label>
                <input
                  type="range"
                  min="100"
                  max="4000"
                  step="100"
                  value={config.llm_max_tokens}
                  onChange={(e) => updateConfig({ llm_max_tokens: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-lime-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>Short responses</span>
                  <span>Long responses</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Voice Configuration */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Voice Configuration</h2>
                <p className="text-gray-600 mb-6">
                  Configure how your agent speaks and listens to users.
                </p>
              </div>

              {/* TTS Provider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Text-to-Speech (TTS) Provider
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {ttsProviders.map((provider) => (
                    <button
                      key={provider.value}
                      onClick={() => {
                        const voices = ttsVoices[provider.value as keyof typeof ttsVoices];
                        updateConfig({ 
                          tts_provider: provider.value as any,
                          tts_voice: voices?.[0] || 'Fritz-PlayAI'
                        });
                      }}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        config.tts_provider === provider.value
                          ? 'border-lime-500 bg-lime-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-semibold text-gray-900">{provider.label}</div>
                      <div className="text-sm text-gray-600 mt-1">{provider.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Voice
                </label>
                <select
                  value={config.tts_voice}
                  onChange={(e) => updateConfig({ tts_voice: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                >
                  {(ttsVoices[config.tts_provider] || []).map(voice => (
                    <option key={voice} value={voice}>{voice}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Speech Speed: {(config.tts_speed || 1.0).toFixed(1)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={config.tts_speed}
                  onChange={(e) => updateConfig({ tts_speed: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-lime-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>Slower</span>
                  <span>Normal</span>
                  <span>Faster</span>
                </div>
              </div>

              {/* STT Provider */}
              <div className="pt-6 border-t">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Speech-to-Text (STT) Provider
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {sttProviders.map((provider) => (
                    <button
                      key={provider.value}
                      onClick={() => updateConfig({ stt_provider: provider.value as any })}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        config.stt_provider === provider.value
                          ? 'border-lime-500 bg-lime-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-semibold text-gray-900">{provider.label}</div>
                      <div className="text-sm text-gray-600 mt-1">{provider.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Language
                </label>
                <select
                  value={config.stt_language}
                  onChange={(e) => updateConfig({ stt_language: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="it">Italian</option>
                  <option value="pt">Portuguese</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                  <option value="zh">Chinese</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 4: Advanced Settings */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Advanced Settings</h2>
                <p className="text-gray-600 mb-6">
                  Fine-tune your agent's behavior and integrations.
                </p>
              </div>

              {/* Knowledge Base Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Knowledge Bases
                </label>
                <p className="text-sm text-gray-500 mb-3">
                  Attach knowledge bases to help your agent answer questions with specific information.
                </p>
                {knowledgeBases.length === 0 ? (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                    <p className="text-sm text-gray-600 mb-2">No knowledge bases available</p>
                    <button
                      type="button"
                      onClick={() => window.open('/knowledge-base', '_blank')}
                      className="text-sm text-lime-600 hover:text-lime-700 font-medium"
                    >
                      Create Knowledge Base →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {knowledgeBases.map((kb) => (
                      <label
                        key={kb.id}
                        className="flex items-start p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={config.knowledge_base_ids.includes(kb.id)}
                          onChange={(e) => {
                            const newIds = e.target.checked
                              ? [...config.knowledge_base_ids, kb.id]
                              : config.knowledge_base_ids.filter(id => id !== kb.id);
                            updateConfig({ knowledge_base_ids: newIds });
                          }}
                          className="w-5 h-5 text-lime-500 border-gray-300 rounded focus:ring-lime-500 mt-0.5"
                        />
                        <div className="ml-3 flex-1">
                          <div className="text-sm font-medium text-gray-900">{kb.name}</div>
                          {kb.description && (
                            <div className="text-xs text-gray-500 mt-0.5">{kb.description}</div>
                          )}
                          <div className="text-xs text-gray-400 mt-1">
                            {kb.document_count || 0} documents • {kb.type}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                {config.knowledge_base_ids.length > 0 && (
                  <p className="text-sm text-lime-600 mt-2">
                    ✓ {config.knowledge_base_ids.length} knowledge base(s) selected
                  </p>
                )}
              </div>

              <div className="flex items-start">
                <input
                  type="checkbox"
                  checked={config.functions_enabled}
                  onChange={(e) => updateConfig({ functions_enabled: e.target.checked })}
                  className="w-5 h-5 text-lime-500 border-gray-300 rounded focus:ring-lime-500 mt-1"
                />
                <div className="ml-3">
                  <label className="text-sm font-medium text-gray-700">
                    Enable Function Calling
                  </label>
                  <p className="text-sm text-gray-500 mt-1">
                    Allow the agent to execute functions like searching databases, sending emails, or making API calls.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Interruption Sensitivity: {(config.interruption_sensitivity || 0.5).toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.interruption_sensitivity}
                  onChange={(e) => updateConfig({ interruption_sensitivity: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-lime-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>Less sensitive</span>
                  <span>More sensitive</span>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Controls how easily users can interrupt the agent while it's speaking.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Call Duration (seconds)
                </label>
                <input
                  type="number"
                  value={config.max_call_duration / 1000}
                  onChange={(e) => updateConfig({ max_call_duration: parseInt(e.target.value) * 1000 })}
                  min="60"
                  max="7200"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Maximum duration for a single call (60 seconds to 2 hours).
                </p>
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Receive real-time notifications about call events, conversations, and agent activities.
                </p>
              </div>

              {/* Summary */}
              <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-4">Configuration Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Agent Name:</span>
                    <span className="font-medium text-gray-900">{config.name || 'Not set'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">LLM Provider:</span>
                    <span className="font-medium text-gray-900">
                      {llmProviders.find(p => p.value === config.llm_provider)?.label}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Model:</span>
                    <span className="font-medium text-gray-900">
                      {llmModels[config.llm_provider]?.find(m => m.value === config.llm_model)?.label || config.llm_model}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">TTS Provider:</span>
                    <span className="font-medium text-gray-900">
                      {ttsProviders.find(p => p.value === config.tts_provider)?.label}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">STT Provider:</span>
                    <span className="font-medium text-gray-900">
                      {sttProviders.find(p => p.value === config.stt_provider)?.label}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Knowledge Bases:</span>
                    <span className="font-medium text-gray-900">
                      {config.knowledge_base_ids.length > 0 
                        ? `${config.knowledge_base_ids.length} attached` 
                        : 'None'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Functions:</span>
                    <span className="font-medium text-gray-900">
                      {config.functions_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <MdArrowBack size={20} />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-3">
            {currentStep < 4 ? (
              <button
                onClick={nextStep}
                className="flex items-center gap-2 px-8 py-3 bg-lime-500 text-white rounded-lg hover:bg-lime-600 transition-colors"
              >
                <span>Next</span>
                <MdArrowForward size={20} />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-8 py-3 bg-lime-500 text-white rounded-lg hover:bg-lime-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <MdSave size={20} />
                <span>{saving ? 'Saving...' : isEditing ? 'Update Agent' : 'Create Agent'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const WrappedMultiStepAgentBuilder = () => (
  <ErrorBoundary>
    <MultiStepAgentBuilder />
  </ErrorBoundary>
);

export default WrappedMultiStepAgentBuilder;
