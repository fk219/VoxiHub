import React, { useState, useEffect } from 'react'
import { Shield, Download, Trash2, Edit, Clock, AlertTriangle, CheckCircle, Lock, Eye, FileText } from 'lucide-react'
import { apiClient } from '@/lib/api'
import toast from 'react-hot-toast'

interface PrivacyDashboardData {
  dataSummary: {
    agents: number
    conversations: number
    messages: number
    lastActivity: string | null
  }
  privacyRights: {
    canExport: boolean
    canDelete: boolean
    canRectify: boolean
    lastExport: string | null
    lastDeletion: string | null
  }
  recentActivity: Array<{
    action: string
    timestamp: string
    details: any
  }>
  retentionStatus: {
    conversationsRetainedDays: number
    messagesRetainedDays: number
    nextCleanup: string
  }
}

interface RetentionPolicy {
  resourceType: string
  retentionDays: number
  autoDelete: boolean
  encryptionRequired: boolean
}

const PrivacyDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<PrivacyDashboardData | null>(null)
  const [retentionPolicies, setRetentionPolicies] = useState<RetentionPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [deleteConfirmationCode, setDeleteConfirmationCode] = useState('')
  const [exportLoading, setExportLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    loadDashboardData()
    loadRetentionInfo()
  }, [])

  const loadDashboardData = async () => {
    try {
      const response = await apiClient.get('/privacy/dashboard')
      setDashboardData(response.data)
    } catch (error) {
      console.error('Failed to load privacy dashboard:', error)
      toast.error('Failed to load privacy dashboard')
    } finally {
      setLoading(false)
    }
  }

  const loadRetentionInfo = async () => {
    try {
      const response = await apiClient.get('/privacy/retention-info')
      setRetentionPolicies(response.data.retentionPolicies)
    } catch (error) {
      console.error('Failed to load retention info:', error)
    }
  }

  const handleExportData = async (includeEncryptedBackup: boolean = false) => {
    setExportLoading(true)
    try {
      const response = await apiClient.post('/privacy/export', {
        includeEncryptedBackup
      })
      
      toast.success('Data export completed successfully')
      console.log('Export result:', response.data)
      
    } catch (error) {
      console.error('Data export failed:', error)
      toast.error('Failed to export data')
    } finally {
      setExportLoading(false)
    }
  }

  const handleDeleteData = async () => {
    if (deleteConfirmationCode !== 'DELETE_MY_DATA') {
      toast.error('Please enter the correct confirmation code')
      return
    }

    setDeleteLoading(true)
    try {
      await apiClient.post('/privacy/delete', {
        confirmationCode: deleteConfirmationCode,
        preserveAuditTrail: true
      })
      
      toast.success('Data deletion completed successfully')
      setShowDeleteConfirmation(false)
      setDeleteConfirmationCode('')
      window.location.href = '/'
      
    } catch (error) {
      console.error('Data deletion failed:', error)
      toast.error('Failed to delete data')
    } finally {
      setDeleteLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-gray-300" />
        <h3 className="mt-4 text-lg font-light text-gray-900">Failed to load privacy dashboard</h3>
        <p className="mt-2 text-sm text-gray-400">Please try refreshing the page.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-lime-500 via-lime-600 to-emerald-600 rounded-2xl p-8 text-white">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          <div className="flex items-center space-x-2 mb-2">
            <Shield className="w-5 h-5" />
            <span className="text-sm font-light opacity-90">Privacy & Security</span>
          </div>
          <h1 className="text-3xl font-light mb-2">Your Data, Your Control</h1>
          <p className="text-lime-50 font-light max-w-2xl">
            Manage your personal data, exercise your privacy rights, and control how your information is used.
          </p>
        </div>
      </div>

      {/* Data Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'AI Agents', value: dashboardData.dataSummary.agents, icon: FileText, gradient: 'from-lime-400 to-lime-600' },
          { label: 'Conversations', value: dashboardData.dataSummary.conversations, icon: Eye, gradient: 'from-emerald-400 to-emerald-600' },
          { label: 'Messages', value: dashboardData.dataSummary.messages, icon: Lock, gradient: 'from-cyan-400 to-cyan-600' },
          { label: 'Last Activity', value: dashboardData.dataSummary.lastActivity ? new Date(dashboardData.dataSummary.lastActivity).toLocaleDateString() : 'Never', icon: Clock, gradient: 'from-violet-400 to-violet-600' },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-light text-gray-500">{stat.label}</p>
                <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.gradient}`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="text-2xl font-light text-gray-900">{stat.value}</p>
            </div>
          )
        })}
      </div>

      {/* Privacy Rights */}
      <div className="card-modern">
        <div className="mb-6">
          <h2 className="text-xl font-light text-gray-900">Your Privacy Rights</h2>
          <p className="text-sm text-gray-400 font-light mt-1">Exercise your data protection rights under GDPR</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Data Export */}
          <div className="p-6 rounded-xl border border-gray-100 hover:border-lime-200 transition-colors">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-lime-400 to-lime-600">
                <Download className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-light text-gray-900">Export Your Data</h3>
            </div>
            <p className="text-sm text-gray-500 font-light mb-4">
              Download a copy of all your data in a portable format.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => handleExportData(false)}
                disabled={exportLoading}
                className="btn-primary w-full text-sm"
              >
                {exportLoading ? 'Exporting...' : 'Export Data'}
              </button>
              <button
                onClick={() => handleExportData(true)}
                disabled={exportLoading}
                className="btn-secondary w-full text-sm"
              >
                Export with Encryption
              </button>
            </div>
          </div>

          {/* Data Rectification */}
          <div className="p-6 rounded-xl border border-gray-100 hover:border-emerald-200 transition-colors">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600">
                <Edit className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-light text-gray-900">Correct Your Data</h3>
            </div>
            <p className="text-sm text-gray-500 font-light mb-4">
              Request corrections to inaccurate or incomplete data.
            </p>
            <button className="btn-secondary w-full text-sm">
              Request Correction
            </button>
          </div>

          {/* Data Deletion */}
          <div className="p-6 rounded-xl border border-red-100 hover:border-red-200 transition-colors">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-red-400 to-red-600">
                <Trash2 className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-light text-gray-900">Delete Your Data</h3>
            </div>
            <p className="text-sm text-gray-500 font-light mb-4">
              Permanently delete all your data from our systems.
            </p>
            <button
              onClick={() => setShowDeleteConfirmation(true)}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-light"
            >
              Delete All Data
            </button>
          </div>
        </div>
      </div>

      {/* Data Retention */}
      <div className="card-modern">
        <div className="mb-6">
          <h2 className="text-xl font-light text-gray-900">Data Retention</h2>
          <p className="text-sm text-gray-400 font-light mt-1">How long we keep your data</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {retentionPolicies.map((policy) => (
            <div key={policy.resourceType} className="p-4 rounded-xl bg-gray-50/50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-light text-gray-900 capitalize text-sm">
                  {policy.resourceType.replace('_', ' ')}
                </h3>
                {policy.encryptionRequired && (
                  <span className="badge-lime">
                    <Lock className="w-3 h-3 inline mr-1" />
                    Encrypted
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 font-light">
                Retained for {policy.retentionDays === -1 ? 'indefinitely' : `${policy.retentionDays} days`}
                {policy.autoDelete && policy.retentionDays > 0 && ' (auto-deleted)'}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-lime-50 to-lime-100/50">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-lime-600" />
            <p className="text-sm text-lime-800 font-light">
              <strong className="font-normal">Next cleanup:</strong> {new Date(dashboardData.retentionStatus.nextCleanup).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card-modern">
        <div className="mb-6">
          <h2 className="text-xl font-light text-gray-900">Recent Privacy Activity</h2>
          <p className="text-sm text-gray-400 font-light mt-1">Your recent privacy-related actions</p>
        </div>

        {dashboardData.recentActivity.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-sm text-gray-400 font-light">No recent privacy activity</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dashboardData.recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-4 rounded-xl bg-gray-50/50">
                <div>
                  <p className="text-sm font-light text-gray-900 capitalize">
                    {activity.action.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-gray-400 font-light mt-1">
                    {new Date(activity.timestamp).toLocaleString()}
                  </p>
                </div>
                <CheckCircle className="w-4 h-4 text-lime-500" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 fade-in">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 rounded-lg bg-red-100">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-light text-gray-900">Delete All Data</h3>
            </div>

            <div className="space-y-4 mb-6">
              <p className="text-sm text-gray-600 font-light">
                This action will permanently delete all your data including agents, conversations, and messages. 
                This cannot be undone.
              </p>
              <p className="text-sm text-gray-600 font-light">
                To confirm, please type <strong className="font-normal text-gray-900">DELETE_MY_DATA</strong> below:
              </p>
              <input
                type="text"
                value={deleteConfirmationCode}
                onChange={(e) => setDeleteConfirmationCode(e.target.value)}
                className="input-modern w-full"
                placeholder="DELETE_MY_DATA"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirmation(false)
                  setDeleteConfirmationCode('')
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteData}
                disabled={deleteLoading || deleteConfirmationCode !== 'DELETE_MY_DATA'}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-light"
              >
                {deleteLoading ? 'Deleting...' : 'Delete All Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PrivacyDashboard
