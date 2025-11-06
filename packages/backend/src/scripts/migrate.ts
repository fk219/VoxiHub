#!/usr/bin/env node

import dotenv from 'dotenv';
import { DatabaseMigrator } from '../database/migrator';
import { logger } from '../index';

// Load environment variables
dotenv.config();

async function runMigrations() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    logger.error('Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const migrator = new DatabaseMigrator(supabaseUrl, supabaseServiceKey);

  try {
    // Check connection first
    logger.info('Checking database connection...');
    const isConnected = await migrator.checkConnection();
    
    if (!isConnected) {
      logger.error('Failed to connect to database');
      process.exit(1);
    }

    logger.info('Database connection successful');

    // Run migrations
    await migrator.runMigrations();

    // Run seeds if in development
    if (process.env.NODE_ENV === 'development' && process.argv.includes('--seed')) {
      logger.info('Running seed data (development mode)...');
      await migrator.runSeeds();
    }

    logger.info('Migration process completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: npm run migrate [options]

Options:
  --seed    Run seed data after migrations (development only)
  --help    Show this help message

Environment Variables Required:
  SUPABASE_URL              Your Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY Your Supabase service role key
  NODE_ENV                  Environment (development/production)

Examples:
  npm run migrate                    # Run migrations only
  npm run migrate -- --seed         # Run migrations and seed data
  `);
  process.exit(0);
}

// Run migrations
runMigrations();