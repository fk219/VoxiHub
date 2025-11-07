import React from 'react'
import { Link } from 'react-router-dom'
import { Bot, MessageSquare, Phone, BarChart3, Plus, ArrowRight, Sparkles } from 'lucide-react'

const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-lime-500 to-lime-600 rounded-xl p-8 text-white">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          <div className="flex items-center space-x-2 mb-2">
            <Sparkles className="w-5 h-5" />
            <span className="text-sm font-light opacity-90">Welcome to VoxiHub</span>
          </div>
          <h1 className="text-3xl font-light mb-2">AI Agent Platform</h1>
          <p className="text-lime-50 font-light max-w-2xl">
            Create, deploy, and manage intelligent AI agents for conversations across multiple channels.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative bg-white rounded-xl border border-slate-200 p-6">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-lime-400 to-lime-600 rounded-t-xl"></div>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-light text-slate-500 mb-1">Total Agents</p>
              <p className="text-3xl font-light text-slate-900 mb-2">0</p>
              <p className="text-xs font-light text-slate-400">Get started by creating your first agent</p>
            </div>
            <div className="p-3 rounded-lg bg-gradient-to-br from-lime-400 to-lime-600">
              <Bot className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        <div className="relative bg-white rounded-xl border border-slate-200 p-6">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-t-xl"></div>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-light text-slate-500 mb-1">Chat Sessions</p>
              <p className="text-3xl font-light text-slate-900 mb-2">0</p>
              <p className="text-xs font-light text-slate-400">No conversations yet</p>
            </div>
            <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        <div className="relative bg-white rounded-xl border border-slate-200 p-6">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-cyan-600 rounded-t-xl"></div>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-light text-slate-500 mb-1">Phone Calls</p>
              <p className="text-3xl font-light text-slate-900 mb-2">0</p>
              <p className="text-xs font-light text-slate-400">Configure SIP to enable calls</p>
            </div>
            <div className="p-3 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600">
              <Phone className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        <div className="relative bg-white rounded-xl border border-slate-200 p-6">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-400 to-violet-600 rounded-t-xl"></div>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-light text-slate-500 mb-1">Success Rate</p>
              <p className="text-3xl font-light text-slate-900 mb-2">--</p>
              <p className="text-xs font-light text-slate-400">Start conversations to track</p>
            </div>
            <div className="p-3 rounded-lg bg-gradient-to-br from-violet-400 to-violet-600">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-xl font-light text-slate-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Link
              to="/agents/new"
              className="group flex items-center justify-between p-4 bg-gradient-to-r from-lime-50 to-lime-100/50 rounded-lg hover:shadow-md transition-all"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-lime-400 to-lime-600">
                  <Plus className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-light text-slate-900">Create Your First Agent</p>
                  <p className="text-xs text-slate-500 font-light">Build an AI assistant in minutes</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-lime-600 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              to="/agents"
              className="group flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-slate-200">
                  <Bot className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm font-light text-slate-900">View All Agents</p>
                  <p className="text-xs text-slate-500 font-light">Manage your AI agents</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              to="/conversations"
              className="group flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-slate-200">
                  <MessageSquare className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm font-light text-slate-900">Monitor Conversations</p>
                  <p className="text-xs text-slate-500 font-light">Track live interactions</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              to="/analytics"
              className="group flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-slate-200">
                  <BarChart3 className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm font-light text-slate-900">View Analytics</p>
                  <p className="text-xs text-slate-500 font-light">Performance insights</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-xl font-light text-slate-900 mb-4">Recent Activity</h3>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-sm font-light text-slate-600 mb-2">No recent activity</p>
            <p className="text-xs text-slate-400 font-light">Activity will appear here once you start using the platform</p>
          </div>
        </div>
      </div>

      {/* Getting Started Guide */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-xl font-light text-slate-900 mb-4">Getting Started</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-slate-50">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-lime-400 to-lime-600 flex items-center justify-center mb-3">
              <span className="text-white font-light text-sm">1</span>
            </div>
            <h4 className="text-sm font-light text-slate-900 mb-2">Create an Agent</h4>
            <p className="text-xs text-slate-500 font-light">Configure your AI agent's personality, knowledge base, and behavior</p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mb-3">
              <span className="text-white font-light text-sm">2</span>
            </div>
            <h4 className="text-sm font-light text-slate-900 mb-2">Deploy Channels</h4>
            <p className="text-xs text-slate-500 font-light">Add the widget to your website or configure phone integration</p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center mb-3">
              <span className="text-white font-light text-sm">3</span>
            </div>
            <h4 className="text-sm font-light text-slate-900 mb-2">Monitor & Optimize</h4>
            <p className="text-xs text-slate-500 font-light">Track conversations and improve your agent's performance</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
