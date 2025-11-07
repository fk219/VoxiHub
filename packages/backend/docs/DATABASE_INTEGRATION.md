# Database Integration Documentation

## Overview

The platform uses Supabase (PostgreSQL) for data persistence with comprehensive CRUD operations for all entities.

## Database Schema

### Core Tables

#### 1. API Keys Table (`api_keys`)
Stores API keys for programmatic access to the platform.

**Columns:**
- `id` (UUID, PK) - Unique identifier
- `user_id` (UUID, FK) - References auth.users
- `name` (VARCHAR) - Friendly name for the key
- `key_prefix` (VARCHAR) - First 10 characters for identification
- `key_hash` (VARCHAR) - SHA-256 hash of the full key
- `last_used_at` (TIMESTAMP) - Last usage timestamp
- `expires_at` (TIMESTAMP) - Expiration date
- `rate_limit` (INTEGER) - Requests per hour limit
- `usage_quota` (INTEGER) - Total usage quota
- `usage_count` (INTEGER) - Current usage count
- `enabled` (BOOLEAN) - Active status
- `scopes` (TEXT[]) - Permission scopes
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

**Indexes:**
- `idx_api_keys_user_id` - User lookup
- `idx_api_keys_key_hash` - Key validation
- `idx_api_keys_enabled` - Active keys filter
- `idx_api_keys_expires_at` - Expiration checks

**RLS Policies:**
- Users can view their own API keys
- Users can create their own API keys
- Users can update their own API keys
- Users can delete their own API keys

#### 2. Webhooks Table (`webhooks`)
Manages webhook configurations for event notifications.

**Columns:**
- `id` (UUID, PK) - Unique identifier
- `user_id` (UUID, FK) - References auth.users
- `agent_id` (UUID, FK) - References agents (optional)
- `url` (TEXT) - Webhook endpoint URL
- `events` (TEXT[]) - Subscribed event types
- `secret` (VARCHAR) - HMAC secret for signature verification
- `enabled` (BOOLEAN) - Active status
- `retry_count` (INTEGER) - Number of retry attempts
- `last_triggered_at` (TIMESTAMP) - Last trigger time
- `last_status` (INTEGER) - Last HTTP status code
- `last_error` (TEXT) - Last error message
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

**Indexes:**
- `idx_webhooks_user_id` - User lookup
- `idx_webhooks_agent_id` - Agent-specific webhooks
- `idx_webhooks_enabled` - Active webhooks filter

**RLS Policies:**
- Users can view their own webhooks
- Users can create their own webhooks
- Users can update their own webhooks
- Users can delete their own webhooks

#### 3. Webhook Logs Table (`webhook_logs`)
Tracks webhook delivery attempts and results.

**Columns:**
- `id` (UUID, PK) - Unique identifier
- `webhook_id` (UUID, FK) - References webhooks
- `event` (VARCHAR) - Event type
- `payload` (JSONB) - Event payload
- `status_code` (INTEGER) - HTTP response status
- `response_body` (TEXT) - Response content
- `error` (TEXT) - Error message if failed
- `attempt_number` (INTEGER) - Retry attempt number
- `delivered_at` (TIMESTAMP) - Successful delivery time
- `created_at` (TIMESTAMP) - Creation timestamp

**Indexes:**
- `idx_webhook_logs_webhook_id` - Webhook lookup
- `idx_webhook_logs_event` - Event type filter
- `idx_webhook_logs_created_at` - Time-based queries

**RLS Policies:**
- Users can view logs for their webhooks

#### 4. IVR Menus Table (`ivr_menus`)
Defines Interactive Voice Response menu structures.

**Columns:**
- `id` (UUID, PK) - Unique identifier
- `user_id` (UUID, FK) - References auth.users
- `name` (VARCHAR) - Menu name
- `prompt` (TEXT) - Audio prompt text
- `items` (JSONB) - Menu items configuration
- `timeout` (INTEGER) - Input timeout in milliseconds
- `max_retries` (INTEGER) - Maximum retry attempts
- `invalid_prompt` (TEXT) - Invalid input message
- `timeout_prompt` (TEXT) - Timeout message
- `parent_menu_id` (UUID, FK) - Parent menu reference
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

**Indexes:**
- `idx_ivr_menus_user_id` - User lookup
- `idx_ivr_menus_parent_menu_id` - Menu hierarchy

**RLS Policies:**
- Users can view their own IVR menus
- Users can create their own IVR menus
- Users can update their own IVR menus
- Users can delete their own IVR menus

