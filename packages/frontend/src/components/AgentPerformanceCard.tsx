import React, { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus, Award, AlertTriangle } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { PerformanceAnalytics } from '@/types'

interface AgentPerformanceCardProps {
  agent: {
    id: string
    name: string
  }
  className?: string
}

const AgentPerformanceCard: React.FC<AgentPerformanceCardProps> = ({ agent, className = '' }) => {
  const [performance, setPerformance] = useState<PerformanceAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadPerformance()
  }, [agent.id])

  const loadPerformance = async () => {
    try {
      setLoading(true)
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(endDate.getDate() - 30) // Last 30 days

      const data = await apiClient.getPerformanceAnalytics({
        agentId: agent.id,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      })
      
      setPerformance(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load performance data')
    } finally {
      setLoading(false)
    }
  }

  const calculatePerformanceScore = (data: PerformanceAnalytics): number => {
    // Calculate a composite performance score (0-100)
    const successWeight = 0.4
    const transferWeight = 0.3 // Lower is better
    const durationWeight = 0.2
    const messagesWeight = 0.1

    const successScore = data.conversationSuccessRate
    const transferScore = Math.max(0, 100 - data.transferRate * 2) // Penalize high transfer rates
    const durationScore = Math.min(100, Math.max(0, 100 - (data.averageConversationDuration / 1000 / 60 / 10))) // Penalize very long conversations
    const messagesScore = Math.min(100, Math.max(0, 100 - (data.averageMessagesPerConversation - 5) * 5)) // Optimal around 5-10 messages

    return Math.round(
      successScore * successWeight +
      transferScore * transferWeight +
      durationScore * durationWeight +
      messagesScore * messagesWeight
    )
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50'
    if (score >= 60) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <Award className="w-5 h-5" />
    if (score >= 60) return <Minus className="w-5 h-5" />
    return <AlertTriangle className="w-5 h-5" />
  }

  const getTrendIcon = (value: number, isGoodWhenHigh: boolean = true) => {
    // This would compare with previous period in a real implementation
    // For now, we'll use the value itself to determine trend
    const threshold = isGoodWhenHigh ? 70 : 30
    
    if ((isGoodWhenHigh && value >= threshold) || (!isGoodWhenHigh && value <= threshold)) {
      return <TrendingUp className="w-4 h-4 text-green-500" />
    } else {
      return <TrendingDown className="w-4 h-4 text-red-500" />
    }
  }

  const formatDuration = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 1000 / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !performance) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="text-center text-gray-500">
          <h3 className="font-medium text-gray-900 mb-2">{agent.name}</h3>
          <p className="text-sm">{error || 'No performance data available'}</p>
        </div>
      </div>
    )
  }

  const performanceScore = calculatePerformanceScore(performance)

  return (
    <div className={`bg-white rounded-lg shadow hover:shadow-md transition-shadow ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900">{agent.name}</h3>
          <div className={`flex items-center px-3 py-1 rounded-full ${getScoreColor(performanceScore)}`}>
            {getScoreIcon(performanceScore)}
            <span className="ml-1 text-sm font-medium">{performanceScore}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Success Rate</span>
            <div className="flex items-center">
              {getTrendIcon(performance.conversationSuccessRate, true)}
              <span className="ml-1 text-sm font-medium">
                {Math.round(performance.conversationSuccessRate)}%
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Transfer Rate</span>
            <div className="flex items-center">
              {getTrendIcon(performance.transferRate, false)}
              <span className="ml-1 text-sm font-medium">
                {Math.round(performance.transferRate)}%
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Avg Duration</span>
            <span className="text-sm font-medium">
              {formatDuration(performance.averageConversationDuration)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Avg Messages</span>
            <span className="text-sm font-medium">
              {Math.round(performance.averageMessagesPerConversation)}
            </span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Last 30 days</span>
            <button
              onClick={loadPerformance}
              className="text-blue-600 hover:text-blue-800"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AgentPerformanceCard