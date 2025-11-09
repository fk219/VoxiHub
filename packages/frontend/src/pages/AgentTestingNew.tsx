import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import {
  MdSend,
  MdMic,
  MdMicOff,
  MdPhone,
  MdPhoneDisabled,
  MdChat,
  MdRecordVoiceOver,
  MdArrowBack,
  MdVolumeUp,
  MdClear,
} from 'react-icons/md';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

interface Message {
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

const AgentTestingNew: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [agent, setAgent] = useState<any>(null);
  const [mode, setMode] = useState<'chat' | 'voice'>('chat');
  const [loading, setLoading] = useState(true);
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  
  // Voice state with speech recognition
  const {
    transcript,
    listening,
    finalTranscript,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable
  } = useSpeechRecognition();
  
  const [isCallActive, setIsCallActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [agentTranscript, setAgentTranscript] = useState('');
  const [conversationHistory, setConversationHistory] = useState<Array<{role: string, text: string}>>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    loadAgent();
    return () => {
      SpeechRecognition.stopListening();
      stopAudio();
    };
  }, [id]);

  // Handle speech recognition state changes
  useEffect(() => {
    if (!isCallActive) return;

    // When user finishes speaking (finalTranscript is set)
    if (finalTranscript && !processingRef.current) {
      processingRef.current = true;
      handleVoiceInput(finalTranscript);
    }
  }, [finalTranscript, isCallActive]);

  // Auto-restart listening after agent finishes speaking
  useEffect(() => {
    if (isCallActive && !listening && !isProcessing && !isSpeaking) {
      // Small delay before restarting
      const timer = setTimeout(() => {
        if (isCallActive) {
          SpeechRecognition.startListening({ continuous: false });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isCallActive, listening, isProcessing, isSpeaking]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadAgent = async () => {
    try {
      const agentData = await apiClient.getAgent(id!);
      setAgent(agentData);
      
      // Add welcome message
      setMessages([{
        role: 'agent',
        content: `Hello! I'm ${agentData.name}. ${agentData.description || 'How can I help you today?'}`,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Failed to load agent:', error);
      toast.error('Failed to load agent');
      navigate('/agents');
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ============ CHAT FUNCTIONS ============
  
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || sending) return;

    const userMessage: Message = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setSending(true);

    try {
      const response: any = await apiClient.post(`/api/agent-testing/${id}/chat`, {
        message: currentInput,
        conversationHistory: messages.map(m => ({ role: m.role, content: m.content }))
      });

      const agentMessage: Message = {
        role: 'agent',
        content: response.response || 'I apologize, but I couldn\'t generate a response.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, agentMessage]);
    } catch (error: any) {
      console.error('Failed to send message:', error);
      toast.error(error.response?.data?.error || 'Failed to send message');
      
      const errorMessage: Message = {
        role: 'agent',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
      role: 'agent',
      content: `Hello! I'm ${agent.name}. ${agent.description || 'How can I help you today?'}`,
      timestamp: new Date()
    }]);
    toast.success('Chat cleared');
  };

  // ============ VOICE FUNCTIONS ============
  
  const startCall = async () => {
    if (!browserSupportsSpeechRecognition) {
      toast.error('Your browser does not support speech recognition. Please use Chrome.');
      return;
    }

    if (!isMicrophoneAvailable) {
      toast.error('Microphone access is required for voice calls');
      return;
    }

    try {
      setIsCallActive(true);
      setAgentTranscript('');
      setConversationHistory([]);
      resetTranscript();
      
      // Start listening immediately
      SpeechRecognition.startListening({ continuous: false });
      
      toast.success('Call started - Speak naturally, I\'m listening!');
    } catch (error) {
      console.error('Failed to start call:', error);
      toast.error('Failed to start voice call');
    }
  };

  const endCall = () => {
    setIsCallActive(false);
    SpeechRecognition.stopListening();
    stopAudio();
    setAgentTranscript('');
    resetTranscript();
    processingRef.current = false;
    toast.success('Call ended');
  };

  const handleVoiceInput = async (text: string) => {
    if (!text.trim()) {
      processingRef.current = false;
      return;
    }

    setIsProcessing(true);
    SpeechRecognition.stopListening();

    try {
      // Add user message to history
      const newHistory = [...conversationHistory, { role: 'user', text }];
      setConversationHistory(newHistory);

      // Send to backend chat endpoint (using text, not audio)
      const response: any = await apiClient.post(`/api/agent-testing/${id}/chat`, {
        message: text,
        conversationHistory: newHistory.map(h => ({ role: h.role, content: h.text }))
      });

      const agentResponse = response.response || 'I apologize, but I couldn\'t generate a response.';
      setAgentTranscript(agentResponse);

      // Add agent response to history
      setConversationHistory([...newHistory, { role: 'agent', text: agentResponse }]);

      // Speak the response using TTS
      await speakResponse(agentResponse);

      // Reset transcript for next input
      resetTranscript();
      processingRef.current = false;

    } catch (error: any) {
      console.error('Voice processing failed:', error);
      toast.error(error.response?.data?.error || 'Failed to process voice input');
      setAgentTranscript('Sorry, I encountered an error.');
      processingRef.current = false;
      resetTranscript();
    } finally {
      setIsProcessing(false);
    }
  };

  const speakResponse = async (text: string) => {
    try {
      setIsSpeaking(true);

      // Use TTS endpoint
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/agent-testing/${id}/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text, voice: 'Fritz-PlayAI' })
      });

      if (!response.ok) {
        throw new Error('TTS failed');
      }

      const audioData = await response.arrayBuffer();
      await playAudio(audioData);

    } catch (error) {
      console.error('TTS failed:', error);
      // Continue without audio
      setIsSpeaking(false);
    }
  };

  const playAudio = async (audioData: ArrayBuffer) => {
    return new Promise<void>((resolve, reject) => {
      try {
        const blob = new Blob([audioData], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onerror = (error) => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          reject(error);
        };

        audio.play();
      } catch (error) {
        reject(error);
      }
    });
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsSpeaking(false);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!agent) {
    return null;
  }

  return (
    <div style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="card" style={{ marginBottom: '16px', flexShrink: 0 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => navigate('/agents')}
              style={{
                padding: '8px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                background: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: '#64748b'
              }}
            >
              <MdArrowBack size={20} />
            </button>
            <div>
              <h2 className="card-title">Test Agent: {agent.name}</h2>
              <p className="card-subtitle">{agent.description}</p>
            </div>
          </div>
          
          {/* Mode Toggle */}
          <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
            <button
              onClick={() => setMode('chat')}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                background: mode === 'chat' ? 'white' : 'transparent',
                color: mode === 'chat' ? '#0f172a' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: mode === 'chat' ? 500 : 400,
                boxShadow: mode === 'chat' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              <MdChat size={18} />
              Chat
            </button>
            <button
              onClick={() => setMode('voice')}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                background: mode === 'voice' ? 'white' : 'transparent',
                color: mode === 'voice' ? '#0f172a' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: mode === 'voice' ? 500 : 400,
                boxShadow: mode === 'voice' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              <MdRecordVoiceOver size={18} />
              Voice
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {mode === 'chat' ? (
        // ============ CHAT MODE ============
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Chat Header */}
          <div style={{ 
            padding: '12px 24px', 
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#64748b' }}>
              {messages.length - 1} messages
            </div>
            <button
              onClick={clearChat}
              style={{
                padding: '6px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                background: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                color: '#64748b'
              }}
            >
              <MdClear size={16} />
              Clear
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', minHeight: 0 }}>
            {messages.map((message, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: '16px'
                }}
              >
                <div
                  style={{
                    maxWidth: '70%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: message.role === 'user' 
                      ? 'linear-gradient(135deg, #a3e635 0%, #84cc16 100%)'
                      : '#f8fafc',
                    color: message.role === 'user' ? 'white' : '#0f172a',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  {message.content}
                  <div style={{
                    fontSize: '11px',
                    marginTop: '6px',
                    opacity: 0.7
                  }}>
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {sending && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  fontSize: '14px',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ borderTop: '1px solid #f1f5f9', padding: '16px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message... (Press Enter to send)"
                disabled={sending}
                rows={1}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  resize: 'none',
                  fontFamily: 'inherit',
                  minHeight: '44px',
                  maxHeight: '120px'
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || sending}
                className="btn btn-primary"
                style={{ minWidth: '100px', height: '44px' }}
              >
                <MdSend size={18} />
                Send
              </button>
            </div>
          </div>
        </div>
      ) : (
        // ============ VOICE MODE ============
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
          {!isCallActive ? (
            // Call Start Screen
            <div style={{ textAlign: 'center', maxWidth: '500px' }}>
              <div style={{
                width: '140px',
                height: '140px',
                margin: '0 auto 32px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #a3e635 0%, #84cc16 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 12px 32px rgba(132, 204, 22, 0.3)'
              }}>
                <MdPhone size={56} color="white" />
              </div>
              
              <h3 style={{ fontSize: '28px', fontWeight: 500, color: '#0f172a', marginBottom: '16px' }}>
                Voice Call Testing
              </h3>
              <p style={{ fontSize: '15px', color: '#64748b', marginBottom: '40px', lineHeight: '1.6' }}>
                Test your agent's voice capabilities with real-time speech recognition and text-to-speech. 
                Speak naturally and see live transcripts of the conversation.
              </p>
              
              <button
                onClick={startCall}
                className="btn btn-primary"
                style={{ padding: '16px 40px', fontSize: '16px', fontWeight: 500 }}
              >
                <MdPhone size={22} />
                Start Voice Call
              </button>
            </div>
          ) : (
            // Active Call Screen
            <div style={{ width: '100%', maxWidth: '700px' }}>
              {/* Call Status Indicator */}
              <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                <div style={{
                  width: '120px',
                  height: '120px',
                  margin: '0 auto 24px',
                  borderRadius: '50%',
                  background: isSpeaking 
                    ? 'linear-gradient(135deg, #a3e635 0%, #84cc16 100%)'
                    : listening
                    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                    : isProcessing
                    ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                    : '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: (isSpeaking || listening || isProcessing) ? 'pulse 2s infinite' : 'none',
                  boxShadow: (isSpeaking || listening || isProcessing) ? '0 12px 32px rgba(132, 204, 22, 0.4)' : 'none',
                  transition: 'all 0.3s ease'
                }}>
                  {isSpeaking ? (
                    <MdVolumeUp size={48} color="white" />
                  ) : listening ? (
                    <MdMic size={48} color="white" />
                  ) : isProcessing ? (
                    <div className="spinner" style={{ width: '48px', height: '48px', borderColor: 'white', borderTopColor: 'transparent' }}></div>
                  ) : (
                    <MdMic size={48} color="#94a3b8" />
                  )}
                </div>
                
                <div style={{ fontSize: '16px', fontWeight: 500, color: '#0f172a', marginBottom: '8px' }}>
                  {isSpeaking ? '🔊 Agent Speaking...' : listening ? '🎤 Listening...' : isProcessing ? '⚙️ Processing...' : '✨ Ready to listen'}
                </div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>
                  {listening ? 'Speak naturally, I\'m listening' : isProcessing ? 'Generating response...' : isSpeaking ? 'Playing response' : 'Waiting for your voice...'}
                </div>
              </div>

              {/* Live Transcript Display */}
              <div style={{ marginBottom: '40px', minHeight: '200px' }}>
                {/* User Transcript - Shows LIVE as user speaks */}
                {(transcript || finalTranscript) && (
                  <div style={{
                    padding: '20px',
                    background: listening 
                      ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' 
                      : 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                    borderRadius: '16px',
                    marginBottom: '16px',
                    border: listening ? '2px solid #f59e0b' : '2px solid #84cc16',
                    boxShadow: '0 4px 12px rgba(132, 204, 22, 0.1)',
                    transition: 'all 0.3s ease'
                  }}>
                    <div style={{ 
                      fontSize: '12px', 
                      fontWeight: 600, 
                      color: listening ? '#d97706' : '#65a30d', 
                      marginBottom: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      {listening ? '🎤 Speaking (Live)...' : '✓ You Said:'}
                    </div>
                    <div style={{ 
                      fontSize: '15px', 
                      color: '#0f172a', 
                      lineHeight: '1.7',
                      whiteSpace: 'pre-wrap',
                      fontStyle: listening ? 'italic' : 'normal'
                    }}>
                      {transcript || finalTranscript}
                    </div>
                  </div>
                )}

                {/* Agent Response */}
                {agentTranscript && (
                  <div style={{
                    padding: '20px',
                    background: '#f8fafc',
                    borderRadius: '16px',
                    border: '2px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
                  }}>
                    <div style={{ 
                      fontSize: '12px', 
                      fontWeight: 600, 
                      color: '#64748b', 
                      marginBottom: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      {isSpeaking ? '🔊 Agent Speaking...' : '✓ Agent Response:'}
                    </div>
                    <div style={{ 
                      fontSize: '15px', 
                      color: '#0f172a', 
                      lineHeight: '1.7',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {agentTranscript}
                    </div>
                  </div>
                )}

                {!transcript && !finalTranscript && !agentTranscript && (
                  <div style={{
                    padding: '48px',
                    textAlign: 'center',
                    color: '#94a3b8',
                    fontSize: '15px',
                    border: '2px dashed #e2e8f0',
                    borderRadius: '16px'
                  }}>
                    {listening ? '🎤 Listening... Start speaking!' : '✨ Transcripts will appear here as you speak'}
                  </div>
                )}
              </div>

              {/* Call Controls */}
              <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                <button
                  onClick={endCall}
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    border: 'none',
                    background: '#ef4444',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 20px rgba(239, 68, 68, 0.4)',
                    transition: 'all 0.2s'
                  }}
                >
                  <MdPhoneDisabled size={32} />
                </button>
              </div>

              {/* Instructions */}
              <div style={{
                marginTop: '32px',
                padding: '16px',
                background: '#f8fafc',
                borderRadius: '12px',
                fontSize: '13px',
                color: '#64748b',
                textAlign: 'center'
              }}>
                💡 <strong>Active Listening:</strong> Speak naturally - I'm always listening and will respond automatically!
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.9;
          }
        }
        
        .spinner {
          border: 3px solid #f3f4f6;
          border-top: 3px solid #84cc16;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AgentTestingNew;
