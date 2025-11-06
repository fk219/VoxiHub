import React, { useState } from 'react'
import { Send, Mic, MicOff, Volume2, VolumeX } from 'lucide-react'
import { Agent } from '@/types'

interface Message {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: Date
}

interface AgentTesterProps {
  agent: Partial<Agent>
  onClose: () => void
}

const AgentTester: React.FC<AgentTesterProps> = ({ agent, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'agent',
      content: `Hello! I'm ${agent.name || 'your AI agent'}. How can I help you today?`,
      timestamp: new Date()
    }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [loading, setLoading] = useState(false)

  const sendMessage = async () => {
    if (!inputMessage.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setLoading(true)

    // Simulate agent response (in real implementation, this would call the backend)
    setTimeout(() => {
      const agentResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: generateMockResponse(userMessage.content, agent),
        timestamp: new Date()
      }
      setMessages(prev => [...prev, agentResponse])
      setLoading(false)
    }, 1000 + Math.random() * 1000) // Simulate response time
  }

  const generateMockResponse = (userInput: string, agentConfig: Partial<Agent>): string => {
    const tone = agentConfig.personality?.tone || 'professional'
    const style = agentConfig.personality?.style || ''
    
    // Simple mock responses based on tone
    const responses = {
      professional: [
        "Thank you for your inquiry. I'd be happy to assist you with that.",
        "I understand your concern. Let me provide you with the information you need.",
        "Based on my knowledge base, I can help you with this matter."
      ],
      friendly: [
        "Great question! I'm excited to help you out with this.",
        "Hey there! That's something I can definitely help you with.",
        "Thanks for asking! Let me share what I know about that."
      ],
      casual: [
        "Sure thing! I can help you figure that out.",
        "No problem! That's actually pretty straightforward.",
        "Yeah, I've got some info on that for you."
      ],
      formal: [
        "I shall be pleased to provide assistance regarding your inquiry.",
        "Allow me to address your question with the appropriate information.",
        "I am at your service to resolve this matter."
      ]
    }

    const toneResponses = responses[tone] || responses.professional
    return toneResponses[Math.floor(Math.random() * toneResponses.length)]
  }

  const toggleRecording = () => {
    setIsRecording(!isRecording)
    // In real implementation, this would start/stop voice recording
  }

  const toggleSpeaking = () => {
    setIsSpeaking(!isSpeaking)
    // In real implementation, this would enable/disable text-to-speech
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl h-3/4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Testing: {agent.name || 'Untitled Agent'}
            </h3>
            <p className="text-sm text-gray-600 capitalize">
              Tone: {agent.personality?.tone} | Style: {agent.personality?.style || 'Default'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm">{message.content}</p>
                <p className={`text-xs mt-1 ${
                  message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-900 max-w-xs lg:max-w-md px-4 py-2 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-sm text-gray-500">Agent is typing...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleRecording}
              className={`p-2 rounded-lg transition-colors ${
                isRecording
                  ? 'bg-red-100 text-red-600 hover:bg-red-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={isRecording ? 'Stop recording' : 'Start voice input'}
            >
              {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            
            <div className="flex-1 relative">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={1}
                disabled={loading}
              />
            </div>
            
            <button
              onClick={toggleSpeaking}
              className={`p-2 rounded-lg transition-colors ${
                isSpeaking
                  ? 'bg-green-100 text-green-600 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={isSpeaking ? 'Disable voice output' : 'Enable voice output'}
            >
              {isSpeaking ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || loading}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          
          <div className="mt-2 text-xs text-gray-500">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  )
}

export default AgentTester