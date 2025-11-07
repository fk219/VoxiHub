import React, { useState, useEffect } from 'react'
import { Search, Filter, Download, Eye, MessageSquare, Phone, Clock, User, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { ConversationWithDetails } from '@/types'

interface ConversationFilters {
  agentId: string
  channel: string
  status: string
  search: string
  startDate: string
  endDate: string
}

const ConversationMonitoring: React.FC = () => {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithDetails | null>(null)
  const [showTranscript, setShowTranscript] = useState(false)
  const [filters, setFilters] = useState<ConversationFilters>({
    agentId: '',
    channel: '',
    status: '',
    search: '',
    startDate: '',
    endDate: ''
  })
  const [currentPage, setCurrentPage] = useState(0)
  const pageSize = 20

  useEffect(() => {
    loadAgents()
    loadConversations()
  }, [filters, currentPage])

  const loadAgents = async () => {
    try {
      const agentList = await apiClient.getAgents()
      setAgents(agentList)
    } catch (err) {
      console.error('Failed to load agents:', err)
    }
  }

  const loadConversations = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiClient.getConversations({
        ...filters,
        limit: pageSize,
        offset: currentPage * pageSize
      })
      setConversations(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: keyof ConversationFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setCurrentPage(0)
  }

  const clearFilters = () => {
    setFilters({
      agentId: '',
      channel: '',
      status: '',
      search: '',
      startDate: '',
      endDate: ''
    })
    setCurrentPage(0)
  }

  const viewConversation = async (conversation: ConversationWithDetails) => {
    try {
      const transcript = await apiClient.getConversationTranscript(conversation.id)
      setSelectedConversation({ ...conversation, messages: transcript.messages })
      setShowTranscript(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation transcript')
    }
  }

  const formatDuration = (startTime: string, endTime?: string) => {
    if (!endTime) return 'Ongoing'
    const duration = new Date(endTime).getTime() - new Date(startTime).getTime()
    const minutes = Math.floor(duration / 60000)
    const seconds = Math.floor((duration % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-lime-100 text-lime-700 border-lime-200'
      case 'ended': return 'bg-slate-100 text-slate-700 border-slate-200'
      case 'transferred': return 'bg-cyan-100 text-cyan-700 border-cyan-200'
      default: return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-light text-slate-900">Conversation Monitoring</h2>
            <p className="text-sm text-slate-500 font-light mt-1">Track and analyze all conversations in real-time</p>
          </div>
          <button className="px-4 py-2 text-sm font-light text-lime-600 hover:text-lime-700 border border-lime-200 rounded-lg hover:bg-lime-50 transition-colors flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm font-light border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
            />
          </div>

          <select
            value={filters.agentId}
            onChange={(e) => handleFilterChange('agentId', e.target.value)}
            className="px-4 py-2 text-sm font-light border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
          >
            <option value="">All Agents</option>
            {agents.map(agent => (
              <option key={agent.id} value={agent.id}>{agent.name}</option>
            ))}
          </select>

          <select
            value={filters.channel}
            onChange={(e) => handleFilterChange('channel', e.target.value)}
            className="px-4 py-2 text-sm font-light border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
          >
            <option value="">All Channels</option>
            <option value="widget">Widget</option>
            <option value="sip">Phone</option>
          </select>

          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-4 py-2 text-sm font-light border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="ended">Ended</option>
            <option value="transferred">Transferred</option>
          </select>

          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            className="px-4 py-2 text-sm font-light border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
          />

          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            className="px-4 py-2 text-sm font-light border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
          />
        </div>

        {(filters.agentId || filters.channel || filters.status || filters.search || filters.startDate || filters.endDate) && (
          <button
            onClick={clearFilters}
            className="mt-3 px-4 py-2 text-sm font-light text-slate-600 hover:text-slate-900 flex items-center space-x-2"
          >
            <X className="w-4 h-4" />
            <span>Clear Filters</span>
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-light text-red-700">{error}</p>
        </div>
      )}

      {/* Conversations List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-lime-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-light text-slate-900 mb-2">No conversations found</h3>
            <p className="text-sm text-slate-500">Try adjusting your filters or check back later.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-light text-slate-500 uppercase tracking-wider">Conversation</th>
                    <th className="px-6 py-3 text-left text-xs font-light text-slate-500 uppercase tracking-wider">Agent</th>
                    <th className="px-6 py-3 text-left text-xs font-light text-slate-500 uppercase tracking-wider">Channel</th>
                    <th className="px-6 py-3 text-left text-xs font-light text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-light text-slate-500 uppercase tracking-wider">Duration</th>
                    <th className="px-6 py-3 text-left text-xs font-light text-slate-500 uppercase tracking-wider">Started</th>
                    <th className="px-6 py-3 text-left text-xs font-light text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {conversations.map((conversation) => (
                    <tr key={conversation.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 rounded-lg bg-lime-100">
                            {conversation.channel === 'sip' ? (
                              <Phone className="w-4 h-4 text-lime-600" />
                            ) : (
                              <MessageSquare className="w-4 h-4 text-lime-600" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-light text-slate-900">{conversation.id.substring(0, 8)}</p>
                            {conversation.phone_number && (
                              <p className="text-xs text-slate-500 font-light flex items-center space-x-1">
                                <User className="w-3 h-3" />
                                <span>{conversation.phone_number}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-light text-slate-900">{conversation.agent?.name || 'Unknown'}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-light bg-slate-100 text-slate-700 rounded-full capitalize">
                          {conversation.channel}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-light rounded-full border capitalize ${getStatusColor(conversation.status)}`}>
                          {conversation.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-1 text-sm font-light text-slate-600">
                          <Clock className="w-4 h-4" />
                          <span>{formatDuration(conversation.started_at, conversation.ended_at)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-light text-slate-600">
                          {new Date(conversation.started_at).toLocaleString()}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => viewConversation(conversation)}
                          className="p-2 text-lime-600 hover:bg-lime-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
              <p className="text-sm font-light text-slate-600">
                Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, conversations.length)} of {conversations.length} conversations
              </p>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                  disabled={currentPage === 0}
                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-light text-slate-600">
                  Page {currentPage + 1}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={conversations.length < pageSize}
                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Transcript Modal */}
      {showTranscript && selectedConversation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h3 className="text-xl font-light text-slate-900">Conversation Transcript</h3>
                <p className="text-sm text-slate-500 font-light mt-1">
                  {new Date(selectedConversation.started_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setShowTranscript(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selectedConversation.messages?.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] px-4 py-3 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-gradient-to-br from-lime-500 to-lime-600 text-white'
                        : 'bg-slate-100 text-slate-900'
                    }`}
                  >
                    <p className="text-sm font-light">{message.content}</p>
                    <p
                      className={`text-xs mt-1 ${
                        message.role === 'user' ? 'text-lime-100' : 'text-slate-500'
                      }`}
                    >
                      {new Date(message.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-slate-200">
              <button className="w-full px-4 py-2 bg-gradient-to-r from-lime-500 to-lime-600 text-white rounded-lg hover:shadow-lg transition-all font-light flex items-center justify-center space-x-2">
                <Download className="w-4 h-4" />
                <span>Download Transcript</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ConversationMonitoring
