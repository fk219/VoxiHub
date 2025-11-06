# Agent Builder Studio Frontend

This is the React frontend application for the AI Agent Creator Platform's Agent Builder Studio.

## Features

- **React 18** with TypeScript for type-safe development
- **Vite** for fast development and building
- **React Router** for client-side routing
- **Context API** for state management
- **TanStack Query** for server state management
- **Supabase** integration for authentication and data
- **Tailwind CSS** for styling (configured via index.css)
- **ESLint & Prettier** for code quality and formatting
- **Vitest** for testing

## Project Structure

```
src/
├── components/          # Reusable UI components
├── contexts/           # React Context providers
├── lib/               # Utility libraries (API client, Supabase)
├── pages/             # Page components
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
└── __tests__/         # Test files
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## Environment Variables

Copy `.env.example` to `.env` and configure:

```
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Routes

- `/` - Dashboard
- `/agents` - Agent list
- `/agents/new` - Create new agent
- `/agents/:id` - Edit agent
- `/agents/:id/deploy` - Deploy agent

## State Management

The application uses React Context API for global state management:

- `AppContext` - Main application state (user, agents, loading, errors)
- State is managed through a reducer pattern for predictable updates

## API Integration

- API client configured in `src/lib/api.ts`
- Supabase client configured in `src/lib/supabase.ts`
- TanStack Query for server state management and caching