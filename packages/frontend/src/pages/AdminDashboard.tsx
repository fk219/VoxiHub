import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, MessageSquare, Eye, TrendingUp, Users, Activity } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { OverviewAnalytics } from '@/types'
import LiveConversationMonitor from '@/components/LiveConversationMonitor'
import ConversationAnalytics from '@/components/ConversationAnalytics'

const AdminDashboard: React.FC = () => {
  const [overviewData, setOverviewData] = useState<OverviewAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [agents, setAgents] = useState<any[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [overview, agentList] = await Promise.all([
        apiClient.getOverviewAnalytics(),
        apiClient.getAgents()
      ])
      
      setOverviewData(overview)
      setAgents(agentList)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
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
        <h2 className="text-3xl font-bold text-gray-900">Admin Dashboard</h2>
        <div className="flex space-x-3">
          <Link
            to="/conversations"
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Eye className="w-4 h-4 mr-2" />
            View All Conversations
          </Link>
          <Link
            to="/analytics"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Detailed Analytics
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Overview Metrics */}
      {overviewData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Agents</p>
                <p className="text-2xl font-bold text-gray-900">{overviewData.totalAgents}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <MessageSquare className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Conversations</p>
                <p className="text-2xl font-bold text-gray-900">{overviewData.totalConversations}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Activity className="w-8 h-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Now</p>
                <p className="text-2xl font-bold text-gray-900">{overviewData.activeConversations}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Messages</p>
                <p className="text-2xl font-bold text-gray-900">{overviewData.totalMessages}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Conversations Monitor */}
      <LiveConversationMonitor />

      {/* Agent Filter for Analytics */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Analytics Filter</h3>
        </div>
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">View analytics for:</label>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Agents</option>
            {agents.map(agent => (
              <option key={agent.id} value={agent.id}>{agent.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Conversation Analytics */}
      <ConversationAnalytics agentId={selectedAgent || undefined} />

      {/* Top Performing Agents */}
      {overviewData && overviewData.topPerformingAgents.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Top Performing Agents</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {overviewData.topPerformingAgents.map((agent, index) => (
                <div key={agent.agentId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-semibold">
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">{agent.agentName}</h4>
                      <p className="text-sm text-gray-600">
                        {agent.conversationCount} conversations
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      Avg Duration: {formatDuration(agent.averageDuration)}
                    </p>
                    <Link
                      to={`/agents/${agent.agentId}`}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              to="/conversations"
              className="flex items-center p-4 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <MessageSquare className="w-6 h-6 mr-3" />
              <div>
                <h4 className="font-medium">Monitor Conversations</h4>
                <p className="text-sm text-blue-600">View and search all conversations</p>
              </div>
            </Link>
            
            <Link
              to="/analytics"
              className="flex items-center p-4 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
            >
              <BarChart3 className="w-6 h-6 mr-3" />
              <div>
                <h4 className="font-medium">Performance Analytics</h4>
                <p className="text-sm text-green-600">Detailed performance metrics</p>
              </div>
            </Link>
            
            <Link
              to="/agents"
              className="flex items-center p-4 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <Users className="w-6 h-6 mr-3" />
              <div>
                <h4 className="font-medium">Manage Agents</h4>
                <p className="text-sm text-purple-600">Configure and deploy agents</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard