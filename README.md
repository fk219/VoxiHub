# AI Agent Creator Platform

A comprehensive platform for creating and deploying AI-powered voice and chat agents with website widget integration and SIP telephony support.

## Features

- **Agent Builder Studio**: No-code interface for creating and configuring AI agents
- **Website AI Widget**: Embeddable chat and voice widget for websites
- **SIP Integration**: Handle inbound and outbound phone calls
- **Voice Capabilities**: Speech-to-text and text-to-speech integration
- **Real-time Communication**: WebRTC and SIP support
- **Scalable Architecture**: Microservices with Docker containerization

## Architecture

This is a monorepo containing three main packages:

- `packages/backend` - Node.js/Express API server
- `packages/frontend` - React-based Agent Builder Studio
- `packages/widget` - Embeddable JavaScript widget

## Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose
- Supabase account and project
- Redis (included in Docker setup)

## Quick Start

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd ai-agent-creator-platform
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   cp packages/backend/.env.example packages/backend/.env
   cp packages/frontend/.env.example packages/frontend/.env
   ```
   
   Update the `.env` files with your Supabase credentials and other configuration.

3. **Start development environment:**
   ```bash
   # Using Docker (recommended)
   docker-compose up -d
   
   # Or run locally
   npm run dev
   ```

4. **Access the applications:**
   - Frontend (Agent Builder Studio): http://localhost:3000
   - Backend API: http://localhost:3001
   - Widget Development: http://localhost:3002

## Development

### Running Individual Services

```bash
# Backend only
npm run dev:backend

# Frontend only
npm run dev:frontend

# Widget only
npm run dev:widget
```

### Building for Production

```bash
# Build all packages
npm run build

# Build specific package
npm run build --workspace=backend
npm run build --workspace=frontend
npm run build --workspace=widget
```

### Testing

```bash
# Run all tests
npm test

# Run tests for specific package
npm test --workspace=backend
```

### Linting

```bash
# Lint all packages
npm run lint

# Lint specific package
npm run lint --workspace=backend
```

## Project Structure

```
ai-agent-creator-platform/
├── packages/
│   ├── backend/          # Express.js API server
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── frontend/         # React Agent Builder Studio
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   └── widget/           # Embeddable JavaScript widget
│       ├── src/
│       ├── Dockerfile
│       └── package.json
├── docker-compose.yml
├── package.json
└── README.md
```

## Environment Variables

### Backend (.env)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `REDIS_URL` - Redis connection URL
- `OPENAI_API_KEY` - OpenAI API key for LLM integration
- `ELEVENLABS_API_KEY` - ElevenLabs API key for TTS

### Frontend (.env)
- `VITE_API_URL` - Backend API URL
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

## Docker Development

The project includes Docker configuration for easy development:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild services
docker-compose up --build
```

## API Documentation

Once the backend is running, API documentation will be available at:
- Health check: http://localhost:3001/health
- API base: http://localhost:3001/api

## Widget Integration

To embed the AI widget in a website:

```html
<script src="http://localhost:3002/widget.js" 
        data-agent-id="your-agent-id"
        data-theme="light"
        data-position="bottom-right">
</script>
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.