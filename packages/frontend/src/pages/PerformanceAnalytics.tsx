import React, { useState, useEffect } from 'react'
import { TrendingUp, Clock, MessageSquare, Users, Target, Award } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { PerformanceAnalytics as PerformanceData } from '@/types'

const PerformanceAnalytics: React.FC = () => {
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null)
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d')

  useEffect(() => {
    loadData()
  }, [selectedAgent, dateRange])

  useEffect(() => {
    loadAgents()
  }, [])

  const loadAgents = async () => {
    try {
      const agentList = await apiClient.getAgents()
      setAgents(agentList)
    } catch (err) {
      console.error('Failed to load agents:', err)
    }
  }

  const loadData = async () => {
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

      const data = await apiClient.getPerformanceAnalytics({
        agentId: selectedAgent || undefined,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      })
      
      setPerformanceData(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load performance analytics')
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

  const formatPercentage = (value: number) => {
    return `${Math.round(value * 10) / 10}%`
  }

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600 bg-green-50'
    if (rate >= 60) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  const getTransferRateColor = (rate: number) => {
    if (rate <= 10) return 'text-green-600 bg-green-50'
    if (rate <= 25) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">Performance Analytics</h2>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agent</label>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Agents</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Period</label>
            <div className="flex space-x-2">
              {(['7d', '30d', '90d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-4 py-2 text-sm rounded-md ${
                    dateRange === range
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'text-gray-600 hover:text-gray-900 border border-gray-300'
                  }`}
                >
                  {range === '7d' ? '7 days' : range === '30d' ? '30 days' : '90 days'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {performanceData && (
        <>
          {/* Key Performance Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className={`rounded-lg p-6 ${getSuccessRateColor(performanceData.conversationSuccessRate)}`}>
              <div className="flex items-center">
                <Target className="w-8 h-8" />
                <div className="ml-4">
                  <p className="text-sm font-medium">Success Rate</p>
                  <p className="text-2xl font-bold">{formatPercentage(performanceData.conversationSuccessRate)}</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 text-blue-600 rounded-lg p-6">
              <div className="flex items-center">
                <Clock className="w-8 h-8" />
                <div className="ml-4">
                  <p className="text-sm font-medium">Avg Duration</p>
                  <p className="text-2xl font-bold">{formatDuration(performanceData.averageConversationDuration)}</p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 text-purple-600 rounded-lg p-6">
              <div className="flex items-center">
                <MessageSquare className="w-8 h-8" />
                <div className="ml-4">
                  <p className="text-sm font-medium">Avg Messages</p>
                  <p className="text-2xl font-bold">{Math.round(performanceData.averageMessagesPerConversation)}</p>
                </div>
              </div>
            </div>

            <div className={`rounded-lg p-6 ${getTransferRateColor(performanceData.transferRate)}`}>
              <div className="flex items-center">
                <Users className="w-8 h-8" />
                <div className="ml-4">
                  <p className="text-sm font-medium">Transfer Rate</p>
                  <p className="text-2xl font-bold">{formatPercentage(performanceData.transferRate)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Response Time Metrics */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Response Time Analysis</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {performanceData.responseTimeMetrics.average}ms
                  </div>
                  <div className="text-sm text-gray-600">Average Response Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {performanceData.responseTimeMetrics.median}ms
                  </div>
                  <div className="text-sm text-gray-600">Median Response Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {performanceData.responseTimeMetrics.p95}ms
                  </div>
                  <div className="text-sm text-gray-600">95th Percentile</div>
                </div>
              </div>
            </div>
          </div>

          {/* Satisfaction Score */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Customer Satisfaction</h3>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-4">
                    <Award className="w-12 h-12 text-yellow-500" />
                  </div>
                  <div className="text-4xl font-bold text-gray-900 mb-2">
                    {performanceData.satisfactionScore > 0 ? performanceData.satisfactionScore.toFixed(1) : 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600">
                    {performanceData.satisfactionScore > 0 ? 'Average Satisfaction Score' : 'No satisfaction data available'}
                  </div>
                  {performanceData.satisfactionScore === 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      Satisfaction scoring will be available when feedback is collected
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Hourly Distribution */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Conversation Volume by Hour</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-12 gap-2">
                {performanceData.hourlyDistribution.map((hourData) => {
                  const maxConversations = Math.max(...performanceData.hourlyDistribution.map(h => h.conversations))
                  const height = maxConversations > 0 
                    ? Math.max(20, (hourData.conversations / maxConversations) * 200) 
                    : 20
                  
                  return (
                    <div key={hourData.hour} className="flex flex-col items-center">
                      <div
                        className="w-full bg-blue-500 rounded-t-sm mb-2"
                        style={{ height: `${height}px` }}
                        title={`${hourData.conversations} conversations at ${hourData.hour}:00`}
                      ></div>
                      <div className="text-xs text-gray-500 text-center">
                        {hourData.hour.toString().padStart(2, '0')}
                      </div>
                      <div className="text-xs text-gray-400 text-center">
                        {hourData.conversations}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 text-center text-sm text-gray-600">
                Hour of Day (24-hour format)
              </div>
            </div>
          </div>

          {/* Performance Insights */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Performance Insights</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {performanceData.conversationSuccessRate >= 80 && (
                  <div className="flex items-start p-4 bg-green-50 rounded-lg">
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-green-800">Excellent Success Rate</h4>
                      <p className="text-sm text-green-700">
                        Your agents are successfully resolving {formatPercentage(performanceData.conversationSuccessRate)} of conversations without requiring human intervention.
                      </p>
                    </div>
                  </div>
                )}

                {performanceData.conversationSuccessRate < 60 && (
                  <div className="flex items-start p-4 bg-red-50 rounded-lg">
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-red-400 rounded-full mt-2"></div>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-red-800">Low Success Rate</h4>
                      <p className="text-sm text-red-700">
                        Consider reviewing your agent's knowledge base and conversation flows to improve the {formatPercentage(performanceData.conversationSuccessRate)} success rate.
                      </p>
                    </div>
                  </div>
                )}

                {performanceData.transferRate > 25 && (
                  <div className="flex items-start p-4 bg-yellow-50 rounded-lg">
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2"></div>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-yellow-800">High Transfer Rate</h4>
                      <p className="text-sm text-yellow-700">
                        {formatPercentage(performanceData.transferRate)} of conversations are being transferred to humans. Consider expanding your agent's capabilities.
                      </p>
                    </div>
                  </div>
                )}

                {performanceData.averageMessagesPerConversation > 20 && (
                  <div className="flex items-start p-4 bg-blue-50 rounded-lg">
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-blue-400 rounded-full mt-2"></div>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-blue-800">Long Conversations</h4>
                      <p className="text-sm text-blue-700">
                        Conversations average {Math.round(performanceData.averageMessagesPerConversation)} messages. Consider optimizing responses for efficiency.
                      </p>
                    </div>
                  </div>
                )}

                {performanceData.conversationSuccessRate >= 80 && performanceData.transferRate <= 10 && (
                  <div className="flex items-start p-4 bg-green-50 rounded-lg">
                    <div className="flex-shrink-0">
                      <Award className="w-5 h-5 text-green-500 mt-0.5" />
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-green-800">Outstanding Performance</h4>
                      <p className="text-sm text-green-700">
                        Your agents are performing exceptionally well with high success rates and low transfer rates. Keep up the great work!
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default PerformanceAnalytics