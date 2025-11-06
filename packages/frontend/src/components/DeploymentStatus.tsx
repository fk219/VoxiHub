import React, { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, RefreshCw, Globe, Phone } from 'lucide-react'
import { apiClient } from '@/lib/api'
import toast from 'react-hot-toast'

interface DeploymentStatusProps {
  agentId: string
}

interface DeploymentStatus {
  widget: {
    status: 'active' | 'inactive' | 'error'
    lastDeployed?: string
    error?: string
  }
  sip: {
    status: 'active' | 'inactive' | 'error'
    lastDeployed?: string
    error?: string
  }
}

const DeploymentStatus: React.FC<DeploymentStatusProps> = ({ agentId }) => {
  const [status, setStatus] = useState<DeploymentStatus>({
    widget: { status: 'inactive' },
    sip: { status: 'inactive' }
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadStatus()
  }, [agentId])

  const loadStatus = async () => {
    try {
      setLoading(true)
      const deploymentStatus = await apiClient.getDeploymentStatus(agentId)
      setStatus(deploymentStatus)
    } catch (error) {
      toast.error('Failed to load deployment status')
      console.error('Error loading deployment status:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshStatus = async () => {
    try {
      setRefreshing(true)
      await loadStatus()
    } finally {
      setRefreshing(false)
    }
  }

  const getStatusIcon = (status: 'active' | 'inactive' | 'error') => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return <Clock className="w-5 h-5 text-gray-400" />
    }
  }

  const getStatusText = (status: 'active' | 'inactive' | 'error') => {
    switch (status) {
      case 'active':
        return 'Active'
      case 'error':
        return 'Error'
      default:
        return 'Inactive'
    }
  }

  const getStatusColor = (status: 'active' | 'inactive' | 'error') => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-50'
      case 'error':
        return 'text-red-600 bg-red-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const formatLastDeployed = (dateString?: string) => {
    if (!dateString) return 'Never deployed'
    
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    } else {
      return 'Less than an hour ago'
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Deployment Status</h3>
          <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
        <div className="space-y-4">
          <div className="animate-pulse">
            <div className="h-16 bg-gray-200 rounded-lg"></div>
          </div>
          <div className="animate-pulse">
            <div className="h-16 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Deployment Status</h3>
        <button
          onClick={refreshStatus}
          disabled={refreshing}
          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          title="Refresh status"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-4">
        {/* Widget Status */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <Globe className="w-5 h-5 text-blue-600 mr-2" />
              <h4 className="font-medium text-gray-900">Website Widget</h4>
            </div>
            <div className="flex items-center">
              {getStatusIcon(status.widget.status)}
              <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(status.widget.status)}`}>
                {getStatusText(status.widget.status)}
              </span>
            </div>
          </div>
          
          <div className="text-sm text-gray-600">
            <p>Last deployed: {formatLastDeployed(status.widget.lastDeployed)}</p>
            {status.widget.error && (
              <p className="text-red-600 mt-1">Error: {status.widget.error}</p>
            )}
          </div>

          {status.widget.status === 'active' && (
            <div className="mt-3 p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-green-700">
                ✓ Widget is live and accepting conversations
              </p>
              <p className="text-xs text-green-600 mt-1">
                Embed code is ready for deployment
              </p>
            </div>
          )}

          {status.widget.status === 'error' && (
            <div className="mt-3 p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-red-700">
                ✗ Widget deployment failed
              </p>
              <p className="text-xs text-red-600 mt-1">
                Check configuration and try again
              </p>
            </div>
          )}
        </div>

        {/* SIP Status */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <Phone className="w-5 h-5 text-blue-600 mr-2" />
              <h4 className="font-medium text-gray-900">SIP Integration</h4>
            </div>
            <div className="flex items-center">
              {getStatusIcon(status.sip.status)}
              <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(status.sip.status)}`}>
                {getStatusText(status.sip.status)}
              </span>
            </div>
          </div>
          
          <div className="text-sm text-gray-600">
            <p>Last deployed: {formatLastDeployed(status.sip.lastDeployed)}</p>
            {status.sip.error && (
              <p className="text-red-600 mt-1">Error: {status.sip.error}</p>
            )}
          </div>

          {status.sip.status === 'active' && (
            <div className="mt-3 p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-green-700">
                ✓ SIP service is connected and ready for calls
              </p>
              <p className="text-xs text-green-600 mt-1">
                Inbound and outbound calls are operational
              </p>
            </div>
          )}

          {status.sip.status === 'error' && (
            <div className="mt-3 p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-red-700">
                ✗ SIP connection failed
              </p>
              <p className="text-xs text-red-600 mt-1">
                Check SIP provider settings and credentials
              </p>
            </div>
          )}

          {status.sip.status === 'inactive' && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Configure SIP settings to enable phone call functionality
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Go to SIP Integration tab to set up telephony
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Deployment Actions */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Actions</h4>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => window.location.href = `#widget`}
            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
          >
            Configure Widget
          </button>
          <button
            onClick={() => window.location.href = `#sip`}
            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
          >
            Configure SIP
          </button>
          {(status.widget.status === 'active' || status.sip.status === 'active') && (
            <button
              onClick={refreshStatus}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
            >
              Refresh Status
            </button>
          )}
        </div>
      </div>

      {/* Overall Status Summary */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Overall Status:</span>
          <div className="flex items-center">
            {status.widget.status === 'active' && status.sip.status === 'active' ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                <span className="text-sm text-green-600">Fully Deployed</span>
              </>
            ) : status.widget.status === 'active' || status.sip.status === 'active' ? (
              <>
                <CheckCircle className="w-4 h-4 text-yellow-500 mr-1" />
                <span className="text-sm text-yellow-600">Partially Deployed</span>
              </>
            ) : (
              <>
                <Clock className="w-4 h-4 text-gray-400 mr-1" />
                <span className="text-sm text-gray-600">Not Deployed</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeploymentStatus