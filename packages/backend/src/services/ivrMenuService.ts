import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { DTMFService } from './dtmfService';

export interface IVRMenuItem {
  digit: string;
  label: string;
  action: 'submenu' | 'transfer' | 'hangup' | 'agent' | 'custom';
  target?: string; // Submenu ID, phone number, or custom action
  prompt?: string;
}

export interface IVRMenu {
  id: string;
  name: string;
  prompt: string;
  items: IVRMenuItem[];
  timeout?: number;
  maxRetries?: number;
  invalidPrompt?: string;
  timeoutPrompt?: string;
  parentMenuId?: string;
}

export interface IVRSession {
  sessionId: string;
  currentMenuId: string;
  menuStack: string[];
  retryCount: number;
  startTime: number;
  lastActivity: number;
}

/**
 * IVR Menu Service
 * Manages Interactive Voice Response menu navigation
 */
export class IVRMenuService extends EventEmitter {
  private dtmfService: DTMFService;
  private menus: Map<string, IVRMenu> = new Map();
  private sessions: Map<string, IVRSession> = new Map();
  private sessionTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(dtmfService: DTMFService) {
    super();
    this.dtmfService = dtmfService;
    this.setupDTMFListeners();
  }

  /**
   * Setup DTMF event listeners
   */
  private setupDTMFListeners(): void {
    this.dtmfService.on('sequence', (sequence) => {
      this.handleDTMFSequence(sequence.digits);
    });
  }

  /**
   * Register IVR menu
   */
  registerMenu(menu: IVRMenu): void {
    this.menus.set(menu.id, menu);
    logger.info('IVR menu registered', { menuId: menu.id, name: menu.name });
  }

  /**
   * Start IVR session
   */
  startSession(sessionId: string, initialMenuId: string): IVRSession {
    const menu = this.menus.get(initialMenuId);
    if (!menu) {
      throw new Error(`Menu not found: ${initialMenuId}`);
    }

    const session: IVRSession = {
      sessionId,
      currentMenuId: initialMenuId,
      menuStack: [initialMenuId],
      retryCount: 0,
      startTime: Date.now(),
      lastActivity: Date.now(),
    };

    this.sessions.set(sessionId, session);
    this.setSessionTimeout(sessionId);

    // Emit session start event
    this.emit('session_start', { sessionId, menuId: initialMenuId });

    // Play initial menu prompt
    this.playMenuPrompt(sessionId);

    logger.info('IVR session started', { sessionId, menuId: initialMenuId });

    return session;
  }

  /**
   * Handle DTMF sequence
   */
  private handleDTMFSequence(digits: string): void {
    // Find active session (in production, associate with call/session ID)
    const session = Array.from(this.sessions.values())[0];
    if (!session) {
      logger.warn('No active IVR session for DTMF input');
      return;
    }

    this.processMenuInput(session.sessionId, digits);
  }

  /**
   * Process menu input
   */
  processMenuInput(sessionId: string, input: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn('Session not found', { sessionId });
      return;
    }

    const menu = this.menus.get(session.currentMenuId);
    if (!menu) {
      logger.error('Current menu not found', { menuId: session.currentMenuId });
      return;
    }

    // Update last activity
    session.lastActivity = Date.now();
    this.resetSessionTimeout(sessionId);

    // Find matching menu item
    const menuItem = menu.items.find((item) => item.digit === input);

    if (!menuItem) {
      // Invalid input
      this.handleInvalidInput(sessionId);
      return;
    }

    // Reset retry count on valid input
    session.retryCount = 0;

