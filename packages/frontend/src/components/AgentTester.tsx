import React, { useState, useRef, useEffect } from 'react';
import {
  MdSend,
  MdMic,
  MdMicOff,
  MdPhone,
  MdPhoneDisabled,
  MdChat,
  MdVolumeUp,
  MdDelete,
  MdRefresh
} from 'react-icons/md';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  functionCalls?: any[];
}

interface AgentTesterProps {
  agentId: string;
  agentName: string;
}

const AgentTester: React.FC<AgentTesterProps> = ({ agentId, agentName }) => {
  const [mode, setMode] = useState<'chat' | 'voice'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  
  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, []);

  // Chat functions
  const sendMessage = async () => {
    if (!inputMessage.trim() || sending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages([...messages, userMessage]);
    setInputMessage('');
    setSending(true);

    try {
      const response = await apiClient.post(`/api/agents/${agentId}/test`, {
        message: inputMessage
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date(),
        functionCalls: response.data.functionCall ? [response.data.functionCall] : []
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Failed to send message:', error);
      toast.error(error.response?.data?.error || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  // Voice functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await processVoiceInput(audioBlob);
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.success('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.success('Recording stopped');
    }
  };

  const processVoiceInput = async (audioBlob: Blob) => {
    setSending(true);
    try {
      // Convert speech to text
      const formData = new FormData();
      formData.append('audio', audioBlob);
      
      const sttResponse = await apiClient.post('/api/stt/transcribe', formData);
      const transcription = sttResponse.data.text;

      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: transcription,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);

      // Get agent response
      const response = await apiClient.post(`/api/agents/${agentId}/test`, {
        message: transcription
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Convert response to speech
      const ttsResponse = await apiClient.post('/api/tts/synthesize', {
        text: response.data.response
      }, { responseType: 'blob' });

      const audioUrl = URL.createObjectURL(ttsResponse.data);
      const audio = new Audio(audioUrl);
      audio.play();

    } catch (error) {
      console.error('Failed to process voice input:', error);
      toast.error('Failed to process voice input');
    } finally {
      setSending(false);
    }
  };

  const startCall = () => {
    setIsCallActive(true);
    setCallDuration(0);
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    toast.success('Call started');
  };

  const endCall = () => {
    setIsCallActive(false);
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
    toast.success('Call ended');
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '600px' }}>
      {/* Mode Toggle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setMode('chat')}
          style={{
            flex: 1,
            padding: '12px',
            border: 'none',
            borderRadius: '8px',
            background: mode === 'chat' ? 'linear-gradient(135deg, #a3e635 0%, #84cc16 100%)' : '#f1f5f9',
            color: mode === 'chat' ? 'white' : '#64748b',
            fontSize: '14px',
            fontWeight: 300,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <MdChat size={20} />
          Chat Test
        </button>
        <button
          onClick={() => setMode('voice')}
          style={{
            flex: 1,
            padding: '12px',
            border: 'none',
            borderRadius: '8px',
            background: mode === 'voice' ? 'linear-gradient(135deg, #a3e635 0%, #84cc16 100%)' : '#f1f5f9',
            color: mode === 'voice' ? 'white' : '#64748b',
            fontSize: '14px',
            fontWeight: 300,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <MdVolumeUp size={20} />
          Voice Test
        </button>
      </div>

      {/* Chat Mode */}
      {mode === 'chat' && (
        <>
          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            background: '#f8fafc',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: '#64748b' }}>
                <MdChat size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                <p style={{ fontSize: '14px', fontWeight: 300 }}>
                  Start a conversation with {agentName}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '70%'
                    }}
                  >
                    <div style={{
                      padding: '12px 16px',
                      borderRadius: '12px',
                      background: msg.role === 'user' 
                        ? 'linear-gradient(135deg, #a3e635 0%, #84cc16 100%)'
                        : 'white',
                      color: msg.role === 'user' ? 'white' : '#0f172a',
                      fontSize: '14px',
                      fontWeight: 300,
                      lineHeight: '1.5',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                    }}>
                      {msg.content}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 300,
                      color: '#64748b',
                      marginTop: '4px',
                      textAlign: msg.role === 'user' ? 'right' : 'left'
                    }}>
                      {msg.timestamp.toLocaleTimeString()}
                    </div>
                    {msg.functionCalls && msg.functionCalls.length > 0 && (
                      <div style={{
                        fontSize: '11px',
                        fontWeight: 300,
                        color: '#84cc16',
                        marginTop: '4px',
                        padding: '4px 8px',
                        background: '#f0fdf4',
                        borderRadius: '4px',
                        display: 'inline-block'
                      }}>
                        🔧 Function: {msg.functionCalls[0].name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={clearChat}
              disabled={messages.length === 0}
              style={{
                padding: '12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                background: 'white',
                cursor: messages.length === 0 ? 'not-allowed' : 'pointer',
                color: '#64748b',
                opacity: messages.length === 0 ? 0.5 : 1
              }}
            >
              <MdDelete size={20} />
            </button>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
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
              onClick={sendMessage}
              disabled={!inputMessage.trim() || sending}
              className="btn btn-primary"
            >
              <MdSend size={20} />
              <span>{sending ? 'Sending...' : 'Send'}</span>
            </button>
          </div>
        </>
      )}

      {/* Voice Mode */}
      {mode === 'voice' && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          borderRadius: '8px',
          padding: '48px'
        }}>
          {!isCallActive ? (
            <>
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #a3e635 0%, #84cc16 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px',
                boxShadow: '0 8px 16px rgba(132, 204, 22, 0.3)'
              }}>
                <MdPhone size={48} style={{ color: 'white' }} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                Voice Test
              </h3>
              <p style={{ fontSize: '14px', fontWeight: 300, color: '#64748b', marginBottom: '32px', textAlign: 'center' }}>
                Start a voice call to test {agentName}
              </p>
              <button onClick={startCall} className="btn btn-primary" style={{ minWidth: '200px' }}>
                <MdPhone size={20} />
                <span>Start Call</span>
              </button>
            </>
          ) : (
            <>
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: isRecording 
                  ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                  : 'linear-gradient(135deg, #a3e635 0%, #84cc16 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px',
                boxShadow: isRecording 
                  ? '0 8px 16px rgba(239, 68, 68, 0.3)'
                  : '0 8px 16px rgba(132, 204, 22, 0.3)',
                animation: isRecording ? 'pulse 1.5s infinite' : 'none'
              }}>
                {isRecording ? (
                  <MdMic size={48} style={{ color: 'white' }} />
                ) : (
                  <MdMicOff size={48} style={{ color: 'white' }} />
                )}
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                {formatDuration(callDuration)}
              </h3>
              <p style={{ fontSize: '14px', fontWeight: 300, color: '#64748b', marginBottom: '32px' }}>
                {isRecording ? 'Listening...' : 'Call in progress'}
              </p>
              <div style={{ display: 'flex', gap: '16px' }}>
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className="btn btn-secondary"
                  style={{ minWidth: '150px' }}
                >
                  {isRecording ? <MdMicOff size={20} /> : <MdMic size={20} />}
                  <span>{isRecording ? 'Stop' : 'Speak'}</span>
                </button>
                <button
                  onClick={endCall}
                  style={{
                    minWidth: '150px',
                    padding: '12px 24px',
                    border: 'none',
                    borderRadius: '8px',
                    background: '#ef4444',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 300,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <MdPhoneDisabled size={20} />
                  <span>End Call</span>
                </button>
              </div>
            </>
          )}

          {/* Recent Messages */}
          {messages.length > 0 && (
            <div style={{
              marginTop: '48px',
              width: '100%',
              maxWidth: '500px'
            }}>
              <h4 style={{ fontSize: '14px', fontWeight: 400, color: '#0f172a', marginBottom: '12px' }}>
                Conversation History
              </h4>
              <div style={{
                maxHeight: '200px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {messages.slice(-5).map(msg => (
                  <div
                    key={msg.id}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: msg.role === 'user' ? '#f0fdf4' : 'white',
                      border: '1px solid #e2e8f0',
                      fontSize: '13px',
                      fontWeight: 300
                    }}
                  >
                    <strong style={{ color: msg.role === 'user' ? '#84cc16' : '#64748b' }}>
                      {msg.role === 'user' ? 'You' : agentName}:
                    </strong>{' '}
                    {msg.content}
                  </div>
                ))}
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

export default AgentTester;
