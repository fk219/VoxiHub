const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/voice_agent_db'
});

const migrationPath = path.join(__dirname, 'packages/backend/src/database/migrations/002_add_agent_config_fields.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

pool.query(sql)
  .then(() => {
    console.log('✅ Migration completed successfully');
    pool.end();
  })
  .catch(err => {
    console.error('❌ Migration failed:', err);
    pool.end();
    process.exit(1);
  });
