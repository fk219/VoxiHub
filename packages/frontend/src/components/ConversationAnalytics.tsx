import React, { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, MessageSquare, Phone, Clock, Users } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { ConversationStats } from '@/types'

interface ConversationAnalyticsProps {
  agentId?: string
  className?: string
}

const ConversationAnalytics: React.FC<ConversationAnalyticsProps> = ({ agentId, className = '' }) => {
  const [stats, setStats] = useState<ConversationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d')

  useEffect(() => {
    loadStats()
  }, [agentId, dateRange])

  const loadStats = async () => {
    try {
      setLoading(true)
      const endDate = new Date()
      const startDate = new Date()
      
      switch (dateRange) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7)
          break
        case '30d':
          startDate.setDate(endDate.getDate() - 30)
          break
        case '90d':
          startDate.setDate(endDate.getDate() - 90)
          break
      }

      const data = await apiClient.getConversationStats({
        agentId,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      })
      
      setStats(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 1000 / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'widget': return 'bg-blue-500'
      case 'sip': return 'bg-purple-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500'
      case 'ended': return 'bg-gray-500'
      case 'transferred': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="text-center text-red-600">{error}</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="text-center text-gray-500">No data available</div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <BarChart3 className="w-5 h-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Conversation Analytics</h3>
          </div>
          <div className="flex space-x-2">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1 text-sm rounded-md ${
                  dateRange === range
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {range === '7d' ? '7 days' : range === '30d' ? '30 days' : '90 days'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center">
              <MessageSquare className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-600">Total Conversations</p>
                <p className="text-2xl font-bold text-blue-900">{stats.totalConversations}</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-green-600">Active Now</p>
                <p className="text-2xl font-bold text-green-900">{stats.activeConversations}</p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center">
              <MessageSquare className="w-8 h-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-600">Total Messages</p>
                <p className="text-2xl font-bold text-purple-900">{stats.totalMessages}</p>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-orange-600">Avg Duration</p>
                <p className="text-2xl font-bold text-orange-900">
                  {formatDuration(stats.averageDuration)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Channel and Status Breakdowns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Channel Breakdown */}
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">By Channel</h4>
            <div className="space-y-3">
              {Object.entries(stats.channelBreakdown).map(([channel, count]) => {
                const percentage = stats.totalConversations > 0 
                  ? Math.round((count / stats.totalConversations) * 100) 
                  : 0
                return (
                  <div key={channel} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full ${getChannelColor(channel)} mr-3`}></div>
                      <span className="text-sm font-medium text-gray-700 capitalize">
                        {channel === 'sip' ? 'Phone' : 'Widget'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">{count}</span>
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getChannelColor(channel)}`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-500 w-10 text-right">{percentage}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Status Breakdown */}
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">By Status</h4>
            <div className="space-y-3">
              {Object.entries(stats.statusBreakdown).map(([status, count]) => {
                const percentage = stats.totalConversations > 0 
                  ? Math.round((count / stats.totalConversations) * 100) 
                  : 0
                return (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(status)} mr-3`}></div>
                      <span className="text-sm font-medium text-gray-700 capitalize">{status}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">{count}</span>
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getStatusColor(status)}`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-500 w-10 text-right">{percentage}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Daily Activity Chart */}
        {stats.dailyStats && stats.dailyStats.length > 0 && (
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">Daily Activity</h4>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-end space-x-1 h-32">
                {stats.dailyStats.map((day, index) => {
                  const maxConversations = Math.max(...stats.dailyStats.map(d => d.conversations))
                  const height = maxConversations > 0 
                    ? Math.max(4, (day.conversations / maxConversations) * 100) 
                    : 4
                  
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-blue-500 rounded-t-sm min-h-1"
                        style={{ height: `${height}%` }}
                        title={`${day.conversations} conversations on ${new Date(day.date).toLocaleDateString()}`}
                      ></div>
                      <div className="text-xs text-gray-500 mt-1 transform rotate-45 origin-left">
                        {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ConversationAnalytics