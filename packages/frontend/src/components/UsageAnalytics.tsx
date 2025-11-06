import React, { useState, useEffect } from 'react'
import { DollarSign, MessageSquare, Phone, Clock, TrendingUp } from 'lucide-react'
import { apiClient } from '@/lib/api'

interface UsageMetrics {
  totalConversations: number
  totalMessages: number
  totalCallMinutes: number
  totalWidgetSessions: number
  estimatedCosts: {
    conversations: number
    messages: number
    callMinutes: number
    total: number
  }
  monthlyTrend: {
    conversations: number
    messages: number
    callMinutes: number
  }
}

interface UsageAnalyticsProps {
  agentId?: string
  className?: string
}

const UsageAnalytics: React.FC<UsageAnalyticsProps> = ({ agentId, className = '' }) => {
  const [usage, setUsage] = useState<UsageMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<'current' | 'previous'>('current')

  useEffect(() => {
    loadUsageData()
  }, [agentId, period])

  const loadUsageData = async () => {
    try {
      setLoading(true)
      
      // Calculate date range based on period
      const endDate = new Date()
      const startDate = new Date()
      
      if (period === 'current') {
        startDate.setDate(1) // Start of current month
      } else {
        endDate.setDate(0) // Last day of previous month
        startDate.setMonth(endDate.getMonth(), 1) // Start of previous month
      }

      // Get conversation stats (this will serve as our usage data)
      const stats = await apiClient.getConversationStats({
        agentId,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      })

      // Calculate estimated costs (these would be real pricing in production)
      const conversationCost = 0.10 // $0.10 per conversation
      const messageCost = 0.01 // $0.01 per message
      const callMinuteCost = 0.05 // $0.05 per minute

      // Estimate call minutes from SIP conversations (simplified)
      const sipConversations = stats.channelBreakdown.sip || 0
      const estimatedCallMinutes = sipConversations * 5 // Assume 5 minutes average

      const usageMetrics: UsageMetrics = {
        totalConversations: stats.totalConversations,
        totalMessages: stats.totalMessages,
        totalCallMinutes: estimatedCallMinutes,
        totalWidgetSessions: stats.channelBreakdown.widget || 0,
        estimatedCosts: {
          conversations: stats.totalConversations * conversationCost,
          messages: stats.totalMessages * messageCost,
          callMinutes: estimatedCallMinutes * callMinuteCost,
          total: (stats.totalConversations * conversationCost) + 
                 (stats.totalMessages * messageCost) + 
                 (estimatedCallMinutes * callMinuteCost)
        },
        monthlyTrend: {
          conversations: Math.random() > 0.5 ? 15 : -8, // Mock trend data
          messages: Math.random() > 0.5 ? 22 : -12,
          callMinutes: Math.random() > 0.5 ? 18 : -5
        }
      }

      setUsage(usageMetrics)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage analytics')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatTrend = (value: number) => {
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value}%`
  }

  const getTrendColor = (value: number) => {
    return value >= 0 ? 'text-green-600' : 'text-red-600'
  }

  const getTrendIcon = (value: number) => {
    return value >= 0 ? 
      <TrendingUp className="w-4 h-4 text-green-600" /> : 
      <TrendingUp className="w-4 h-4 text-red-600 transform rotate-180" />
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

  if (!usage) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="text-center text-gray-500">No usage data available</div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <DollarSign className="w-5 h-5 text-green-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Usage & Billing</h3>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPeriod('current')}
              className={`px-3 py-1 text-sm rounded-md ${
                period === 'current'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Current Month
            </button>
            <button
              onClick={() => setPeriod('previous')}
              className={`px-3 py-1 text-sm rounded-md ${
                period === 'previous'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Previous Month
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Usage Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Conversations</p>
                <p className="text-2xl font-bold text-blue-900">{usage.totalConversations}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-blue-600" />
            </div>
            <div className="mt-2 flex items-center">
              {getTrendIcon(usage.monthlyTrend.conversations)}
              <span className={`ml-1 text-sm ${getTrendColor(usage.monthlyTrend.conversations)}`}>
                {formatTrend(usage.monthlyTrend.conversations)}
              </span>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Messages</p>
                <p className="text-2xl font-bold text-green-900">{usage.totalMessages}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-green-600" />
            </div>
            <div className="mt-2 flex items-center">
              {getTrendIcon(usage.monthlyTrend.messages)}
              <span className={`ml-1 text-sm ${getTrendColor(usage.monthlyTrend.messages)}`}>
                {formatTrend(usage.monthlyTrend.messages)}
              </span>
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Call Minutes</p>
                <p className="text-2xl font-bold text-purple-900">{usage.totalCallMinutes}</p>
              </div>
              <Phone className="w-8 h-8 text-purple-600" />
            </div>
            <div className="mt-2 flex items-center">
              {getTrendIcon(usage.monthlyTrend.callMinutes)}
              <span className={`ml-1 text-sm ${getTrendColor(usage.monthlyTrend.callMinutes)}`}>
                {formatTrend(usage.monthlyTrend.callMinutes)}
              </span>
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Widget Sessions</p>
                <p className="text-2xl font-bold text-orange-900">{usage.totalWidgetSessions}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Estimated Costs</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Conversations ({usage.totalConversations} × $0.10)
              </span>
              <span className="text-sm font-medium text-gray-900">
                {formatCurrency(usage.estimatedCosts.conversations)}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Messages ({usage.totalMessages} × $0.01)
              </span>
              <span className="text-sm font-medium text-gray-900">
                {formatCurrency(usage.estimatedCosts.messages)}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Call Minutes ({usage.totalCallMinutes} × $0.05)
              </span>
              <span className="text-sm font-medium text-gray-900">
                {formatCurrency(usage.estimatedCosts.callMinutes)}
              </span>
            </div>
            
            <div className="border-t border-gray-200 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-medium text-gray-900">Total Estimated Cost</span>
                <span className="text-lg font-bold text-gray-900">
                  {formatCurrency(usage.estimatedCosts.total)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Insights */}
        <div className="mt-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Usage Insights</h4>
          <div className="space-y-3">
            {usage.totalConversations > 1000 && (
              <div className="flex items-start p-3 bg-blue-50 rounded-lg">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2"></div>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    High conversation volume detected. Consider upgrading to a higher tier for better rates.
                  </p>
                </div>
              </div>
            )}
            
            {usage.totalCallMinutes > usage.totalWidgetSessions && (
              <div className="flex items-start p-3 bg-purple-50 rounded-lg">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-2"></div>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-purple-700">
                    Phone calls are your primary channel. Consider optimizing for voice interactions.
                  </p>
                </div>
              </div>
            )}
            
            {usage.estimatedCosts.total > 100 && (
              <div className="flex items-start p-3 bg-green-50 rounded-lg">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">
                    You're eligible for volume discounts. Contact sales for custom pricing.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default UsageAnalytics