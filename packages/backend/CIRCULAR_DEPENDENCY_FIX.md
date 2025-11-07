# Circular Dependency Fix ✓

## Problem

The application was failing to start with the error:
```
ReferenceError: Cannot access 'redis' before initialization
```

This was caused by a circular dependency where:
1. `index.ts` was creating the `redis` client
2. Route files were importing `redis` from `index.ts`
3. `index.ts` was importing the route files
4. Routes tried to use `redis` before it was initialized

## Solution

Moved `redis` and `logger` to separate modules to break the circular dependency.

### Changes Made

#### 1. Created `src/config/redis.ts`

New file that initializes and exports the Redis client:
```typescript
import { createClient } from 'redis';
import { config } from './env';

export const redis = createClient({
  url: config.redis.url
});

// Auto-connect and handle events
redis.connect().catch((error) => {
  console.error('Failed to connect to Redis:', error);
});
```

#### 2. Updated All Imports

Changed all files that were importing from `index.ts` to import from the correct modules:

**Before:**
```typescript
import { redis, logger } from '../index';
```

**After:**
```typescript
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
```

**Files Updated:**
- `src/routes/conversations.ts`
- `src/routes/admin.ts`
- `src/routes/stt.ts`
- `src/routes/tts.ts`
- `src/services/database.ts`
- `src/services/stt.ts`
- `src/services/tts.ts`
- `src/database/migrator.ts`
- `src/scripts/migrate.ts`

#### 3. Updated `src/index.ts`

- Removed Redis client initialization (now in `config/redis.ts`)
- Imported `redis` from `config/redis`
- Removed `redis` and `logger` from exports

## Benefits

1. **No Circular Dependencies**: Each module has a clear dependency tree
2. **Better Organization**: Redis configuration is in the config directory
3. **Easier Testing**: Can mock Redis independently
4. **Cleaner Imports**: Each file imports only what it needs
5. **Faster Startup**: No initialization order issues

## Module Structure

```
src/
├── config/
│   ├── env.ts          # Environment variables (loaded first)
│   └── redis.ts        # Redis client (NEW)
├── utils/
│   └── logger.ts       # Winston logger
├── routes/
│   ├── conversations.ts  # Imports redis from config
│   ├── admin.ts          # Imports redis from config
│   └── ...
└── index.ts            # Main app (imports redis from config)
```

## Import Order

The correct import order is now:
1. `config/env.ts` - Loads environment variables
2. `config/redis.ts` - Creates Redis client
3. `utils/logger.ts` - Creates logger
4. Services and routes - Use redis and logger
5. `index.ts` - Assembles everything

## Testing

To verify the fix works:

```bash
# Install dependencies
npm install

# Start the server
npm run dev
```

You should see:
```
✓ Connected to Redis
Server listening on port 3001
```

## Troubleshooting

### Redis Connection Error

If you see "Failed to connect to Redis":
1. Ensure Redis is running: `redis-server`
2. Check `REDIS_URL` in your `.env` file
3. Default is `redis://localhost:6379`

### Still Getting Circular Dependency Error

1. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules
   npm install
   ```

2. Check that all imports are updated:
   ```bash
   grep -r "from '../index'" src/
   ```
   Should return no results (except in test files)

## Related Files

- `src/config/redis.ts` - Redis client initialization
- `src/config/env.ts` - Environment configuration
- `src/utils/logger.ts` - Logger configuration
- `src/index.ts` - Main application entry point

---

**Fix completed successfully!** ✓

The circular dependency has been resolved and the application should now start without errors.
