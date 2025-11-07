# AI Agent Platform - Backend

Backend API services for the AI Agent Creator Platform. This service provides REST APIs for agent management, conversation handling, voice processing (STT/TTS), SIP telephony integration, and more.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run development server with auto-reload
npm run dev

# Build for production
npm run build

# Run production server
npm start
```

## Features

- **Agent Management**: Create, configure, and deploy AI agents
- **Conversation Handling**: Real-time conversation processing and history
- **Voice Processing**: Speech-to-Text (STT) and Text-to-Speech (TTS) integration
- **SIP Telephony**: Inbound and outbound phone call support
- **Function Calling**: Custom function execution within conversations
- **Authentication & Authorization**: JWT-based auth with RBAC
- **Security**: Rate limiting, encryption, audit logging, GDPR compliance
- **Analytics**: Performance metrics, conversation analytics, usage tracking

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Cache/Sessions**: Redis
- **Authentication**: Supabase Auth + JWT
- **Voice**: OpenAI Whisper (STT), ElevenLabs/OpenAI (TTS)
- **LLM**: OpenAI GPT-4, Anthropic Claude, Groq
- **Telephony**: SIP.js

## Development

### With Nodemon (Auto-reload)

```bash
npm run dev
```

Nodemon will automatically restart the server when you make changes to TypeScript files.

### Manual Restart

While nodemon is running, type `rs` and press Enter to manually restart.

### Alternative: tsx watch

```bash
npm run dev:tsx
```

## Scripts

- `npm run dev` - Start development server with nodemon
- `npm run dev:tsx` - Start development server with tsx watch
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run production server
- `npm test` - Run tests
- `npm run lint` - Check code style
- `npm run migrate` - Run database migrations
- `npm run migrate:seed` - Run migrations with seed data

## Environment Variables

Required variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `JWT_SECRET` - Secret for JWT signing

Optional variables:
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)
- `REDIS_URL` - Redis connection URL
- `OPENAI_API_KEY` - OpenAI API key
- `ELEVENLABS_API_KEY` - ElevenLabs API key
- `GROQ_API_KEY` - Groq API key

See `.env.example` for all available options.

## API Documentation

### Core Endpoints

- `GET /health` - Health check
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Agent Management

- `GET /api/agents` - List agents
- `POST /api/agents` - Create agent
- `GET /api/agents/:id` - Get agent details
- `PUT /api/agents/:id` - Update agent
- `DELETE /api/agents/:id` - Delete agent
- `POST /api/agents/:id/publish` - Publish agent
- `POST /api/agents/:id/test` - Test agent

### Conversations

- `POST /api/conversations` - Start conversation
- `GET /api/conversations/:id` - Get conversation
- `POST /api/conversations/:id/messages` - Add message
- `PUT /api/conversations/:id/end` - End conversation

### Voice Processing

- `POST /api/stt/transcribe` - Transcribe audio to text
- `POST /api/tts/synthesize` - Synthesize text to speech
- `GET /api/tts/voices` - List available voices

### SIP/Telephony

- `POST /api/sip/config` - Configure SIP
- `POST /api/sip/call/outbound` - Make outbound call
- `GET /api/sip/calls/active` - List active calls

### Admin

- `GET /api/admin/conversations` - List all conversations
- `GET /api/admin/analytics/overview` - Get analytics overview
- `GET /api/admin/conversations/live` - Monitor live conversations

### REST API v1

- `GET /api/v1/agents` - List agents (REST API)
- `POST /api/v1/agents` - Create agent (REST API)
- `GET /api/v1/functions` - List functions
- `POST /api/v1/functions` - Register function

## Architecture

```
src/
├── config/          # Configuration and environment setup
├── database/        # Database types, migrations, and schemas
├── middleware/      # Express middleware (auth, RBAC, security, rate limiting)
├── routes/          # API route handlers
│   ├── api/v1/     # REST API v1 endpoints
│   ├── agents.ts   # Agent management routes
│   ├── conversations.ts
│   ├── stt.ts      # Speech-to-Text routes
│   ├── tts.ts      # Text-to-Speech routes
│   ├── sip.ts      # SIP telephony routes
│   ├── admin.ts    # Admin dashboard routes
│   └── privacy.ts  # GDPR/privacy routes
├── services/        # Business logic services
│   ├── database.ts
│   ├── conversation.ts
│   ├── llmIntegration.ts
│   ├── functionRegistry.ts
│   ├── stt.ts
│   ├── tts.ts
│   ├── sip.ts
│   ├── auditService.ts
│   ├── privacyService.ts
│   └── encryptionService.ts
├── utils/           # Utility functions
│   └── logger.ts
└── index.ts         # Application entry point
```

## Security Features

- **Authentication**: JWT-based authentication with Supabase Auth
- **Authorization**: Role-Based Access Control (RBAC)
- **Rate Limiting**: API and authentication rate limiting
- **Encryption**: End-to-end encryption for sensitive data
- **Audit Logging**: Comprehensive audit trail
- **GDPR Compliance**: Data export, deletion, and retention policies
- **Security Headers**: Helmet.js for security headers
- **Input Sanitization**: XSS and injection prevention

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

## Deployment

### Docker

```bash
# Build image
docker build -t ai-agent-backend .

# Run container
docker run -p 3001:3001 --env-file .env ai-agent-backend
```

### Production Build

```bash
# Build TypeScript
npm run build

# Run production server
NODE_ENV=production npm start
```

## Troubleshooting

See [DEV_SETUP.md](./DEV_SETUP.md) for detailed troubleshooting guide.

Common issues:
- **Environment variables not loading**: Check `.env` file location and format
- **Port already in use**: Change `PORT` in `.env` or kill the process
- **Redis connection error**: Ensure Redis is running
- **Supabase connection error**: Verify credentials and URL

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.