    // Execute menu action
    this.executeMenuAction(sessionId, menuItem);
  }

  /**
   * Execute menu action
   */
  private executeMenuAction(sessionId: string, menuItem: IVRMenuItem): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    logger.info('Executing menu action', {
      sessionId,
      action: menuItem.action,
      label: menuItem.label,
    });

    switch (menuItem.action) {
      case 'submenu':
        this.navigateToSubmenu(sessionId, menuItem.target!);
        break;

      case 'transfer':
        this.emit('transfer', {
          sessionId,
          phoneNumber: menuItem.target,
          label: menuItem.label,
        });
        this.endSession(sessionId);
        break;

      case 'agent':
        this.emit('agent_requested', {
          sessionId,
          label: menuItem.label,
        });
        this.endSession(sessionId);
        break;

      case 'hangup':
        this.emit('hangup', { sessionId });
        this.endSession(sessionId);
        break;

      case 'custom':
        this.emit('custom_action', {
          sessionId,
          action: menuItem.target,
          label: menuItem.label,
        });
        break;

      default:
        logger.warn('Unknown menu action', { action: menuItem.action });
    }
  }

  /**
   * Navigate to submenu
   */
  private navigateToSubmenu(sessionId: string, menuId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const menu = this.menus.get(menuId);
    if (!menu) {
      logger.error('Submenu not found', { menuId });
      return;
    }

    // Add to menu stack
    session.menuStack.push(menuId);
    session.currentMenuId = menuId;

    this.emit('menu_changed', { sessionId, menuId });

    // Play submenu prompt
    this.playMenuPrompt(sessionId);

    logger.info('Navigated to submenu', { sessionId, menuId });
  }

  /**
   * Go back to previous menu
   */
  goBack(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.menuStack.length <= 1) {
      logger.warn('Already at root menu', { sessionId });
      return;
    }

    // Pop current menu
    session.menuStack.pop();
    session.currentMenuId = session.menuStack[session.menuStack.length - 1];

    this.emit('menu_changed', { sessionId, menuId: session.currentMenuId });

    // Play previous menu prompt
    this.playMenuPrompt(sessionId);

    logger.info('Navigated back', { sessionId, menuId: session.currentMenuId });
  }

  /**
   * Play menu prompt
   */
  private playMenuPrompt(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const menu = this.menus.get(session.currentMenuId);
    if (!menu) return;

    this.emit('play_prompt', {
      sessionId,
      prompt: menu.prompt,
      menuId: menu.id,
    });
  }

  /**
   * Handle invalid input
   */
  private handleInvalidInput(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const menu = this.menus.get(session.currentMenuId);
    if (!menu) return;

    session.retryCount++;

    const maxRetries = menu.maxRetries || 3;

    if (session.retryCount >= maxRetries) {
      // Max retries exceeded
      this.emit('max_retries_exceeded', { sessionId });
      this.endSession(sessionId);
      return;
    }

    // Play invalid input prompt
    const prompt = menu.invalidPrompt || 'Invalid input. Please try again.';
    this.emit('play_prompt', {
      sessionId,
      prompt,
      menuId: menu.id,
    });

    logger.warn('Invalid menu input', {
      sessionId,
      retryCount: session.retryCount,
      maxRetries,
    });
  }

  /**
   * Handle session timeout
   */
  private handleSessionTimeout(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const menu = this.menus.get(session.currentMenuId);
    const prompt = menu?.timeoutPrompt || 'Session timeout. Goodbye.';

    this.emit('session_timeout', { sessionId, prompt });
    this.endSession(sessionId);

    logger.info('IVR session timeout', { sessionId });
  }

  /**
   * Set session timeout
   */
  private setSessionTimeout(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const menu = this.menus.get(session.currentMenuId);
    const timeout = menu?.timeout || 30000; // 30 seconds default

    const timer = setTimeout(() => {
      this.handleSessionTimeout(sessionId);
    }, timeout);

    this.sessionTimeouts.set(sessionId, timer);
  }

  /**
   * Reset session timeout
   */
  private resetSessionTimeout(sessionId: string): void {
    const existingTimer = this.sessionTimeouts.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    this.setSessionTimeout(sessionId);
  }

  /**
   * End IVR session
   */
  endSession(sessionId: string): void {
    const timer = this.sessionTimeouts.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.sessionTimeouts.delete(sessionId);
    }

    this.sessions.delete(sessionId);
    this.emit('session_end', { sessionId });

    logger.info('IVR session ended', { sessionId });
  }

  /**
   * Get session
   */
  getSession(sessionId: string): IVRSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get menu
   */
  getMenu(menuId: string): IVRMenu | undefined {
    return this.menus.get(menuId);
  }

  /**
   * List all menus
   */
  listMenus(): IVRMenu[] {
    return Array.from(this.menus.values());
  }

  /**
   * Delete menu
   */
  deleteMenu(menuId: string): boolean {
    return this.menus.delete(menuId);
  }
}
