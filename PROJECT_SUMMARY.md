# Media Scanner - Project Summary

## Overview

Media Scanner is a French-language web application that automatically scans French regional media and social media for news articles highlighting administrative absurdities and bureaucratic excess. It uses Claude AI for relevance analysis and generates witty French social media posts for the Parti Libéral Français.

## Key Features

- **Automated RSS Scanning**: Monitors French news sources via RSS feeds
- **AI-Powered Analysis**: Uses Claude AI to evaluate article relevance against customizable topics
- **Multi-Topic Support**: Define multiple topics with keywords and AI prompts
- **Post Generation**: Automatically generates social media posts in French
- **Google OAuth**: Secure authentication restricted to specific email domains
- **Dashboard**: View statistics, manage sources, review articles and generated posts

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React + TypeScript + Vite + Tailwind CSS |
| **Backend** | Node.js + Express + TypeScript |
| **Database** | PostgreSQL |
| **Cache/Queue** | Redis + BullMQ |
| **AI** | Claude API (Anthropic) |
| **Auth** | Google OAuth via Passport.js |
| **Monorepo** | pnpm workspaces |

## Project Structure

```
media-scanner/
├── packages/
│   ├── shared/          # Shared types, constants, AI prompts
│   ├── backend/         # Express API + job workers
│   │   ├── src/
│   │   │   ├── routes/      # API endpoints
│   │   │   ├── services/    # Business logic (AI, RSS, etc.)
│   │   │   ├── repositories/# Database access
│   │   │   ├── jobs/        # BullMQ workers
│   │   │   └── db/          # Migrations and seeds
│   │   └── Dockerfile
│   └── frontend/        # React dashboard
│       ├── src/
│       │   ├── pages/       # Dashboard, Articles, Posts, Topics, Sources
│       │   ├── components/  # Reusable UI components
│       │   └── api/         # API client
│       └── Dockerfile
├── nginx/               # Reverse proxy configuration
├── docker-compose.yml   # Development setup
├── docker-compose.prod.yml  # Production deployment
└── docker-compose.local.yml # Local deployment with Cloudflare Tunnel
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│                   (React Dashboard)                          │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP/REST
┌─────────────────────────▼───────────────────────────────────┐
│                        Backend                               │
│                    (Express API)                             │
├─────────────────────────────────────────────────────────────┤
│  Routes: /api/articles, /api/posts, /api/topics, /api/sources│
│  Services: RSS Fetcher, AI Analyzer, Post Generator          │
│  Workers: RSS Scan, AI Analysis, Post Generation             │
└───────────┬─────────────────────────────────┬───────────────┘
            │                                 │
┌───────────▼───────────┐       ┌─────────────▼─────────────┐
│      PostgreSQL       │       │          Redis            │
│  - Users              │       │  - Job queues (BullMQ)    │
│  - Articles           │       │  - Deduplication cache    │
│  - Topics             │       │  - Session store          │
│  - Posts              │       └───────────────────────────┘
│  - Sources            │
│  - Scans              │
└───────────────────────┘
```

## How It Works

1. **RSS Scanning**: Scheduled jobs fetch articles from configured French news sources
2. **Keyword Filtering**: Articles are pre-filtered against topic keywords
3. **AI Analysis**: Claude AI evaluates relevance using topic-specific prompts
4. **Post Generation**: High-relevance articles trigger automatic post creation
5. **Review & Publish**: Users review generated posts and copy to social media

## Topics System

Topics allow flexible categorization with:
- **Keywords**: For fast pre-filtering (e.g., "bureaucratie", "administration")
- **AI Prompt**: Natural language criteria for Claude to evaluate relevance
- **Minimum Score**: Threshold for triggering post generation (0.0 - 1.0)

Default topic: "Absurdités Administratives" - identifies articles about administrative dysfunction, excessive regulations, and bureaucratic absurdity.

## Deployment Options

1. **VPS**: Docker Compose with Nginx + Let's Encrypt SSL
2. **Local Laptop**: Docker Compose with Cloudflare Tunnel (free SSL)
3. **Cloud**: Google Cloud, DigitalOcean, etc.

## Quick Start (Development)

```bash
# Prerequisites: Node.js 20+, pnpm, Docker

# Clone and install
git clone https://github.com/alles-delenda-est/MediaScannerTest.git
cd MediaScannerTest
pnpm install

# Start databases
docker compose up -d

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Run migrations
pnpm db:migrate

# Start development servers
pnpm dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `ANTHROPIC_API_KEY` | Claude API key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret |
| `JWT_SECRET` | Secret for JWT tokens |
| `ALLOWED_EMAIL_DOMAIN` | Restrict login to this domain |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/articles` | List articles with filtering |
| `GET /api/posts` | List generated posts |
| `GET /api/topics` | List/manage topics |
| `GET /api/sources` | List/manage RSS sources |
| `GET /api/dashboard/stats` | Dashboard statistics |
| `POST /api/scans/trigger` | Manually trigger scan |

## License

Private project for Parti Libéral Français.

## Repository

https://github.com/alles-delenda-est/MediaScannerTest
