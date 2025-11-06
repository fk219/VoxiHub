# Supabase Setup Instructions

This guide will help you set up Supabase for the AI Agent Creator Platform.

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create an account
2. Create a new project
3. Wait for the project to be fully initialized

## 2. Get Project Credentials

From your Supabase project dashboard:

1. Go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (e.g., `https://your-project.supabase.co`)
   - **anon public key** (starts with `eyJ...`)
   - **service_role secret key** (starts with `eyJ...`)

## 3. Configure Environment Variables

Create a `.env` file in the `packages/backend` directory:

```bash
# Copy from .env.example and fill in your values
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Other required variables
NODE_ENV=development
PORT=3001
REDIS_URL=redis://localhost:6379
FRONTEND_URL=http://localhost:3000
```

## 4. Set Up Database Schema

### Option A: Automatic Migration (Recommended)

```bash
cd packages/backend
npm run migrate
```

For development with sample data:
```bash
npm run migrate:seed
```

### Option B: Manual Setup

If automatic migration fails, run these SQL commands in your Supabase SQL Editor:

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

2. **Run the migration files** in order:
   - Copy and paste `src/database/migrations/001_initial_schema.sql`
   - Copy and paste `src/database/migrations/002_rls_policies.sql`

3. **Optional: Add sample data**:
   - Copy and paste `src/database/seeds/001_sample_data.sql`
   - Update the user IDs in the seed data with actual user IDs from your auth.users table

## 5. Configure Authentication

### Enable Email Authentication

1. Go to **Authentication** → **Settings**
2. Enable **Email** provider
3. Configure email templates if needed

### Set Up Auth Policies

The RLS policies are automatically created by the migration. They ensure:
- Users can only access their own data
- Agents belong to their creators
- Conversations are accessible to relevant parties

## 6. Test the Setup

### Test Database Connection

```bash
cd packages/backend
npm run dev
```

Check the logs for:
- ✅ "Connected to Redis"
- ✅ "Supabase connection established"
- ✅ "Server running on port 3001"

### Test API Endpoints

```bash
# Health check
curl http://localhost:3001/health

# Database health check
curl http://localhost:3001/api/health/database
```

### Test Authentication

1. Create a user account through Supabase Auth UI or your frontend
2. Get the JWT token
3. Test authenticated endpoint:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3001/api/auth/profile
```

## 7. Production Considerations

### Security Settings

1. **Row Level Security**: Already enabled by migrations
2. **API Keys**: Never expose service_role key in client code
3. **CORS**: Configure allowed origins in production
4. **Rate Limiting**: Implement additional rate limiting as needed

### Performance Settings

1. **Connection Pooling**: Supabase handles this automatically
2. **Indexes**: Created by migration for common queries
3. **Caching**: Redis is configured for session management

### Backup and Recovery

1. **Automatic Backups**: Enabled by default in Supabase
2. **Point-in-time Recovery**: Available on paid plans
3. **Migration History**: Tracked in `public.migrations` table

## 8. Troubleshooting

### Common Issues

**Migration fails with "function exec_sql does not exist"**
- Run the exec_sql function creation manually first

**RLS policies deny access**
- Check that user is authenticated
- Verify JWT token is valid
- Ensure user exists in public.users table

**Connection timeout**
- Check SUPABASE_URL and keys are correct
- Verify network connectivity
- Check Supabase project status

**Seed data fails**
- Update user IDs in seed data
- Some failures are expected for duplicate data

### Useful SQL Queries

```sql
-- Check migrations status
SELECT * FROM public.migrations ORDER BY executed_at;

-- View current users
SELECT id, email, created_at FROM auth.users;

-- Check RLS policies
SELECT tablename, policyname, cmd, permissive 
FROM pg_policies 
WHERE schemaname = 'public';

-- View table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## 9. Next Steps

After successful setup:

1. **Frontend Integration**: Configure frontend to use Supabase Auth
2. **API Development**: Build agent management endpoints
3. **Widget Development**: Create embeddable widget with auth
4. **SIP Integration**: Set up telephony services
5. **Testing**: Write comprehensive tests for all functionality

For development, you can now proceed to implement the next tasks in the implementation plan.