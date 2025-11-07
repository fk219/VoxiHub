import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  BarChart3, 
  MessageSquare, 
  Eye, 
  TrendingUp, 
  Users, 
  Activity, 
  ArrowUpRight,
  Sparkles
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import { OverviewAnalytics } from '@/types'

const AdminDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<OverviewAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAnalytics()
  }, [])

  const loadAnalytics = async () => {
    try {
      const response = await apiClient.get('/admin/analytics/overview')
      setAnalytics(response.data)
    } catch (error) {
      console.error('Failed to load analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-lime-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Activity className="w-12 h-12 text-slate-300 mb-4" />
        <h3 className="text-lg font-light text-slate-900 mb-2">No analytics data available</h3>
        <p className="text-sm text-slate-500">Start creating agents to see your analytics.</p>
      </div>
    )
  }

  const stats = [
    {
      name: 'Total Agents',
      value: analytics.totalAgents,
      change: '+12%',
      trend: 'up',
      icon: Users,
      color: 'lime'
    },
    {
      name: 'Conversations',
      value: analytics.totalConversations.toLocaleString(),
      change: '+23%',
      trend: 'up',
      icon: MessageSquare,
      color: 'emerald'
    },
    {
      name: 'Active Now',
      value: analytics.activeConversations,
      change: 'Live',
      trend: 'neutral',
      icon: Activity,
      color: 'cyan'
    },
    {
      name: 'Total Messages',
      value: analytics.totalMessages.toLocaleString(),
      change: '+18%',
      trend: 'up',
      icon: BarChart3,
      color: 'violet'
    },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-lime-500 to-lime-600 rounded-xl p-8 text-white">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          <div className="flex items-center space-x-2 mb-2">
            <Sparkles className="w-5 h-5" />
            <span className="text-sm font-light opacity-90">Welcome back</span>
          </div>
          <h1 className="text-3xl font-light mb-2">Admin Dashboard</h1>
          <p className="text-lime-50 font-light max-w-2xl">
            Monitor your AI agents, track conversations, and analyze performance metrics in real-time.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div 
              key={stat.name} 
              className="relative bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow duration-200"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-lime-400 to-lime-600 rounded-t-xl"></div>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-light text-slate-500 mb-1">{stat.name}</p>
                  <p className="text-3xl font-light text-slate-900 mb-2">{stat.value}</p>
                  <div className="flex items-center space-x-1">
                    {stat.trend === 'up' && <ArrowUpRight className="w-3 h-3 text-lime-600" />}
                    <span className={`text-xs font-light ${
                      stat.trend === 'up' ? 'text-lime-600' : 
                      stat.trend === 'neutral' ? 'text-slate-400' : 'text-red-600'
                    }`}>
                      {stat.change}
                    </span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-gradient-to-br from-lime-400 to-lime-600">
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Top Performing Agents */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-light text-slate-900">Top Performing Agents</h2>
            <p className="text-sm text-slate-500 font-light mt-1">Agents with the most conversations</p>
          </div>
          <Link 
            to="/analytics/performance" 
            className="px-4 py-2 text-sm font-light text-lime-600 hover:text-lime-700 border border-lime-200 rounded-lg hover:bg-lime-50 transition-colors"
          >
            View All
          </Link>
        </div>

        {analytics.topPerformingAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="w-12 h-12 text-slate-300 mb-4" />
            <p className="text-sm text-slate-500 font-light">No agents found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {analytics.topPerformingAgents.map((agent, index) => (
              <div 
                key={agent.agentId} 
                className="flex items-center space-x-4 p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex-shrink-0">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${
                    index === 0 ? 'from-lime-400 to-lime-600' :
                    index === 1 ? 'from-emerald-400 to-emerald-600' :
                    'from-cyan-400 to-cyan-600'
                  } flex items-center justify-center`}>
                    <span className="text-white font-light text-sm">#{index + 1}</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-light text-slate-900 truncate">{agent.agentName}</p>
                  <p className="text-xs text-slate-500 font-light">
                    {agent.conversationCount} conversations
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-light text-slate-900">
                    {Math.round(agent.averageDuration / 1000 / 60)}m
                  </p>
                  <p className="text-xs text-slate-500 font-light">avg duration</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/conversations"
          className="group bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-all duration-200"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-lg bg-gradient-to-br from-lime-400 to-lime-600 group-hover:scale-110 transition-transform">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-light text-slate-900">Monitor Conversations</h4>
              <p className="text-sm text-slate-500 font-light mt-1">View live interactions</p>
            </div>
          </div>
        </Link>

        <Link
          to="/analytics/performance"
          className="group bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-all duration-200"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-light text-slate-900">Performance Analytics</h4>
              <p className="text-sm text-slate-500 font-light mt-1">Detailed metrics</p>
            </div>
          </div>
        </Link>

        <Link
          to="/agents"
          className="group bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-all duration-200"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600 group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-light text-slate-900">Manage Agents</h4>
              <p className="text-sm text-slate-500 font-light mt-1">Configure AI agents</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}

export default AdminDashboard
