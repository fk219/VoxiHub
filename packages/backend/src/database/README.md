# Database Setup and Management

This directory contains the database schema, migrations, and utilities for the AI Agent Creator Platform.

## Overview

The platform uses Supabase (PostgreSQL) as the primary database with Row Level Security (RLS) for data access control. The database schema supports:

- User management and authentication
- Agent configurations and settings
- Knowledge base management (documents, URLs, FAQs)
- Conversation and message storage
- Widget and SIP configurations

## Database Schema

### Core Tables

1. **users** - User profiles (extends Supabase auth.users)
2. **agents** - AI agent configurations
3. **conversations** - Conversation sessions
4. **messages** - Individual messages within conversations
5. **knowledge_base_documents** - Document-based knowledge
6. **knowledge_base_urls** - URL-based knowledge sources
7. **knowledge_base_faqs** - FAQ entries
8. **widget_configs** - Website widget configurations
9. **sip_configs** - SIP telephony configurations

### Security

Row Level Security (RLS) is enabled on all tables with policies ensuring:
- Users can only access their own data
- Agents can only be managed by their owners
- Conversations are accessible to agent owners and participants
- System operations use service role for cross-user access

## Running Migrations

### Prerequisites

1. Set up your Supabase project
2. Configure environment variables:
   ```bash
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

### Migration Commands

```bash
# Run migrations only
npm run migrate

# Run migrations and seed data (development)
npm run migrate:seed
```

### Manual Migration Steps

If you need to run migrations manually in Supabase:

1. **Create the exec_sql function** (required for migrations):
   ```sql
   CREATE OR REPLACE FUNCTION exec_sql(sql text)
   RETURNS void
   LANGUAGE plpgsql
   SECURITY DEFINER
   AS $$
   BEGIN
     EXECUTE sql;
   END;
   $$;
   ```

2. **Run migration files in order**:
   - `001_initial_schema.sql` - Creates tables and indexes
   - `002_rls_policies.sql` - Sets up Row Level Security

3. **Optional: Run seed data**:
   - `001_sample_data.sql` - Sample data for development

## Environment Variables

Required environment variables for database operations:

```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Database Configuration
NODE_ENV=development|production
```

## Database Service Usage

The `DatabaseService` class provides methods for all database operations:

```typescript
import { DatabaseService } from './services/database';

const dbService = new DatabaseService();

// Create an agent
const agent = await dbService.createAgent(userId, {
  name: 'Customer Support Agent',
  description: 'Helpful customer support',
  personality_tone: 'professional'
});

// Get conversations
const conversations = await dbService.getConversationsByAgentId(
  agentId, 
  userToken
);
```

## Authentication Integration

The database integrates with Supabase Auth:

- User profiles are automatically created via trigger
- RLS policies use `auth.uid()` for access control
- JWT tokens are validated through Supabase client
- Service role bypasses RLS for system operations

## Development Tips

1. **Testing**: Use seed data for consistent test scenarios
2. **Debugging**: Check Supabase logs for RLS policy issues
3. **Performance**: Indexes are created for common query patterns
4. **Security**: Never use service role key in client-side code

## Troubleshooting

### Common Issues

1. **Migration fails**: Check if exec_sql function exists
2. **RLS denies access**: Verify user authentication and policies
3. **Connection errors**: Validate environment variables
4. **Seed data conflicts**: Seeds may fail on duplicate data (expected)

### Useful Queries

```sql
-- Check executed migrations
SELECT * FROM public.migrations ORDER BY executed_at;

-- View RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies WHERE schemaname = 'public';

-- Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables WHERE schemaname = 'public';
```