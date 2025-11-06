import React, { useState } from 'react'
import { SipConfig } from '@/types'
import { Plus, X, Phone, Shield, Settings } from 'lucide-react'
import toast from 'react-hot-toast'

interface SipConfigFormProps {
  agentId: string
  config?: SipConfig
  onSave: (config: Partial<SipConfig>) => Promise<void>
  onTest: () => void
}

const SipConfigForm: React.FC<SipConfigFormProps> = ({
  agentId,
  config,
  onSave,
  onTest
}) => {
  const [formData, setFormData] = useState<Partial<SipConfig>>({
    agentId,
    providerHost: '',
    providerPort: 5060,
    username: '',
    password: '',
    realm: '',
    inboundNumbers: [],
    outboundNumber: '',
    recordCalls: true,
    maxCallDuration: 1800, // 30 minutes
    transferEnabled: false,
    transferNumber: '',
    ...config
  })

  const [loading, setLoading] = useState(false)
  const [newInboundNumber, setNewInboundNumber] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleInputChange = (field: keyof SipConfig, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const addInboundNumber = () => {
    if (newInboundNumber.trim()) {
      const phoneRegex = /^\+?[\d\s\-\(\)]+$/
      if (!phoneRegex.test(newInboundNumber.trim())) {
        toast.error('Please enter a valid phone number')
        return
      }

      setFormData(prev => ({
        ...prev,
        inboundNumbers: [...(prev.inboundNumbers || []), newInboundNumber.trim()]
      }))
      setNewInboundNumber('')
    }
  }

  const removeInboundNumber = (index: number) => {
    setFormData(prev => ({
      ...prev,
      inboundNumbers: prev.inboundNumbers?.filter((_, i) => i !== index) || []
    }))
  }

  const validateForm = (): boolean => {
    if (!formData.providerHost?.trim()) {
      toast.error('SIP Host is required')
      return false
    }

    if (!formData.username?.trim()) {
      toast.error('Username is required')
      return false
    }

    if (!formData.password?.trim()) {
      toast.error('Password is required')
      return false
    }

    if (!formData.realm?.trim()) {
      toast.error('Realm is required')
      return false
    }

    if (formData.providerPort && (formData.providerPort < 1 || formData.providerPort > 65535)) {
      toast.error('Port must be between 1 and 65535')
      return false
    }

    if (formData.transferEnabled && !formData.transferNumber?.trim()) {
      toast.error('Transfer number is required when transfer is enabled')
      return false
    }

    if (formData.maxCallDuration && (formData.maxCallDuration < 60 || formData.maxCallDuration > 7200)) {
      toast.error('Call duration must be between 60 and 7200 seconds')
      return false
    }

    return true
  }

  const handleSave = async () => {
    if (!validateForm()) {
      return
    }

    try {
      setLoading(true)
      await onSave(formData)
      toast.success('SIP configuration saved successfully')
    } catch (error) {
      toast.error('Failed to save SIP configuration')
      console.error('Error saving SIP config:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* SIP Provider Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <Phone className="w-5 h-5 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">SIP Provider Settings</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SIP Host *
            </label>
            <input
              type="text"
              value={formData.providerHost}
              onChange={(e) => handleInputChange('providerHost', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="sip.provider.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Port
            </label>
            <input
              type="number"
              value={formData.providerPort}
              onChange={(e) => handleInputChange('providerPort', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="5060"
              min="1"
              max="65535"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username *
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="your-sip-username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="your-sip-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <Shield className={`w-4 h-4 ${showPassword ? 'text-blue-600' : 'text-gray-400'}`} />
              </button>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Realm *
            </label>
            <input
              type="text"
              value={formData.realm}
              onChange={(e) => handleInputChange('realm', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="sip.provider.com"
              required
            />
          </div>
        </div>
      </div>

      {/* Phone Numbers */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Phone Numbers</h3>
        
        <div className="space-y-4">
          {/* Inbound Numbers */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Inbound Numbers
            </label>
            <div className="flex space-x-2">
              <input
                type="tel"
                value={newInboundNumber}
                onChange={(e) => setNewInboundNumber(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+1234567890"
              />
              <button
                onClick={addInboundNumber}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            {formData.inboundNumbers && formData.inboundNumbers.length > 0 && (
              <div className="mt-3 space-y-2">
                {formData.inboundNumbers.map((number, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">{number}</span>
                    <button 
                      onClick={() => removeInboundNumber(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outbound Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Outbound Number (optional)
            </label>
            <input
              type="tel"
              value={formData.outboundNumber}
              onChange={(e) => handleInputChange('outboundNumber', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+1234567890"
            />
            <p className="mt-1 text-xs text-gray-500">
              Number to use for outbound calls. Leave empty to use default.
            </p>
          </div>
        </div>
      </div>

      {/* Call Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <Settings className="w-5 h-5 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Call Settings</h3>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="recordCalls"
              checked={formData.recordCalls}
              onChange={(e) => handleInputChange('recordCalls', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="recordCalls" className="ml-2 block text-sm text-gray-700">
              Record all calls for quality and training purposes
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Call Duration (seconds)
            </label>
            <input
              type="number"
              value={formData.maxCallDuration}
              onChange={(e) => handleInputChange('maxCallDuration', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="60"
              max="7200"
            />
            <p className="mt-1 text-xs text-gray-500">
              Calls will be automatically ended after this duration (60-7200 seconds)
            </p>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="transferEnabled"
              checked={formData.transferEnabled}
              onChange={(e) => handleInputChange('transferEnabled', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="transferEnabled" className="ml-2 block text-sm text-gray-700">
              Enable call transfer to human agents
            </label>
          </div>

          {formData.transferEnabled && (
            <div className="ml-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transfer Number *
              </label>
              <input
                type="tel"
                value={formData.transferNumber}
                onChange={(e) => handleInputChange('transferNumber', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+1234567890"
                required={formData.transferEnabled}
              />
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <button
          onClick={onTest}
          className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <Phone className="w-4 h-4 mr-2" />
          Test Connection
        </button>
        
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

export default SipConfigForm