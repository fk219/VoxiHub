import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Eye, Plus, Upload, X, FileText, Link as LinkIcon } from 'lucide-react'
import { Agent, FAQ, Document } from '@/types'
import { apiClient } from '@/lib/api'
import { useApp } from '@/contexts/AppContext'
import AgentTester from '@/components/AgentTester'
import DocumentUploader from '@/components/DocumentUploader'
import { validateAgent, validateUrl } from '@/utils/validation'
import toast from 'react-hot-toast'

const AgentBuilder: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { dispatch } = useApp()
  const isEditing = Boolean(id)

  const [agent, setAgent] = useState<Partial<Agent>>({
    name: '',
    description: '',
    personality: {
      tone: 'professional',
      style: '',
      instructions: ''
    },
    knowledgeBase: {
      documents: [],
      urls: [],
      faqs: []
    },
    settings: {
      responseTime: 2000,
      maxConversationLength: 50,
      escalationTriggers: []
    }
  })

  const [loading, setLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showTester, setShowTester] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newFaq, setNewFaq] = useState({ question: '', answer: '' })
  const [newTrigger, setNewTrigger] = useState('')

  useEffect(() => {
    if (isEditing && id) {
      loadAgent(id)
    }
  }, [id, isEditing])

  const loadAgent = async (agentId: string) => {
    try {
      setLoading(true)
      const loadedAgent = await apiClient.getAgent(agentId)
      setAgent(loadedAgent)
    } catch (error) {
      toast.error('Failed to load agent')
      console.error('Error loading agent:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    // Validate agent configuration
    const validationErrors = validateAgent(agent)
    if (validationErrors.length > 0) {
      toast.error(validationErrors[0].message)
      return
    }

    try {
      setLoading(true)
      let savedAgent: Agent

      if (isEditing && id) {
        savedAgent = await apiClient.updateAgent(id, agent)
        dispatch({ type: 'UPDATE_AGENT', payload: savedAgent })
        toast.success('Agent updated successfully')
      } else {
        savedAgent = await apiClient.createAgent(agent as Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>)
        dispatch({ type: 'ADD_AGENT', payload: savedAgent })
        toast.success('Agent created successfully')
        navigate(`/agents/${savedAgent.id}`)
      }
    } catch (error) {
      toast.error(isEditing ? 'Failed to update agent' : 'Failed to create agent')
      console.error('Error saving agent:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setAgent(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handlePersonalityChange = (field: string, value: any) => {
    setAgent(prev => ({
      ...prev,
      personality: {
        ...prev.personality!,
        [field]: value
      }
    }))
  }

  const handleSettingsChange = (field: string, value: any) => {
    setAgent(prev => ({
      ...prev,
      settings: {
        ...prev.settings!,
        [field]: value
      }
    }))
  }

  const handleDocumentsChange = (documents: Document[]) => {
    setAgent(prev => ({
      ...prev,
      knowledgeBase: {
        ...prev.knowledgeBase!,
        documents
      }
    }))
  }

  const addUrl = () => {
    if (newUrl.trim()) {
      if (!validateUrl(newUrl.trim())) {
        toast.error('Please enter a valid URL')
        return
      }
      
      setAgent(prev => ({
        ...prev,
        knowledgeBase: {
          ...prev.knowledgeBase!,
          urls: [...prev.knowledgeBase!.urls, newUrl.trim()]
        }
      }))
      setNewUrl('')
    }
  }

  const removeUrl = (index: number) => {
    setAgent(prev => ({
      ...prev,
      knowledgeBase: {
        ...prev.knowledgeBase!,
        urls: prev.knowledgeBase!.urls.filter((_, i) => i !== index)
      }
    }))
  }

  const addFaq = () => {
    if (newFaq.question.trim() && newFaq.answer.trim()) {
      const faq: FAQ = {
        id: Date.now().toString(),
        question: newFaq.question.trim(),
        answer: newFaq.answer.trim()
      }
      setAgent(prev => ({
        ...prev,
        knowledgeBase: {
          ...prev.knowledgeBase!,
          faqs: [...prev.knowledgeBase!.faqs, faq]
        }
      }))
      setNewFaq({ question: '', answer: '' })
    }
  }

  const removeFaq = (id: string) => {
    setAgent(prev => ({
      ...prev,
      knowledgeBase: {
        ...prev.knowledgeBase!,
        faqs: prev.knowledgeBase!.faqs.filter(faq => faq.id !== id)
      }
    }))
  }

  const addTrigger = () => {
    if (newTrigger.trim()) {
      setAgent(prev => ({
        ...prev,
        settings: {
          ...prev.settings!,
          escalationTriggers: [...prev.settings!.escalationTriggers, newTrigger.trim()]
        }
      }))
      setNewTrigger('')
    }
  }

  const removeTrigger = (index: number) => {
    setAgent(prev => ({
      ...prev,
      settings: {
        ...prev.settings!,
        escalationTriggers: prev.settings!.escalationTriggers.filter((_, i) => i !== index)
      }
    }))
  }

  if (loading && isEditing) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading agent...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Link
            to="/agents"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mr-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Agents
          </Link>
          <h2 className="text-3xl font-bold text-gray-900">
            {isEditing ? 'Edit Agent' : 'Create New Agent'}
          </h2>
        </div>
        
        <div className="flex space-x-3">
          <button 
            onClick={() => setShowPreview(!showPreview)}
            className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Eye className="w-4 h-4 mr-2" />
            {showPreview ? 'Hide Preview' : 'Preview'}
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            {loading ? 'Saving...' : 'Save Agent'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agent Name *
                </label>
                <input
                  type="text"
                  value={agent.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter agent name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={agent.description || ''}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe what this agent does"
                />
              </div>
            </div>
          </div>

          {/* Personality Configuration */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Personality & Tone</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tone
                </label>
                <select
                  value={agent.personality?.tone || 'professional'}
                  onChange={(e) => handlePersonalityChange('tone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="casual">Casual</option>
                  <option value="formal">Formal</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Communication Style
                </label>
                <input
                  type="text"
                  value={agent.personality?.style || ''}
                  onChange={(e) => handlePersonalityChange('style', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Helpful and concise, Warm and empathetic"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Special Instructions
                </label>
                <textarea
                  value={agent.personality?.instructions || ''}
                  onChange={(e) => handlePersonalityChange('instructions', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Specific instructions for how the agent should behave and respond"
                />
              </div>
            </div>
          </div>

          {/* Knowledge Base */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Knowledge Base</h3>
            
            {/* Document Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Documents
              </label>
              <DocumentUploader
                documents={agent.knowledgeBase?.documents || []}
                onDocumentsChange={handleDocumentsChange}
                maxFiles={20}
                maxFileSize={10}
                acceptedTypes={['.pdf', '.txt', '.doc', '.docx', '.md', '.csv']}
              />
            </div>

            {/* URLs */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Website URLs
              </label>
              <div className="flex space-x-2">
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com/help"
                />
                <button
                  onClick={addUrl}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              {agent.knowledgeBase?.urls && agent.knowledgeBase.urls.length > 0 && (
                <div className="mt-4 space-y-2">
                  {agent.knowledgeBase.urls.map((url, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <LinkIcon className="w-4 h-4 text-gray-500 mr-2" />
                        <span className="text-sm text-gray-700">{url}</span>
                      </div>
                      <button 
                        onClick={() => removeUrl(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* FAQs */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Frequently Asked Questions
              </label>
              <div className="space-y-3">
                <input
                  type="text"
                  value={newFaq.question}
                  onChange={(e) => setNewFaq(prev => ({ ...prev, question: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Question"
                />
                <textarea
                  value={newFaq.answer}
                  onChange={(e) => setNewFaq(prev => ({ ...prev, answer: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Answer"
                />
                <button
                  onClick={addFaq}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add FAQ
                </button>
              </div>
              
              {agent.knowledgeBase?.faqs && agent.knowledgeBase.faqs.length > 0 && (
                <div className="mt-4 space-y-3">
                  {agent.knowledgeBase.faqs.map((faq) => (
                    <div key={faq.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-900">{faq.question}</h4>
                        <button 
                          onClick={() => removeFaq(faq.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-600">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Settings</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Response Time (ms)
                </label>
                <input
                  type="number"
                  value={agent.settings?.responseTime || 2000}
                  onChange={(e) => handleSettingsChange('responseTime', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="500"
                  max="10000"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Conversation Length
                </label>
                <input
                  type="number"
                  value={agent.settings?.maxConversationLength || 50}
                  onChange={(e) => handleSettingsChange('maxConversationLength', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="10"
                  max="200"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Escalation Triggers
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newTrigger}
                    onChange={(e) => setNewTrigger(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., I want to speak to a human"
                  />
                  <button
                    onClick={addTrigger}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                {agent.settings?.escalationTriggers && agent.settings.escalationTriggers.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {agent.settings.escalationTriggers.map((trigger, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm text-gray-700">{trigger}</span>
                        <button 
                          onClick={() => removeTrigger(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        {showPreview && (
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Agent Preview</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-700">Name</h4>
                  <p className="text-sm text-gray-600">{agent.name || 'Untitled Agent'}</p>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-700">Description</h4>
                  <p className="text-sm text-gray-600">{agent.description || 'No description'}</p>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-700">Tone</h4>
                  <p className="text-sm text-gray-600 capitalize">{agent.personality?.tone}</p>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-700">Knowledge Base</h4>
                  <div className="text-sm text-gray-600">
                    <p>{agent.knowledgeBase?.documents?.length || 0} documents</p>
                    <p>{agent.knowledgeBase?.urls?.length || 0} URLs</p>
                    <p>{agent.knowledgeBase?.faqs?.length || 0} FAQs</p>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <button 
                    onClick={() => setShowTester(true)}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Test Agent
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Agent Tester Modal */}
      {showTester && (
        <AgentTester 
          agent={agent} 
          onClose={() => setShowTester(false)} 
        />
      )}
    </div>
  )
}

export default AgentBuilder