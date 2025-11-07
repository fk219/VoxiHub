# Deployment Guide - VoxiHub

## Project Structure

Yes, this is a **monorepo** with separate packages:

```
VoxiHub/
├── packages/
│   ├── frontend/     # React/Vite app
│   ├── backend/      # Node.js/Express API
│   └── widget/       # Embeddable widgets (future)
```

## ⚠️ Important: Separate Deployment Required

**You MUST deploy backend and frontend separately** because:
1. Backend needs Node.js runtime (Express server)
2. Frontend is a static React app
3. Different scaling requirements
4. Different environment variables

## Recommended Deployment Architecture

```
┌─────────────────────────────────────────┐
│  Frontend (Vercel/Netlify)              │
│  https://voxihub.com                    │
│  - Static React app                     │
│  - CDN distributed                      │
└──────────────┬──────────────────────────┘
               │ API calls
               ▼
┌─────────────────────────────────────────┐
│  Backend (Railway/Render/Heroku)        │
│  https://api.voxihub.com                │
│  - Express API server                   │
│  - WebSocket support                    │
│  - Database connections                 │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Database (Supabase/PostgreSQL)         │
│  - PostgreSQL database                  │
│  - Vector storage (pgvector)            │
└─────────────────────────────────────────┘
```

## Deployment Options

### Option 1: Recommended Setup (Best Performance)

**Frontend**: Vercel
**Backend**: Railway or Render
**Database**: Supabase (includes PostgreSQL + Auth)
**File Storage**: AWS S3 or Cloudflare R2

### Option 2: All-in-One (Simpler)

**Frontend**: Vercel
**Backend**: Vercel Serverless Functions
**Database**: Supabase
**Note**: Limited for real-time features

### Option 3: Self-Hosted (Full Control)

**Everything**: VPS (DigitalOcean, AWS EC2, etc.)
**Use**: Docker Compose

---

## 1. Frontend Deployment (Vercel)

### Step 1: Prepare Frontend

Create `packages/frontend/vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Step 2: Environment Variables

Add to Vercel dashboard:
```env
VITE_API_URL=https://api.voxihub.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_CLIENT_ORGANIZATION_ID=your-org-id
```

### Step 3: Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Navigate to frontend
cd packages/frontend

# Deploy
vercel --prod
```

**Or use Vercel Dashboard:**
1. Connect GitHub repo
2. Set root directory: `packages/frontend`
3. Framework: Vite
4. Add environment variables
5. Deploy

---

## 2. Backend Deployment (Railway)

### Step 1: Prepare Backend

Create `packages/backend/Procfile`:
```
web: npm start
```

Create `packages/backend/railway.json`:
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

Update `packages/backend/package.json`:
```json
{
  "scripts": {
    "start": "node dist/index.js",
    "build": "tsc",
    "dev": "ts-node-dev src/index.ts"
  }
}
```

### Step 2: Environment Variables

Add to Railway:
```env
NODE_ENV=production
PORT=3001

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# OpenAI
OPENAI_API_KEY=sk-...

# Redis
REDIS_URL=redis://...

# Twilio (optional)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...

# AWS S3 (optional)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=...

# Security
JWT_SECRET=your-secret-key
SESSION_SECRET=your-session-secret

# CORS
ALLOWED_ORIGINS=https://voxihub.com,https://www.voxihub.com
```

### Step 3: Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Navigate to backend
cd packages/backend

# Initialize
railway init

# Deploy
railway up
```

**Or use Railway Dashboard:**
1. New Project → Deploy from GitHub
2. Set root directory: `packages/backend`
3. Add environment variables
4. Deploy

---

## 3. Database Setup (Supabase)

### Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Create new project
3. Wait for database provisioning

### Step 2: Run Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Link project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

Or manually run SQL migrations in Supabase SQL Editor.

### Step 3: Enable Extensions

Run in Supabase SQL Editor:
```sql
-- Enable vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