#### 5. IVR Sessions Table (`ivr_sessions`)
Tracks active IVR navigation sessions.

**Columns:**
- `id` (UUID, PK) - Unique identifier
- `session_id` (VARCHAR) - External session identifier
- `user_id` (UUID, FK) - References auth.users
- `current_menu_id` (UUID, FK) - Current menu
- `menu_stack` (JSONB) - Navigation history
- `retry_count` (INTEGER) - Current retry count
- `start_time` (TIMESTAMP) - Session start
- `last_activity` (TIMESTAMP) - Last interaction
- `ended_at` (TIMESTAMP) - Session end time
- `created_at` (TIMESTAMP) - Creation timestamp

**Indexes:**
- `idx_ivr_sessions_session_id` - Session lookup
- `idx_ivr_sessions_user_id` - User sessions
- `idx_ivr_sessions_current_menu_id` - Menu tracking
- `idx_ivr_sessions_last_activity` - Activity monitoring

**RLS Policies:**
- Users can view their own IVR sessions
- System can manage IVR sessions (for call handling)

## CRUD Operations

### API Keys Service

#### Create API Key
```typescript
const { apiKey, plainKey } = await apiKeyService.createApiKey({
  user_id: userId,
  name: 'Production API Key',
  expires_in_days: 90,
  rate_limit: 1000,
  usage_quota: 100000,
  scopes: ['agents:read', 'agents:write']
});
```

#### Validate API Key
```typescript
const apiKey = await apiKeyService.validateApiKey(plainKey);
if (apiKey) {
  // Key is valid and active
}
```

#### List API Keys
```typescript
const keys = await apiKeyService.listApiKeys(userId);
```

#### Update API Key
```typescript
await apiKeyService.updateApiKey(keyId, userId, {
  name: 'Updated Name',
  rate_limit: 2000
});
```

#### Revoke API Key
```typescript
await apiKeyService.revokeApiKey(keyId, userId);
```

#### Delete API Key
```typescript
await apiKeyService.deleteApiKey(keyId, userId);
```

### Webhooks Service

#### Create Webhook
```typescript
const webhook = await webhookService.createWebhook({
  user_id: userId,
  agent_id: agentId,
  url: 'https://example.com/webhook',
  events: [
    WebhookEvent.CALL_STARTED,
    WebhookEvent.CALL_ENDED,
    WebhookEvent.CONVERSATION_UPDATED
  ]
});
```

#### Trigger Webhook Event
```typescript
await webhookService.triggerEvent(
  WebhookEvent.CALL_STARTED,
  {
    callId: 'call_123',
    agentId: 'agent_456',
    phoneNumber: '+1234567890'
  },
  {
    userId: userId,
    agentId: agentId
  }
);
```

#### Test Webhook
```typescript
const result = await webhookService.testWebhook(webhookId, userId);
if (result.success) {
  console.log('Webhook test successful');
}
```

#### Get Webhook Logs
```typescript
const logs = await webhookService.getWebhookLogs(webhookId, 50);
```

#### Update Webhook
```typescript
await webhookService.updateWebhook(webhookId, userId, {
  url: 'https://new-url.com/webhook',
  enabled: true
});
```

#### Delete Webhook
```typescript
await webhookService.deleteWebhook(webhookId, userId);
```

### IVR Menu Service

#### Register IVR Menu
```typescript
ivrMenuService.registerMenu({
  id: 'main-menu',
  name: 'Main Menu',
  prompt: 'Press 1 for sales, 2 for support, 3 for billing',
  items: [
    {
      digit: '1',
      label: 'Sales',
      action: 'submenu',
      target: 'sales-menu'
    },
    {
      digit: '2',
      label: 'Support',
      action: 'agent',
      target: 'support-queue'
    },
    {
      digit: '3',
      label: 'Billing',
      action: 'transfer',
      target: '+1234567890'
    }
  ],
  timeout: 30000,
  maxRetries: 3
});
```

#### Start IVR Session
```typescript
const session = ivrMenuService.startSession(sessionId, 'main-menu');
```

#### Process Menu Input
```typescript
ivrMenuService.processMenuInput(sessionId, '1');
```

#### Navigate Back
```typescript
ivrMenuService.goBack(sessionId);
```

#### End Session
```typescript
ivrMenuService.endSession(sessionId);
```

### Database Service Methods

