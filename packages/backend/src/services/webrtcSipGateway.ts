import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { logger } from '../utils/logger';

export interface WebRTCSession {
  id: string;
  callId: string;
  websocket: WebSocket;
  peerConnection?: RTCPeerConnection;
  audioTrack?: MediaStreamTrack;
  isConnected: boolean;
  createdAt: Date;
}

export interface SipAudioBridge {
  callId: string;
  webrtcSession: WebRTCSession;
  sipSession: any; // SIP.js session
  isActive: boolean;
}

/**
 * WebRTC-SIP Gateway handles audio bridging between WebRTC clients and SIP calls
 */
export class WebRTCSipGateway extends EventEmitter {
  private webrtcSessions: Map<string, WebRTCSession> = new Map();
  private audioBridges: Map<string, SipAudioBridge> = new Map();
  private wsServer?: WebSocket.Server;

  constructor() {
    super();
  }

  /**
   * Initialize WebRTC-SIP gateway
   */
  async initialize(port: number = 8080): Promise<void> {
    try {
      logger.info(`Initializing WebRTC-SIP gateway on port ${port}...`);

      // Create WebSocket server for WebRTC signaling
      this.wsServer = new WebSocket.Server({ 
        port,
        perMessageDeflate: false
      });

      this.wsServer.on('connection', (ws: WebSocket, req) => {
        this.handleWebSocketConnection(ws, req);
      });

      this.wsServer.on('error', (error) => {
        logger.error('WebSocket server error:', error);
      });

      logger.info(`WebRTC-SIP gateway initialized on port ${port}`);
    } catch (error) {
      logger.error('Failed to initialize WebRTC-SIP gateway:', error);
      throw error;
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleWebSocketConnection(ws: WebSocket, req: any): void {
    const sessionId = this.generateSessionId();
    const session: WebRTCSession = {
      id: sessionId,
      callId: '',
      websocket: ws,
      isConnected: true,
      createdAt: new Date()
    };

    this.webrtcSessions.set(sessionId, session);
    logger.info(`New WebRTC session ${sessionId} connected`);

    // Handle WebSocket messages
    ws.on('message', (data: WebSocket.Data) => {
      this.handleWebSocketMessage(sessionId, data);
    });

    // Handle WebSocket close
    ws.on('close', () => {
      this.handleWebSocketClose(sessionId);
    });

    // Handle WebSocket error
    ws.on('error', (error) => {
      logger.error(`WebSocket error for session ${sessionId}:`, error);
      this.handleWebSocketClose(sessionId);
    });

    // Send session ID to client
    this.sendMessage(sessionId, {
      type: 'session-created',
      sessionId
    });
  }

  /**
   * Handle WebSocket message
   */
  private async handleWebSocketMessage(sessionId: string, data: WebSocket.Data): Promise<void> {
    try {
      const message = JSON.parse(data.toString());
      const session = this.webrtcSessions.get(sessionId);

      if (!session) {
        logger.warn(`Session ${sessionId} not found`);
        return;
      }

      switch (message.type) {
        case 'join-call':
          await this.handleJoinCall(sessionId, message.callId);
          break;

        case 'offer':
          await this.handleWebRTCOffer(sessionId, message.offer);
          break;

        case 'answer':
          await this.handleWebRTCAnswer(sessionId, message.answer);
          break;

        case 'ice-candidate':
          await this.handleICECandidate(sessionId, message.candidate);
          break;

        case 'leave-call':
          await this.handleLeaveCall(sessionId);
          break;

        default:
          logger.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.error(`Failed to handle WebSocket message for session ${sessionId}:`, error);
    }
  }

  /**
   * Handle join call request
   */
  private async handleJoinCall(sessionId: string, callId: string): Promise<void> {
    const session = this.webrtcSessions.get(sessionId);
    if (!session) return;

    session.callId = callId;
    logger.info(`Session ${sessionId} joining call ${callId}`);

    // Create RTCPeerConnection
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    session.peerConnection = peerConnection;

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendMessage(sessionId, {
          type: 'ice-candidate',
          candidate: event.candidate
        });
      }
    };

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      logger.debug(`Received track for session ${sessionId}`);
      if (event.track.kind === 'audio') {
        session.audioTrack = event.track;
        this.emit('audioTrackReceived', { sessionId, callId, track: event.track });
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      logger.debug(`Connection state for session ${sessionId}: ${peerConnection.connectionState}`);
      if (peerConnection.connectionState === 'connected') {
        this.emit('webrtcConnected', { sessionId, callId });
      } else if (peerConnection.connectionState === 'disconnected' || 
                 peerConnection.connectionState === 'failed') {
        this.handleWebSocketClose(sessionId);
      }
    };

    this.sendMessage(sessionId, {
      type: 'call-joined',
      callId
    });
  }

  /**
   * Handle WebRTC offer
   */
  private async handleWebRTCOffer(sessionId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    const session = this.webrtcSessions.get(sessionId);
    if (!session?.peerConnection) return;

    try {
      await session.peerConnection.setRemoteDescription(offer);
      
      // Create answer
      const answer = await session.peerConnection.createAnswer();
      await session.peerConnection.setLocalDescription(answer);

      this.sendMessage(sessionId, {
        type: 'answer',
        answer
      });

      logger.debug(`Created answer for session ${sessionId}`);
    } catch (error) {
      logger.error(`Failed to handle WebRTC offer for session ${sessionId}:`, error);
    }
  }

  /**
   * Handle WebRTC answer
   */
  private async handleWebRTCAnswer(sessionId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const session = this.webrtcSessions.get(sessionId);
    if (!session?.peerConnection) return;

    try {
      await session.peerConnection.setRemoteDescription(answer);
      logger.debug(`Set remote description for session ${sessionId}`);
    } catch (error) {
      logger.error(`Failed to handle WebRTC answer for session ${sessionId}:`, error);
    }
  }

  /**
   * Handle ICE candidate
   */
  private async handleICECandidate(sessionId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const session = this.webrtcSessions.get(sessionId);
    if (!session?.peerConnection) return;

    try {
      await session.peerConnection.addIceCandidate(candidate);
      logger.debug(`Added ICE candidate for session ${sessionId}`);
    } catch (error) {
      logger.error(`Failed to add ICE candidate for session ${sessionId}:`, error);
    }
  }

  /**
   * Handle leave call
   */
  private async handleLeaveCall(sessionId: string): Promise<void> {
    const session = this.webrtcSessions.get(sessionId);
    if (!session) return;

    logger.info(`Session ${sessionId} leaving call ${session.callId}`);

    // Remove audio bridge
    if (session.callId) {
      this.removeAudioBridge(session.callId);
    }

    // Close peer connection
    if (session.peerConnection) {
      session.peerConnection.close();
      session.peerConnection = undefined;
    }

    session.callId = '';
    session.audioTrack = undefined;

    this.sendMessage(sessionId, {
      type: 'call-left'
    });
  }

  /**
   * Handle WebSocket close
   */
  private handleWebSocketClose(sessionId: string): void {
    const session = this.webrtcSessions.get(sessionId);
    if (!session) return;

    logger.info(`WebRTC session ${sessionId} disconnected`);

    // Clean up call if active
    if (session.callId) {
      this.handleLeaveCall(sessionId);
    }

    // Close peer connection
    if (session.peerConnection) {
      session.peerConnection.close();
    }

    // Remove session
    this.webrtcSessions.delete(sessionId);
  }

  /**
   * Create audio bridge between WebRTC and SIP
   */
  createAudioBridge(callId: string, sipSession: any): void {
    const webrtcSession = Array.from(this.webrtcSessions.values())
      .find(session => session.callId === callId);

    if (!webrtcSession) {
      logger.warn(`No WebRTC session found for call ${callId}`);
      return;
    }

    const bridge: SipAudioBridge = {
      callId,
      webrtcSession,
      sipSession,
      isActive: true
    };

    this.audioBridges.set(callId, bridge);
    logger.info(`Created audio bridge for call ${callId}`);

    // Start audio bridging
    this.startAudioBridging(bridge);
  }

  /**
   * Remove audio bridge
   */
  removeAudioBridge(callId: string): void {
    const bridge = this.audioBridges.get(callId);
    if (!bridge) return;

    bridge.isActive = false;
    this.audioBridges.delete(callId);
    logger.info(`Removed audio bridge for call ${callId}`);
  }

  /**
   * Start audio bridging between WebRTC and SIP
   */
  private startAudioBridging(bridge: SipAudioBridge): void {
    // TODO: Implement actual audio bridging
    // This would involve:
    // 1. Capturing audio from WebRTC peer connection
    // 2. Converting audio format for SIP (PCM, specific sample rate)
    // 3. Sending audio to SIP session
    // 4. Receiving audio from SIP session
    // 5. Converting and sending to WebRTC peer connection

    logger.debug(`Starting audio bridging for call ${bridge.callId}`);
    
    // For now, just emit events for audio processing
    this.emit('audioBridgeStarted', bridge);
  }

  /**
   * Send audio data to WebRTC session
   */
  sendAudioToWebRTC(callId: string, audioData: Buffer): void {
    const bridge = this.audioBridges.get(callId);
    if (!bridge?.isActive) return;

    // TODO: Convert audio data and send to WebRTC peer connection
    logger.debug(`Sending audio to WebRTC for call ${callId}`);
  }

  /**
   * Send audio data to SIP session
   */
  sendAudioToSIP(callId: string, audioData: Buffer): void {
    const bridge = this.audioBridges.get(callId);
    if (!bridge?.isActive) return;

    // TODO: Convert audio data and send to SIP session
    logger.debug(`Sending audio to SIP for call ${callId}`);
  }

  /**
   * Send message to WebRTC session
   */
  private sendMessage(sessionId: string, message: any): void {
    const session = this.webrtcSessions.get(sessionId);
    if (!session?.isConnected) return;

    try {
      session.websocket.send(JSON.stringify(message));
    } catch (error) {
      logger.error(`Failed to send message to session ${sessionId}:`, error);
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `webrtc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get active WebRTC sessions
   */
  getActiveSessions(): WebRTCSession[] {
    return Array.from(this.webrtcSessions.values());
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): WebRTCSession | undefined {
    return this.webrtcSessions.get(sessionId);
  }

  /**
   * Get active audio bridges
   */
  getActiveBridges(): SipAudioBridge[] {
    return Array.from(this.audioBridges.values());
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up WebRTC-SIP gateway...');

    // Close all WebRTC sessions
    for (const session of this.webrtcSessions.values()) {
      if (session.peerConnection) {
        session.peerConnection.close();
      }
      if (session.websocket.readyState === WebSocket.OPEN) {
        session.websocket.close();
      }
    }

    // Clear all bridges
    this.audioBridges.clear();
    this.webrtcSessions.clear();

    // Close WebSocket server
    if (this.wsServer) {
      this.wsServer.close();
    }

    logger.info('WebRTC-SIP gateway cleanup completed');
  }
}