## 4. Alternative: Docker Deployment

### Create `docker-compose.yml` in root:

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./packages/frontend
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    environment:
      - VITE_API_URL=http://localhost:3001
    depends_on:
      - backend

  backend:
    build:
      context: ./packages/backend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/voxihub
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=voxihub
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Frontend Dockerfile:

```dockerfile
# packages/frontend/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Backend Dockerfile:

```dockerfile
# packages/backend/Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

EXPOSE 3001
CMD ["npm", "start"]
```

### Deploy with Docker:

```bash
docker-compose up -d
```

---

## 5. Domain Configuration

### Frontend (Vercel)
1. Add custom domain in Vercel dashboard
2. Point DNS A record to Vercel:
   ```
   A    @    76.76.21.21
   CNAME www  cname.vercel-dns.com
   ```

### Backend (Railway)
1. Add custom domain in Railway dashboard
2. Point DNS CNAME record:
   ```
   CNAME api  your-app.up.railway.app
   ```

---

## 6. Environment-Specific Configuration

### Development
```env
# packages/frontend/.env.development
VITE_API_URL=http://localhost:3001

# packages/backend/.env.development
NODE_ENV=development
PORT=3001
```

### Production
```env
# Set in hosting platform dashboard
VITE_API_URL=https://api.voxihub.com
NODE_ENV=production
```

---

## 7. CI/CD Setup (GitHub Actions)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Deploy to Vercel
        run: |
          cd packages/frontend
          npm ci
          npm run build
          npx vercel --prod --token=${{ secrets.VERCEL_TOKEN }}

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Deploy to Railway
        run: |
          cd packages/backend
          npm ci
          npm run build
          npx railway up --token=${{ secrets.RAILWAY_TOKEN }}
```

---

## 8. Post-Deployment Checklist

- [ ] Frontend loads correctly
- [ ] API endpoints respond
- [ ] Database connections work
- [ ] Authentication works
- [ ] File uploads work
- [ ] WebSocket connections work (if implemented)
- [ ] CORS configured correctly
- [ ] SSL certificates active
- [ ] Environment variables set
- [ ] Monitoring configured

---

## 9. Monitoring & Logging

### Recommended Tools:
- **Vercel Analytics** - Frontend monitoring
- **Railway Logs** - Backend logs
- **Sentry** - Error tracking
- **LogRocket** - Session replay
- **Supabase Dashboard** - Database monitoring

---

## 10. Cost Estimates

### Hobby/Starter (< 1000 users)
- Vercel: Free (Hobby plan)
- Railway: $5-20/month
- Supabase: Free (includes 500MB database)
- **Total**: $5-20/month

### Small Business (< 10,000 users)
- Vercel: $20/month (Pro)
- Railway: $20-50/month
- Supabase: $25/month (Pro)
- **Total**: $65-95/month

### Growth (< 100,000 users)
- Vercel: $20/month
- Railway: $50-200/month
- Supabase: $25-100/month
- **Total**: $95-320/month

---

## Quick Start Commands

```bash
# 1. Deploy Frontend to Vercel
cd packages/frontend
vercel --prod

# 2. Deploy Backend to Railway
cd packages/backend
railway up

# 3. Or use Docker
docker-compose up -d

# 4. Check status
curl https://api.voxihub.com/health
```

---

## Troubleshooting

### Frontend can't reach backend
- Check CORS settings in backend
- Verify VITE_API_URL is correct
- Check network tab in browser

### Backend crashes
- Check Railway logs
- Verify all environment variables
- Check database connection

### Database connection fails
- Verify DATABASE_URL format
- Check Supabase project status
- Verify IP whitelist (if applicable)

---

## Summary

**Yes, deploy separately:**
1. **Frontend** → Vercel (static hosting)
2. **Backend** → Railway/Render (Node.js hosting)
3. **Database** → Supabase (managed PostgreSQL)

This gives you the best performance, scalability, and cost-effectiveness!
