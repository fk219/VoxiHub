import React, { useState, useEffect } from 'react'
import { MessageSquare, Phone, Clock, User, Activity } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { ConversationWithDetails } from '@/types'

const LiveConversationMonitor: React.FC = () => {
  const [liveConversations, setLiveConversations] = useState<ConversationWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useEffect(() => {
    loadLiveConversations()
    
    // Set up polling for real-time updates
    const interval = setInterval(() => {
      loadLiveConversations()
    }, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [])

  const loadLiveConversations = async () => {
    try {
      const data = await apiClient.getLiveConversations()
      setLiveConversations(data)
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load live conversations')
    } finally {
      setLoading(false)
    }
  }

  const getChannelIcon = (channel: string) => {
    return channel === 'sip' ? <Phone className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />
  }

  const getChannelColor = (channel: string) => {
    return channel === 'sip' ? 'text-purple-600' : 'text-blue-600'
  }

  const formatDuration = (startTime: string) => {
    const start = new Date(startTime)
    const now = new Date()
    const duration = Math.floor((now.getTime() - start.getTime()) / 1000 / 60) // minutes
    return `${duration}m`
  }

  const getLastActivity = (context: any) => {
    if (!context?.lastActivity) return 'Unknown'
    const lastActivity = new Date(context.lastActivity)
    const now = new Date()
    const diff = Math.floor((now.getTime() - lastActivity.getTime()) / 1000) // seconds
    
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return `${Math.floor(diff / 3600)}h ago`
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Activity className="w-5 h-5 text-green-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Live Conversations</h3>
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {liveConversations.length} active
            </span>
          </div>
          <div className="text-sm text-gray-500">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        </div>
      </div>

      {error && (
        <div className="px-6 py-4 bg-red-50 border-b border-red-200">
          <div className="text-red-700 text-sm">{error}</div>
        </div>
      )}

      <div className="divide-y divide-gray-200">
        {liveConversations.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No active conversations</h3>
            <p className="mt-1 text-sm text-gray-500">
              All conversations are currently idle.
            </p>
          </div>
        ) : (
          liveConversations.map((conversation) => (
            <div key={conversation.id} className="px-6 py-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`flex items-center ${getChannelColor(conversation.channel)}`}>
                    {getChannelIcon(conversation.channel)}
                  </div>
                  
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">
                        {conversation.agent?.name || 'Unknown Agent'}
                      </span>
                      <span className="text-xs text-gray-500">•</span>
                      <span className="text-xs text-gray-500 capitalize">
                        {conversation.channel}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-4 mt-1">
                      {conversation.phone_number && (
                        <div className="flex items-center text-xs text-gray-600">
                          <User className="w-3 h-3 mr-1" />
                          {conversation.phone_number}
                        </div>
                      )}
                      
                      <div className="flex items-center text-xs text-gray-600">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatDuration(conversation.started_at)}
                      </div>
                      
                      {conversation.context && (
                        <div className="text-xs text-gray-600">
                          Last activity: {getLastActivity(conversation.context)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {conversation.context?.messageCount && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {conversation.context.messageCount} messages
                    </span>
                  )}
                  
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="ml-1 text-xs text-green-600 font-medium">Live</span>
                  </div>
                </div>
              </div>

              {/* Show recent messages if available */}
              {conversation.messages && conversation.messages.length > 0 && (
                <div className="mt-3 pl-8">
                  <div className="text-xs text-gray-500 mb-2">Recent messages:</div>
                  <div className="space-y-1">
                    {conversation.messages.slice(-2).map((message, index) => (
                      <div key={index} className="text-xs">
                        <span className={`font-medium ${
                          message.role === 'user' ? 'text-blue-600' : 'text-gray-700'
                        }`}>
                          {message.role === 'user' ? 'User' : 'Agent'}:
                        </span>
                        <span className="ml-1 text-gray-600">
                          {message.content.length > 100 
                            ? `${message.content.substring(0, 100)}...` 
                            : message.content
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {liveConversations.length > 0 && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Updates automatically every 5 seconds</span>
            <button
              onClick={loadLiveConversations}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Refresh now
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default LiveConversationMonitor