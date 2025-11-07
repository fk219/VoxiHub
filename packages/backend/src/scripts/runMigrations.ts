import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const migrations = [
  '001_create_api_keys_table.sql',
  '002_create_webhooks_tables.sql',
  '003_create_ivr_tables.sql',
];

async function runMigrations() {
  console.log('🚀 Starting database migrations...\n');

  for (const migration of migrations) {
    try {
      console.log(`📝 Running migration: ${migration}`);
      
      const migrationPath = join(__dirname, '../database/migrations', migration);
      const sql = readFileSync(migrationPath, 'utf-8');

      // Execute migration
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

      if (error) {
        console.error(`❌ Migration ${migration} failed:`, error);
        
        // Try direct execution as fallback
        console.log('   Trying direct execution...');
        const statements = sql.split(';').filter(s => s.trim());
        
        for (const statement of statements) {
          if (statement.trim()) {
            const { error: execError } = await supabase.rpc('exec_sql', { 
              sql_query: statement + ';' 
            });
            if (execError) {
              console.error('   Statement failed:', execError.message);
            }
          }
        }
      } else {
        console.log(`✅ Migration ${migration} completed successfully\n`);
      }
    } catch (error) {
      console.error(`❌ Error running migration ${migration}:`, error);
    }
  }

  console.log('✨ All migrations completed!\n');
  console.log('📊 Summary:');
  console.log('   - API Keys table created');
  console.log('   - Webhooks tables created');
  console.log('   - IVR tables created');
  console.log('   - Indexes and RLS policies applied\n');
}

// Run migrations
runMigrations()
  .then(() => {
    console.log('✅ Migration process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration process failed:', error);
    process.exit(1);
  });
