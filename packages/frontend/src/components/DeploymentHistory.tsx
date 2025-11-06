import React from 'react'
import { Clock, User, Settings } from 'lucide-react'

interface DeploymentHistoryProps {
  agentId: string
}

interface DeploymentEvent {
  id: string
  type: 'widget' | 'sip'
  action: 'created' | 'updated' | 'deployed'
  timestamp: string
  user: string
  changes?: string[]
}

const DeploymentHistory: React.FC<DeploymentHistoryProps> = ({ agentId }) => {
  // Mock data - in real implementation, this would come from API
  const events: DeploymentEvent[] = [
    {
      id: '1',
      type: 'widget',
      action: 'updated',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      user: 'Current User',
      changes: ['Theme changed to dark', 'Position updated to bottom-left']
    },
    {
      id: '2',
      type: 'sip',
      action: 'created',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      user: 'Current User',
      changes: ['Initial SIP configuration']
    }
  ]

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    
    if (diffHours < 1) return 'Less than an hour ago'
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

  const getEventIcon = (type: string) => {
    return type === 'widget' ? <Settings className="w-4 h-4" /> : <Settings className="w-4 h-4" />
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Deployment History</h3>
      
      {events.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No deployment history available</p>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <div key={event.id} className="border-l-2 border-blue-200 pl-4 pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  {getEventIcon(event.type)}
                  <span className="font-medium text-gray-900 capitalize">
                    {event.type} {event.action}
                  </span>
                </div>
                <span className="text-xs text-gray-500">{formatTimestamp(event.timestamp)}</span>
              </div>
              
              <div className="mt-1 text-sm text-gray-600">
                <div className="flex items-center space-x-1">
                  <User className="w-3 h-3" />
                  <span>{event.user}</span>
                </div>
              </div>
              
              {event.changes && event.changes.length > 0 && (
                <div className="mt-2">
                  <ul className="text-xs text-gray-500 space-y-1">
                    {event.changes.map((change, index) => (
                      <li key={index}>• {change}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default DeploymentHistory