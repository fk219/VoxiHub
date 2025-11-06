import React, { useState, useEffect } from 'react'
import { WidgetConfig } from '@/types'
import { Eye, Copy, Check } from 'lucide-react'
import { apiClient } from '@/lib/api'
import toast from 'react-hot-toast'

interface WidgetConfigFormProps {
  agentId: string
  config?: WidgetConfig
  onSave: (config: Partial<WidgetConfig>) => Promise<void>
  onPreview: () => void
}

const WidgetConfigForm: React.FC<WidgetConfigFormProps> = ({
  agentId,
  config,
  onSave,
  onPreview
}) => {
  const [formData, setFormData] = useState<Partial<WidgetConfig>>({
    agentId,
    theme: 'light',
    primaryColor: '#3B82F6',
    position: 'bottom-right',
    size: 'medium',
    autoOpen: false,
    greeting: 'Hello! How can I help you today?',
    placeholder: 'Type your message...',
    voiceEnabled: true,
    pushToTalk: false,
    companyName: '',
    showPoweredBy: true,
    ...config
  })

  const [loading, setLoading] = useState(false)
  const [embedCode, setEmbedCode] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    generateEmbedCode()
  }, [formData])

  const generateEmbedCode = async () => {
    try {
      // Try to get the actual embed code from the API
      const codeData = await apiClient.generateWidgetCode(agentId)
      setEmbedCode(codeData.embedCode)
    } catch (error) {
      // Fallback to generating code locally if API fails
      const code = `<script src="https://cdn.aiagent.com/widget.js" 
        data-agent-id="${agentId}"
        data-theme="${formData.theme}"
        data-primary-color="${formData.primaryColor}"
        data-position="${formData.position}"
        data-size="${formData.size}"
        data-auto-open="${formData.autoOpen}"
        data-voice-enabled="${formData.voiceEnabled}"
        data-push-to-talk="${formData.pushToTalk}">
</script>`
      setEmbedCode(code)
    }
  }

  const handleInputChange = (field: keyof WidgetConfig, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSave = async () => {
    try {
      setLoading(true)
      await onSave(formData)
      toast.success('Widget configuration saved successfully')
    } catch (error) {
      toast.error('Failed to save widget configuration')
      console.error('Error saving widget config:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyEmbedCode = async () => {
    try {
      await navigator.clipboard.writeText(embedCode)
      setCopied(true)
      toast.success('Embed code copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('Failed to copy embed code')
    }
  }

  return (
    <div className="space-y-6">
      {/* Appearance Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Appearance</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Theme
            </label>
            <select
              value={formData.theme}
              onChange={(e) => handleInputChange('theme', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary Color
            </label>
            <div className="flex space-x-2">
              <input
                type="color"
                value={formData.primaryColor}
                onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={formData.primaryColor}
                onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="#3B82F6"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Position
            </label>
            <select
              value={formData.position}
              onChange={(e) => handleInputChange('position', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="top-right">Top Right</option>
              <option value="top-left">Top Left</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Size
            </label>
            <select
              value={formData.size}
              onChange={(e) => handleInputChange('size', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
        </div>
      </div>

      {/* Behavior Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Behavior</h3>
        
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="autoOpen"
              checked={formData.autoOpen}
              onChange={(e) => handleInputChange('autoOpen', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="autoOpen" className="ml-2 block text-sm text-gray-700">
              Auto-open widget when page loads
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Greeting Message
            </label>
            <input
              type="text"
              value={formData.greeting}
              onChange={(e) => handleInputChange('greeting', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Hello! How can I help you today?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Input Placeholder
            </label>
            <input
              type="text"
              value={formData.placeholder}
              onChange={(e) => handleInputChange('placeholder', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Type your message..."
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="voiceEnabled"
              checked={formData.voiceEnabled}
              onChange={(e) => handleInputChange('voiceEnabled', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="voiceEnabled" className="ml-2 block text-sm text-gray-700">
              Enable voice input/output
            </label>
          </div>

          {formData.voiceEnabled && (
            <div className="ml-6 flex items-center">
              <input
                type="checkbox"
                id="pushToTalk"
                checked={formData.pushToTalk}
                onChange={(e) => handleInputChange('pushToTalk', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="pushToTalk" className="ml-2 block text-sm text-gray-700">
                Use push-to-talk (instead of continuous listening)
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Branding Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Branding</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company Name
            </label>
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => handleInputChange('companyName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Your Company Name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Logo URL (optional)
            </label>
            <input
              type="url"
              value={formData.logoUrl || ''}
              onChange={(e) => handleInputChange('logoUrl', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://example.com/logo.png"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="showPoweredBy"
              checked={formData.showPoweredBy}
              onChange={(e) => handleInputChange('showPoweredBy', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="showPoweredBy" className="ml-2 block text-sm text-gray-700">
              Show "Powered by AI Agent" branding
            </label>
          </div>
        </div>
      </div>

      {/* Embed Code */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Embed Code</h3>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Copy and paste this code into your website's HTML to embed the AI widget:
          </p>
          
          <div className="relative">
            <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
              <code>{embedCode}</code>
            </pre>
            <button
              onClick={copyEmbedCode}
              className="absolute top-2 right-2 p-2 bg-white rounded border hover:bg-gray-50 transition-colors"
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4 text-gray-600" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <div className="flex space-x-2">
          <button
            onClick={onPreview}
            className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Eye className="w-4 h-4 mr-2" />
            Preview Widget
          </button>
          
          <button
            onClick={() => {
              // Test widget functionality
              toast.success('Widget test functionality would be implemented here')
            }}
            className="inline-flex items-center px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
          >
            Test Widget
          </button>
        </div>
        
        <button
          onClick={handleSave}
          disabled={loading}
          className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  )
}

export default WidgetConfigForm