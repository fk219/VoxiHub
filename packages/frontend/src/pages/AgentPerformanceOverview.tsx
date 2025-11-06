import React, { useState, useEffect } from 'react'
import { Users, TrendingUp } from 'lucide-react'
import { apiClient } from '@/lib/api'
import AgentPerformanceCard from '@/components/AgentPerformanceCard'
import UsageAnalytics from '@/components/UsageAnalytics'

const AgentPerformanceOverview: React.FC = () => {
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<string>('')

  useEffect(() => {
    loadAgents()
  }, [])

  const loadAgents = async () => {
    try {
      setLoading(true)
      const agentList = await apiClient.getAgents()
      setAgents(agentList)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents')
    } finally {
      setLoading(false)
    }
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
        <h2 className="text-3xl font-bold text-gray-900">Agent Performance Overview</h2>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {agents.length === 0 ? (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No agents found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Create your first agent to see performance metrics.
          </p>
        </div>
      ) : (
        <>
          {/* Agent Performance Cards Grid */}
          <div>
            <div className="flex items-center mb-4">
              <TrendingUp className="w-5 h-5 text-blue-600 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Agent Performance Scores</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {agents.map((agent) => (
                <AgentPerformanceCard
                  key={agent.id}
                  agent={agent}
                />
              ))}
            </div>
          </div>

          {/* Agent Filter for Usage Analytics */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Usage Analytics Filter</h3>
            </div>
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">View usage for:</label>
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

          {/* Usage Analytics */}
          <UsageAnalytics agentId={selectedAgent || undefined} />

          {/* Performance Recommendations */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Performance Recommendations</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-start p-4 bg-blue-50 rounded-lg">
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mt-2"></div>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-blue-800">Optimize Knowledge Base</h4>
                    <p className="text-sm text-blue-700">
                      Regularly update your agents' knowledge bases with frequently asked questions to improve success rates.
                    </p>
                  </div>
                </div>

                <div className="flex items-start p-4 bg-green-50 rounded-lg">
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-green-800">Monitor Response Times</h4>
                    <p className="text-sm text-green-700">
                      Keep response times under 2 seconds for better user experience and higher satisfaction scores.
                    </p>
                  </div>
                </div>

                <div className="flex items-start p-4 bg-yellow-50 rounded-lg">
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2"></div>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-yellow-800">Review Transfer Patterns</h4>
                    <p className="text-sm text-yellow-700">
                      Analyze conversations that get transferred to identify gaps in your agent's capabilities.
                    </p>
                  </div>
                </div>

                <div className="flex items-start p-4 bg-purple-50 rounded-lg">
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 bg-purple-400 rounded-full mt-2"></div>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-purple-800">A/B Test Personalities</h4>
                    <p className="text-sm text-purple-700">
                      Experiment with different agent personalities and tones to find what works best for your audience.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default AgentPerformanceOverview