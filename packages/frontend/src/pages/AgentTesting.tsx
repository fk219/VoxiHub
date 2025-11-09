import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  MdSettings,
} from 'react-icons/md';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

interface Message {
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

const AgentTesting: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [agent, setAgent] = useState<any>(null);
  const [mode, setMode] = useState<'chat' | 'voice'>('chat');
  const [loading, setLoading] = useState(true);
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  
  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [agentResponse, setAgentResponse] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    loadAgent();
    initializeSpeechRecognition();
    
    return () => {
      stopSpeechRecognition();
      stopSpeechSynthesis();
    };
  }, [id]);

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
    setInputMessage('');
    setSending(true);

    try {
      const response = await apiClient.post(`/api/agents/${id}/test`, {
        message: inputMessage
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

  // ============ VOICE FUNCTIONS ============
  
  const initializeSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        setTranscript(finalTranscript || interimTranscript);

        if (finalTranscript) {
          handleVoiceInput(finalTranscript.trim());
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          toast.error('Speech recognition error: ' + event.error);
        }
      };
    }
  };

  const startCall = () => {
    setIsCallActive(true);
    setTranscript('');
    setAgentResponse('');
    startListening();
    toast.success('Call started');
  };

  const endCall = () => {
    setIsCallActive(false);
    stopListening();
    stopSpeechSynthesis();
    setTranscript('');
    setAgentResponse('');
    toast.success('Call ended');
  };

  const startListening = () => {
    if (recognitionRef.current && !isRecording) {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (error) {
        console.error('Failed to start recognition:', error);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.stop();
        setIsRecording(false);
      } catch (error) {
        console.error('Failed to stop recognition:', error);
      }
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        // Ignore
      }
    }
  };

  const handleVoiceInput = async (text: string) => {
    if (!text.trim()) return;

    try {
      const response = await apiClient.post(`/api/agents/${id}/test`, {
        message: text
      });

      const responseText = response.response || 'I apologize, but I couldn\'t generate a response.';
      setAgentResponse(responseText);
      
      // Speak the response
      speakText(responseText);
    } catch (error: any) {
      console.error('Failed to process voice input:', error);
      const errorText = 'Sorry, I encountered an error processing your request.';
      setAgentResponse(errorText);
      speakText(errorText);
    }
  };

  const speakText = (text: string) => {
    stopSpeechSynthesis();

    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        // Clear transcript after speaking
        setTimeout(() => {
          setTranscript('');
          setAgentResponse('');
        }, 1000);
      };
      utterance.onerror = () => setIsSpeaking(false);

      synthesisRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeechSynthesis = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const toggleMute = () => {
    if (isRecording) {
      stopListening();
    } else {
      startListening();
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
                fontWeight: mode === 'chat' ? 400 : 300,
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
                fontWeight: mode === 'voice' ? 400 : 300,
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
                    fontWeight: 300,
                    lineHeight: '1.6',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  {message.content}
                  <div style={{
                    fontSize: '11px',
                    marginTop: '4px',
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
                  color: '#64748b'
                }}>
                  <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ borderTop: '1px solid #f1f5f9', padding: '16px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                disabled={sending}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 300
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || sending}
                className="btn btn-primary"
                style={{ minWidth: '100px' }}
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
            <div style={{ textAlign: 'center', maxWidth: '400px' }}>
              <div style={{
                width: '120px',
                height: '120px',
                margin: '0 auto 32px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #a3e635 0%, #84cc16 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(132, 204, 22, 0.3)'
              }}>
                <MdPhone size={48} color="white" />
              </div>
              
              <h3 style={{ fontSize: '24px', fontWeight: 400, color: '#0f172a', marginBottom: '12px' }}>
                Voice Call Test
              </h3>
              <p style={{ fontSize: '14px', fontWeight: 300, color: '#64748b', marginBottom: '32px' }}>
                Start a voice call to test your agent's speech recognition and response capabilities
              </p>
              
              <button
                onClick={startCall}
                className="btn btn-primary"
                style={{ padding: '16px 32px', fontSize: '16px' }}
              >
                <MdPhone size={20} />
                Start Call
              </button>
            </div>
          ) : (
            // Active Call Screen
            <div style={{ width: '100%', maxWidth: '600px' }}>
              {/* Call Status */}
              <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                <div style={{
                  width: '100px',
                  height: '100px',
                  margin: '0 auto 24px',
                  borderRadius: '50%',
                  background: isSpeaking 
                    ? 'linear-gradient(135deg, #a3e635 0%, #84cc16 100%)'
                    : isRecording
                    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                    : '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: (isSpeaking || isRecording) ? 'pulse 2s infinite' : 'none',
                  boxShadow: (isSpeaking || isRecording) ? '0 8px 24px rgba(132, 204, 22, 0.3)' : 'none'
                }}>
                  {isSpeaking ? (
                    <MdVolumeUp size={40} color="white" />
                  ) : isRecording ? (
                    <MdMic size={40} color="white" />
                  ) : (
                    <MdMicOff size={40} color="#94a3b8" />
                  )}
                </div>
                
                <div style={{ fontSize: '14px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                  {isSpeaking ? 'Agent Speaking...' : isRecording ? 'Listening...' : 'Muted'}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 300, color: '#64748b' }}>
                  Call Active
                </div>
              </div>

              {/* Transcript Display */}
              <div style={{ marginBottom: '32px' }}>
                {/* User Transcript */}
                {transcript && (
                  <div style={{
                    padding: '16px',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    marginBottom: '12px',
                    border: '2px solid #e2e8f0'
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 400, color: '#64748b', marginBottom: '8px' }}>
                      You:
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 300, color: '#0f172a', lineHeight: '1.6' }}>
                      {transcript}
                    </div>
                  </div>
                )}

                {/* Agent Response */}
                {agentResponse && (
                  <div style={{
                    padding: '16px',
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                    borderRadius: '12px',
                    border: '2px solid #84cc16'
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 400, color: '#65a30d', marginBottom: '8px' }}>
                      Agent:
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 300, color: '#0f172a', lineHeight: '1.6' }}>
                      {agentResponse}
                    </div>
                  </div>
                )}

                {!transcript && !agentResponse && (
                  <div style={{
                    padding: '32px',
                    textAlign: 'center',
                    color: '#94a3b8',
                    fontSize: '14px',
                    fontWeight: 300
                  }}>
                    {isRecording ? 'Start speaking...' : 'Click the microphone to start'}
                  </div>
                )}
              </div>

              {/* Call Controls */}
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                <button
                  onClick={toggleMute}
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    border: 'none',
                    background: isRecording ? '#ef4444' : '#f1f5f9',
                    color: isRecording ? 'white' : '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    transition: 'all 0.2s'
                  }}
                >
                  {isRecording ? <MdMic size={28} /> : <MdMicOff size={28} />}
                </button>
                
                <button
                  onClick={endCall}
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    border: 'none',
                    background: '#ef4444',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                    transition: 'all 0.2s'
                  }}
                >
                  <MdPhoneDisabled size={28} />
                </button>
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
      `}</style>
    </div>
  );
};

export default AgentTesting;
