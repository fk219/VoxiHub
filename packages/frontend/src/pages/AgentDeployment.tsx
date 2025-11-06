import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Globe, Phone, Eye } from 'lucide-react'
import { Agent, WidgetConfig, SipConfig } from '@/types'
import { apiClient } from '@/lib/api'
import { useApp } from '@/contexts/AppContext'
import WidgetConfigForm from '@/components/WidgetConfigForm'
import SipConfigForm from '@/components/SipConfigForm'
import DeploymentStatus from '@/components/DeploymentStatus'
import DeploymentHistory from '@/components/DeploymentHistory'
import toast from 'react-hot-toast'

const AgentDeployment: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { state } = useApp()
  
  const [agent, setAgent] = useState<Agent | null>(null)
  const [activeTab, setActiveTab] = useState<'widget' | 'sip' | 'status'>('widget')
  const [loading, setLoading] = useState(true)
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig | undefined>()
  const [sipConfig, setSipConfig] = useState<SipConfig | undefined>()

  useEffect(() => {
    if (id) {
      loadAgent(id)
    }
  }, [id])

  const loadAgent = async (agentId: string) => {
    try {
      setLoading(true)
      const loadedAgent = await apiClient.getAgent(agentId)
      setAgent(loadedAgent)
      setWidgetConfig(loadedAgent.deployments?.widget)
      setSipConfig(loadedAgent.deployments?.sip)
    } catch (error) {
      toast.error('Failed to load agent')
      console.error('Error loading agent:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveWidgetConfig = async (config: Partial<WidgetConfig>) => {
    if (!id) return
    
    try {
      const savedConfig = await apiClient.updateWidgetConfig(id, config)
      setWidgetConfig(savedConfig)
      
      // Update agent in context if it exists
      if (agent) {
        const updatedAgent = {
          ...agent,
          deployments: {
            ...agent.deployments,
            widget: savedConfig
          }
        }
        setAgent(updatedAgent)
      }
    } catch (error) {
      throw error // Re-throw to let the form handle the error
    }
  }

  const handleSaveSipConfig = async (config: Partial<SipConfig>) => {
    if (!id) return
    
    try {
      const savedConfig = await apiClient.updateSipConfig(id, config)
      setSipConfig(savedConfig)
      
      // Update agent in context if it exists
      if (agent) {
        const updatedAgent = {
          ...agent,
          deployments: {
            ...agent.deployments,
            sip: savedConfig
          }
        }
        setAgent(updatedAgent)
      }
    } catch (error) {
      throw error // Re-throw to let the form handle the error
    }
  }

  const handlePreviewWidget = () => {
    // Generate preview URL with current configuration
    const config = widgetConfig || {}
    const previewUrl = `${window.location.origin}/widget-preview?agentId=${id}&theme=${config.theme || 'light'}&primaryColor=${encodeURIComponent(config.primaryColor || '#3B82F6')}&position=${config.position || 'bottom-right'}&size=${config.size || 'medium'}&autoOpen=${config.autoOpen || false}&voiceEnabled=${config.voiceEnabled || true}&pushToTalk=${config.pushToTalk || false}&greeting=${encodeURIComponent(config.greeting || 'Hello! How can I help you today?')}&placeholder=${encodeURIComponent(config.placeholder || 'Type your message...')}&companyName=${encodeURIComponent(config.companyName || '')}&showPoweredBy=${config.showPoweredBy !== false}`
    
    // Open preview in new window
    const previewWindow = window.open(previewUrl, 'widget-preview', 'width=400,height=600,scrollbars=yes,resizable=yes')
    
    if (!previewWindow) {
      toast.error('Please allow popups to preview the widget')
    } else {
      toast.success('Widget preview opened in new window')
    }
  }

  const handleTestSipConnection = async () => {
    if (!sipConfig || !sipConfig.providerHost || !sipConfig.username) {
      toast.error('Please configure SIP settings before testing')
      return
    }

    try {
      toast.loading('Testing SIP connection...', { id: 'sip-test' })
      
      // In a real implementation, this would call the backend to test SIP connection
      // For now, we'll simulate the test
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Simulate success/failure based on configuration completeness
      const hasAllRequiredFields = sipConfig.providerHost && sipConfig.username && sipConfig.password && sipConfig.realm
      
      if (hasAllRequiredFields) {
        toast.success('SIP connection test successful!', { id: 'sip-test' })
      } else {
        toast.error('SIP connection test failed. Please check your configuration.', { id: 'sip-test' })
      }
    } catch (error) {
      toast.error('Failed to test SIP connection', { id: 'sip-test' })
      console.error('SIP test error:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading agent...</div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Agent not found</div>
      </div>
    )
  }

  const tabs = [
    { id: 'widget', name: 'Website Widget', icon: Globe },
    { id: 'sip', name: 'SIP Integration', icon: Phone },
    { id: 'status', name: 'Deployment Status', icon: Eye }
  ]

  return (
    <div>
      <div className="flex items-center mb-6">
        <Link
          to={`/agents/${id}`}
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mr-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Agent
        </Link>
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Deploy Agent</h2>
          <p className="text-gray-600 mt-1">{agent.name}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'widget' | 'sip' | 'status')}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.name}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'widget' && (
          <div>
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Website Widget Configuration</h3>
              <p className="text-gray-600">
                Configure how your AI agent appears and behaves when embedded on websites.
              </p>
            </div>
            
            <WidgetConfigForm
              agentId={id!}
              config={widgetConfig}
              onSave={handleSaveWidgetConfig}
              onPreview={handlePreviewWidget}
            />
          </div>
        )}

        {activeTab === 'sip' && (
          <div>
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">SIP Integration Configuration</h3>
              <p className="text-gray-600">
                Configure telephony settings to enable inbound and outbound phone calls.
              </p>
            </div>
            
            <SipConfigForm
              agentId={id!}
              config={sipConfig}
              onSave={handleSaveSipConfig}
              onTest={handleTestSipConnection}
            />
          </div>
        )}

        {activeTab === 'status' && (
          <div>
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Deployment Status</h3>
              <p className="text-gray-600">
                Monitor the status of your agent deployments and troubleshoot any issues.
              </p>
            </div>
            
            <div className="space-y-6">
              <DeploymentStatus agentId={id!} />
              <DeploymentHistory agentId={id!} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AgentDeployment