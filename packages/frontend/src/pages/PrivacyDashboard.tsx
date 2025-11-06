import React, { useState, useEffect } from 'react'
import { Shield, Download, Trash2, Edit, Clock, AlertTriangle, CheckCircle } from 'lucide-react'
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
      
      // In a real implementation, you would provide a download link
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
      
      // Redirect to logout or home page
      window.location.href = '/'
      
    } catch (error) {
      console.error('Data deletion failed:', error)
      toast.error('Failed to delete data')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleRectifyData = async () => {
    // This would open a form for data rectification requests
    toast.info('Data rectification form would open here')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Failed to load privacy dashboard</h3>
        <p className="mt-1 text-sm text-gray-500">Please try refreshing the page.</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center">
          <Shield className="w-8 h-8 text-blue-600 mr-3" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Privacy Dashboard</h1>
            <p className="text-gray-600">Manage your data and privacy settings</p>
          </div>
        </div>
      </div>

      {/* Data Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-semibold">{dashboardData.dataSummary.agents}</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">AI Agents</p>
              <p className="text-xs text-gray-500">Created by you</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 font-semibold">{dashboardData.dataSummary.conversations}</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Conversations</p>
              <p className="text-xs text-gray-500">Total interactions</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-semibold">{dashboardData.dataSummary.messages}</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Messages</p>
              <p className="text-xs text-gray-500">Total messages</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="w-8 h-8 text-gray-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Last Activity</p>
              <p className="text-xs text-gray-500">
                {dashboardData.dataSummary.lastActivity 
                  ? new Date(dashboardData.dataSummary.lastActivity).toLocaleDateString()
                  : 'No activity'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Privacy Rights */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Your Privacy Rights</h2>
          <p className="text-sm text-gray-600">Exercise your data protection rights under GDPR</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Data Export */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <Download className="w-5 h-5 text-blue-600 mr-2" />
                <h3 className="font-medium text-gray-900">Export Your Data</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Download a copy of all your data in a portable format.
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => handleExportData(false)}
                  disabled={exportLoading}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  {exportLoading ? 'Exporting...' : 'Export Data'}
                </button>
                <button
                  onClick={() => handleExportData(true)}
                  disabled={exportLoading}
                  className="w-full bg-blue-100 text-blue-700 px-4 py-2 rounded-md hover:bg-blue-200 disabled:opacity-50 text-sm"
                >
                  Export with Encryption
                </button>
              </div>
            </div>

            {/* Data Rectification */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <Edit className="w-5 h-5 text-green-600 mr-2" />
                <h3 className="font-medium text-gray-900">Correct Your Data</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Request corrections to inaccurate or incomplete data.
              </p>
              <button
                onClick={handleRectifyData}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
              >
                Request Correction
              </button>
            </div>

            {/* Data Deletion */}
            <div className="border border-red-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <Trash2 className="w-5 h-5 text-red-600 mr-2" />
                <h3 className="font-medium text-gray-900">Delete Your Data</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Permanently delete all your data from our systems.
              </p>
              <button
                onClick={() => setShowDeleteConfirmation(true)}
                className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm"
              >
                Delete All Data
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Data Retention */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Data Retention</h2>
          <p className="text-sm text-gray-600">How long we keep your data</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {retentionPolicies.map((policy) => (
              <div key={policy.resourceType} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900 capitalize">
                    {policy.resourceType.replace('_', ' ')}
                  </h3>
                  {policy.encryptionRequired && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Encrypted
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  Retained for {policy.retentionDays === -1 ? 'indefinitely' : `${policy.retentionDays} days`}
                  {policy.autoDelete && policy.retentionDays > 0 && ' (auto-deleted)'}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Next cleanup:</strong> {new Date(dashboardData.retentionStatus.nextCleanup).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Recent Privacy Activity</h2>
          <p className="text-sm text-gray-600">Your recent privacy-related actions</p>
        </div>
        <div className="p-6">
          {dashboardData.recentActivity.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No recent privacy activity</p>
          ) : (
            <div className="space-y-3">
              {dashboardData.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {activity.action.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600 mr-2" />
                <h3 className="text-lg font-medium text-gray-900">Delete All Data</h3>
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-4">
                  This action will permanently delete all your data including agents, conversations, and messages. 
                  This cannot be undone.
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  To confirm, please type <strong>DELETE_MY_DATA</strong> below:
                </p>
                <input
                  type="text"
                  value={deleteConfirmationCode}
                  onChange={(e) => setDeleteConfirmationCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="DELETE_MY_DATA"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirmation(false)
                    setDeleteConfirmationCode('')
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteData}
                  disabled={deleteLoading || deleteConfirmationCode !== 'DELETE_MY_DATA'}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteLoading ? 'Deleting...' : 'Delete All Data'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PrivacyDashboard