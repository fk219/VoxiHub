import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { logger } from '../index';

export class DatabaseMigrator {
  private supabase;

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Create migrations tracking table if it doesn't exist
   */
  private async createMigrationsTable(): Promise<void> {
    const { error } = await this.supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.migrations (
          id SERIAL PRIMARY KEY,
          filename TEXT NOT NULL UNIQUE,
          executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (error) {
      throw new Error(`Failed to create migrations table: ${error.message}`);
    }
  }

  /**
   * Get list of executed migrations
   */
  private async getExecutedMigrations(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('migrations')
      .select('filename')
      .order('id');

    if (error) {
      throw new Error(`Failed to get executed migrations: ${error.message}`);
    }

    return data?.map(row => row.filename) || [];
  }

  /**
   * Execute a single migration file
   */
  private async executeMigration(filename: string, sql: string): Promise<void> {
    try {
      // Execute the migration SQL
      const { error: sqlError } = await this.supabase.rpc('exec_sql', { sql });
      
      if (sqlError) {
        throw new Error(`SQL execution failed: ${sqlError.message}`);
      }

      // Record the migration as executed
      const { error: recordError } = await this.supabase
        .from('migrations')
        .insert({ filename });

      if (recordError) {
        throw new Error(`Failed to record migration: ${recordError.message}`);
      }

      logger.info(`Migration executed successfully: ${filename}`);
    } catch (error) {
      logger.error(`Migration failed: ${filename}`, error);
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<void> {
    try {
      logger.info('Starting database migrations...');

      // Create migrations table if it doesn't exist
      await this.createMigrationsTable();

      // Get executed migrations
      const executedMigrations = await this.getExecutedMigrations();
      logger.info(`Found ${executedMigrations.length} executed migrations`);

      // Get all migration files
      const migrationsDir = join(__dirname, 'migrations');
      const migrationFiles = readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();

      logger.info(`Found ${migrationFiles.length} migration files`);

      // Execute pending migrations
      let executedCount = 0;
      for (const filename of migrationFiles) {
        if (!executedMigrations.includes(filename)) {
          const filePath = join(migrationsDir, filename);
          const sql = readFileSync(filePath, 'utf8');
          
          logger.info(`Executing migration: ${filename}`);
          await this.executeMigration(filename, sql);
          executedCount++;
        }
      }

      if (executedCount === 0) {
        logger.info('No pending migrations to execute');
      } else {
        logger.info(`Successfully executed ${executedCount} migrations`);
      }
    } catch (error) {
      logger.error('Migration process failed:', error);
      throw error;
    }
  }

  /**
   * Run seed data (for development/testing)
   */
  async runSeeds(): Promise<void> {
    try {
      logger.info('Running seed data...');

      const seedsDir = join(__dirname, 'seeds');
      const seedFiles = readdirSync(seedsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();

      for (const filename of seedFiles) {
        const filePath = join(seedsDir, filename);
        const sql = readFileSync(filePath, 'utf8');
        
        logger.info(`Executing seed: ${filename}`);
        const { error } = await this.supabase.rpc('exec_sql', { sql });
        
        if (error) {
          logger.warn(`Seed execution warning for ${filename}: ${error.message}`);
          // Don't throw error for seeds as they might contain duplicate data
        } else {
          logger.info(`Seed executed successfully: ${filename}`);
        }
      }

      logger.info('Seed data execution completed');
    } catch (error) {
      logger.error('Seed process failed:', error);
      throw error;
    }
  }

  /**
   * Check database connection and basic health
   */
  async checkConnection(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('migrations')
        .select('count')
        .limit(1);

      return !error;
    } catch (error) {
      logger.error('Database connection check failed:', error);
      return false;
    }
  }
}

// Create a function to execute SQL (this needs to be created as a Supabase function)
export const createExecSqlFunction = `
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;
`;