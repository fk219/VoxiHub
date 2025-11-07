# Backend Development Setup

## Prerequisites

- Node.js v20.x or higher
- npm or yarn
- Redis (for session management and caching)
- Supabase account (for database and authentication)

## Environment Setup

1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your environment variables in `.env`:
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_ANON_KEY` - Your Supabase anonymous key
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
   - `JWT_SECRET` - A secure random string for JWT signing
   - `OPENAI_API_KEY` - Your OpenAI API key (optional)
   - `ELEVENLABS_API_KEY` - Your ElevenLabs API key (optional)
   - Other configuration as needed

## Installation

Install dependencies:
```bash
npm install
```

## Development

### Using Nodemon (Recommended)

Nodemon automatically restarts the server when you make changes to the code:

```bash
npm run dev
```

This uses the `nodemon.json` configuration which:
- Watches the `src` directory for changes
- Restarts on `.ts` and `.json` file changes
- Uses `tsx` for fast TypeScript execution
- Ignores test files and node_modules
- Has a 1-second delay to batch rapid changes

### Manual Restart Commands

While nodemon is running, you can:
- Type `rs` and press Enter to manually restart
- Press `Ctrl+C` to stop the server

### Alternative: Using tsx directly

If you prefer not to use nodemon:
```bash
npm run dev:tsx
```

## Building for Production

Compile TypeScript to JavaScript:
```bash
npm run build
```

Run the compiled code:
```bash
npm start
```

## Database Migrations

Run migrations:
```bash
npm run migrate
```

Run migrations with seed data:
```bash
npm run migrate:seed
```

## Testing

Run tests:
```bash
npm test
```

## Linting

Check code style:
```bash
npm run lint
```

## Troubleshooting

### Environment Variables Not Loading

If you see "supabaseUrl is required" error:
1. Ensure `.env` file exists in `packages/backend/`
2. Check that `SUPABASE_URL` has the full URL including `https://`
3. Verify no extra spaces or quotes around values
4. Run the test script: `node test-env.js`

### Port Already in Use

If port 3001 is already in use:
1. Change `PORT` in your `.env` file
2. Or kill the process using the port:
   ```bash
   # On Linux/Mac
   lsof -ti:3001 | xargs kill -9
   
   # On Windows
   netstat -ano | findstr :3001
   taskkill /PID <PID> /F
   ```

### Redis Connection Error

Ensure Redis is running:
```bash
# On Linux/Mac
redis-server

# On Windows (with Redis installed)
redis-server.exe

# Or using Docker
docker run -d -p 6379:6379 redis:alpine
```

### TypeScript Compilation Errors

Clear the build cache and reinstall:
```bash
npm run clean
npm install
npm run build
```

## Nodemon Configuration

The `nodemon.json` file controls how nodemon behaves:

```json
{
  "watch": ["src"],              // Directories to watch
  "ext": "ts,json",              // File extensions to watch
  "ignore": ["*.test.ts"],       // Files to ignore
  "exec": "tsx src/index.ts",    // Command to execute
  "delay": 1000,                 // Delay before restart (ms)
  "restartable": "rs"            // Type 'rs' to manually restart
}
```

### Using ts-node Instead of tsx

If you prefer `ts-node` over `tsx`, use the alternative config:
```bash
nodemon --config nodemon.ts-node.json
```

Or update your `package.json` script:
```json
"dev": "nodemon --config nodemon.ts-node.json"
```

## Project Structure

```
packages/backend/
├── src/
│   ├── config/          # Configuration files
│   ├── database/        # Database types and migrations
│   ├── middleware/      # Express middleware
│   ├── routes/          # API routes
│   ├── services/        # Business logic services
│   ├── utils/           # Utility functions
│   └── index.ts         # Application entry point
├── .env                 # Environment variables (not in git)
├── .env.example         # Example environment variables
├── nodemon.json         # Nodemon configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Dependencies and scripts
```

## API Endpoints

Once the server is running, you can access:

- **Health Check**: `GET http://localhost:3001/health`
- **API Documentation**: `GET http://localhost:3001/api/docs` (if Swagger is configured)
- **Agents API**: `http://localhost:3001/api/agents`
- **Conversations API**: `http://localhost:3001/api/conversations`
- **Admin API**: `http://localhost:3001/api/admin`

## Next Steps

1. Set up your Supabase database schema using migrations
2. Configure your external API keys (OpenAI, ElevenLabs, etc.)
3. Test the API endpoints using Postman or curl
4. Start building your agents in the frontend!

## Support

For issues or questions:
- Check the main project README
- Review the API documentation
- Check the troubleshooting section above
