import { DatabaseService } from '../../services/database';
import { DatabaseMigrator } from '../migrator';

// Mock environment variables for testing
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

describe('Database Service', () => {
  let dbService: DatabaseService;

  beforeAll(() => {
    dbService = new DatabaseService();
  });

  describe('Initialization', () => {
    it('should initialize database service', () => {
      expect(dbService).toBeInstanceOf(DatabaseService);
    });

    it('should create client for user with token', () => {
      const client = dbService.getClientForUser('test-token');
      expect(client).toBeDefined();
    });
  });

  describe('Health Check', () => {
    it('should have health check method', () => {
      expect(typeof dbService.healthCheck).toBe('function');
    });
  });
});

describe('Database Migrator', () => {
  let migrator: DatabaseMigrator;

  beforeAll(() => {
    migrator = new DatabaseMigrator(
      'https://test.supabase.co',
      'test-service-key'
    );
  });

  describe('Initialization', () => {
    it('should initialize migrator', () => {
      expect(migrator).toBeInstanceOf(DatabaseMigrator);
    });

    it('should have migration methods', () => {
      expect(typeof migrator.runMigrations).toBe('function');
      expect(typeof migrator.runSeeds).toBe('function');
      expect(typeof migrator.checkConnection).toBe('function');
    });
  });
});

describe('Database Types', () => {
  it('should export database types', async () => {
    const types = await import('../types');
    
    expect(types).toHaveProperty('ConversationStatus');
    expect(types).toHaveProperty('MessageRole');
    expect(types).toHaveProperty('MessageType');
    expect(types).toHaveProperty('ChannelType');
    expect(types).toHaveProperty('PersonalityTone');
  });
});

describe('Authentication Middleware', () => {
  it('should export auth middleware functions', async () => {
    const auth = await import('../../middleware/auth');
    
    expect(typeof auth.authenticateToken).toBe('function');
    expect(typeof auth.optionalAuth).toBe('function');
    expect(typeof auth.requireRole).toBe('function');
    expect(typeof auth.createUserSupabaseClient).toBe('function');
    expect(typeof auth.extractToken).toBe('function');
    expect(typeof auth.authRateLimit).toBe('function');
  });
});