import React from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'

const AgentList: React.FC = () => {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-900">AI Agents</h2>
        <Link
          to="/agents/new"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Agent
        </Link>
      </div>
      
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <p className="text-gray-600 text-center">
            No agents created yet. Create your first AI agent to get started.
          </p>
        </div>
      </div>
    </div>
  )
}

export default AgentList