#### API Keys
- `createApiKey(data)` - Create new API key
- `getApiKeyByHash(hash)` - Find key by hash
- `getApiKeyById(id)` - Get key by ID
- `getApiKeysByUserId(userId)` - List user's keys
- `updateApiKey(id, updates)` - Update key
- `updateApiKeyUsage(id)` - Increment usage
- `deleteApiKey(id)` - Delete key
- `getApiKeyUsageStats(id)` - Get usage statistics

#### Webhooks
- `createWebhook(data)` - Create webhook
- `getWebhookById(id)` - Get webhook by ID
- `getWebhooks(filters)` - List webhooks with filters
- `updateWebhook(id, updates)` - Update webhook
- `deleteWebhook(id)` - Delete webhook
- `createWebhookLog(log)` - Log delivery attempt
- `getWebhookLogs(webhookId, limit)` - Get delivery logs

#### IVR Menus
- `createIVRMenu(data)` - Create menu
- `getIVRMenus(userId)` - List user's menus
- `getIVRMenuById(id, userId)` - Get menu by ID
- `updateIVRMenu(id, updates)` - Update menu
- `deleteIVRMenu(id)` - Delete menu
- `createIVRSession(data)` - Create session
- `getIVRSession(sessionId)` - Get session
- `updateIVRSession(sessionId, updates)` - Update session

## Running Migrations

### Execute Migrations
```bash
cd packages/backend
npm run migrate
```

### Migration Files
1. `001_create_api_keys_table.sql` - API keys table and indexes
2. `002_create_webhooks_tables.sql` - Webhooks and logs tables
3. `003_create_ivr_tables.sql` - IVR menus and sessions tables

## Security Features

### Row Level Security (RLS)
All tables have RLS enabled with policies ensuring:
- Users can only access their own data
- Service role can bypass RLS for system operations
- Proper authentication required for all operations

### API Key Security
- Keys are hashed using SHA-256
- Only prefix stored for identification
- Plain key shown only once at creation
- Automatic expiration support
- Usage quota enforcement

### Webhook Security
- HMAC signature verification
- Secret key per webhook
- Retry logic with exponential backoff
- Delivery logging for audit trail

## Monitoring and Maintenance

### Usage Statistics
```typescript
// API Key stats
const stats = await apiKeyService.getApiKeyStats(keyId, userId);

// Webhook logs
const logs = await webhookService.getWebhookLogs(webhookId);
```

### Cleanup Operations
```typescript
// Clean old audit logs
await auditService.cleanupOldLogs(365); // Keep 1 year
```

### Health Checks
```typescript
const isHealthy = await databaseService.healthCheck();
```

## Best Practices

### 1. API Key Management
- Rotate keys regularly
- Set appropriate expiration dates
- Use scoped permissions
- Monitor usage patterns
- Revoke unused keys

### 2. Webhook Configuration
- Use HTTPS endpoints only
- Verify webhook signatures
- Implement idempotency
- Handle retries gracefully
- Log all deliveries

### 3. IVR Design
- Keep menus simple (max 5 options)
- Use clear, concise prompts
- Provide escape options
- Set reasonable timeouts
- Test thoroughly

### 4. Database Operations
- Use transactions for related operations
- Implement proper error handling
- Monitor query performance
- Regular backups
- Index optimization

## Troubleshooting

### Common Issues

#### API Key Validation Fails
- Check key format (should start with `vx_`)
- Verify key hasn't expired
- Check if key is enabled
- Verify usage quota not exceeded

#### Webhook Not Triggering
- Verify webhook is enabled
- Check event subscription
- Verify endpoint is accessible
- Check webhook logs for errors

#### IVR Session Issues
- Verify menu exists
- Check session timeout settings
- Verify DTMF input format
- Check menu stack integrity

## Performance Optimization

### Indexing Strategy
- All foreign keys indexed
- Timestamp columns indexed for time-based queries
- Composite indexes for common query patterns

### Query Optimization
- Use select specific columns
- Implement pagination
- Cache frequently accessed data
- Use connection pooling

### Scaling Considerations
- Horizontal scaling via read replicas
- Partition large tables by date
- Archive old data
- Implement caching layer

## Compliance

### Data Retention
- Audit logs: 1 year default
- Webhook logs: 90 days default
- IVR sessions: 30 days default
- API key usage: Indefinite

### GDPR Compliance
- User data deletion support
- Data export capabilities
- Audit trail maintenance
- Consent management

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
