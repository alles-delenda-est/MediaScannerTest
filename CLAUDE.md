# Media Scanner - Claude Code Configuration

## Project Overview

French-language media scanner web application that scans French regional media and social media for news highlighting administrative absurdities and bureaucratic excess. Uses Claude AI for relevance analysis and generates witty French social media posts.

## Tech Stack

- **Monorepo**: pnpm workspaces
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL
- **Cache/Queue**: Redis + BullMQ
- **AI**: Claude API (Anthropic)
- **Auth**: Google OAuth via Passport.js

## Project Structure

```
media-scanner/
├── packages/
│   ├── shared/     # Shared types, constants, prompts
│   ├── backend/    # Express API + job workers
│   └── frontend/   # React dashboard
├── docker-compose.yml
└── .env.example
```

## Key Commands

```bash
# Install dependencies
pnpm install

# Start development (all packages)
pnpm dev

# Start only backend
pnpm dev:backend

# Start only frontend
pnpm dev:frontend

# Build all packages
pnpm build

# Database operations
docker-compose up -d postgres redis
pnpm db:migrate
pnpm db:seed
```

## Environment Setup

1. Copy `.env.example` to `.env`
2. Fill in required values:
   - `ANTHROPIC_API_KEY` - Claude API key
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - OAuth credentials
   - `JWT_SECRET` / `SESSION_SECRET` - Random strings for security

## Key Files

- `packages/shared/src/constants/prompts.ts` - AI prompts for relevance analysis
- `packages/shared/src/constants/sources.ts` - French news RSS feed registry
- `packages/backend/src/db/migrations/001_initial_schema.sql` - Database schema
- `packages/backend/src/services/ai/` - Claude API integration (to be implemented)
- `packages/frontend/src/pages/PostsPage.tsx` - Copy-to-clipboard UI for posts

## API Endpoints

- `GET /api/articles` - List articles with filtering
- `GET /api/posts` - List generated posts
- `GET /api/dashboard/stats` - Dashboard statistics
- `POST /api/scans/trigger` - Manually trigger scan

## Development Notes

- Frontend runs on port 5173 with proxy to backend
- Backend runs on port 3001
- PostgreSQL on port 5432, Redis on port 6379
- All dates use Paris timezone (Europe/Paris)
- AI prompts are in French for better output quality
