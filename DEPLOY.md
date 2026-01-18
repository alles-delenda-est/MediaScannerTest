# Media Scanner - Production Deployment Guide

This guide covers deploying the Media Scanner application to a VPS with SSL.

## Prerequisites

- VPS with Ubuntu 22.04+ (or similar Linux distribution)
- Docker and Docker Compose installed
- Domain name pointing to your VPS IP address
- Port 80 and 443 open in firewall

### Install Docker (if not installed)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for group changes to take effect
```

## Quick Deploy

The fastest way to deploy is using the automated script:

```bash
# Clone the repository
git clone <your-repo-url> media-scanner
cd media-scanner

# Configure environment
cp .env.production .env
nano .env  # Edit with your actual values

# Run deployment
./deploy.sh your-domain.com admin@your-domain.com
```

## Manual Deployment Steps

If you prefer manual control, follow these steps:

### Step 1: Configure Environment

```bash
# Copy production template
cp .env.production .env

# Generate secure secrets
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo "SESSION_SECRET=$(openssl rand -base64 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"
```

Edit `.env` and replace all placeholder values:

| Variable | Description |
|----------|-------------|
| `YOUR_DOMAIN` | Your domain (e.g., `scanner.example.com`) |
| `POSTGRES_PASSWORD` | Secure database password |
| `JWT_SECRET` | Random 32+ character string |
| `SESSION_SECRET` | Random 32+ character string |
| `ANTHROPIC_API_KEY` | Your Claude API key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

### Step 2: Configure Nginx

Update the domain in `nginx/nginx.conf`:

```bash
sed -i 's/DOMAIN_PLACEHOLDER/your-domain.com/g' nginx/nginx.conf
```

### Step 3: Create Certbot Directories

```bash
mkdir -p certbot/conf certbot/www
```

### Step 4: Obtain SSL Certificate

For the initial certificate, use HTTP-only nginx config:

```bash
# Start nginx with init config
cp nginx/nginx.conf nginx/nginx.conf.backup
cp nginx/nginx-init.conf nginx/nginx.conf

docker compose -f docker-compose.prod.yml up -d nginx

# Request certificate
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  -d your-domain.com --email admin@your-domain.com --agree-tos

# Restore full config
mv nginx/nginx.conf.backup nginx/nginx.conf
docker compose -f docker-compose.prod.yml stop nginx
```

### Step 5: Deploy Full Stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Database migrations run automatically on backend startup.

### Step 6: Verify Deployment

```bash
# Check container status
docker compose -f docker-compose.prod.yml ps

# Check health endpoint
curl https://your-domain.com/health

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

## Google OAuth Configuration

Ensure your Google Cloud Console OAuth configuration includes:

1. **Authorized JavaScript origins**: `https://your-domain.com`
2. **Authorized redirect URIs**: `https://your-domain.com/api/auth/google/callback`

## SSL Certificate Renewal

Certificates auto-renew via the certbot container. To manually renew:

```bash
docker compose -f docker-compose.prod.yml run --rm certbot renew
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

## Common Operations

### View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f backend
```

### Restart Services

```bash
# Restart all
docker compose -f docker-compose.prod.yml restart

# Restart specific service
docker compose -f docker-compose.prod.yml restart backend
```

### Update Application

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

### Database Access

```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U media_scanner media_scanner
```

### Stop All Services

```bash
docker compose -f docker-compose.prod.yml down
```

### Remove All Data (CAUTION)

```bash
docker compose -f docker-compose.prod.yml down -v
```

## Troubleshooting

### Backend won't start

Check logs for database connection issues:

```bash
docker compose -f docker-compose.prod.yml logs backend
```

Common issues:
- Database not ready: Backend has retry logic, wait a moment
- Wrong DATABASE_URL: Check .env configuration
- Migration failed: Check migration SQL syntax

### SSL Certificate Issues

If certificate request fails:

1. Verify domain DNS points to server
2. Check port 80 is accessible
3. Review certbot logs: `docker compose -f docker-compose.prod.yml logs certbot`

### OAuth Login Fails

1. Verify `GOOGLE_CALLBACK_URL` matches Google Console config
2. Check callback URL uses HTTPS
3. Verify `ALLOWED_EMAIL_DOMAIN` is correct

## Architecture

```
                    ┌─────────────┐
                    │   Internet  │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │    Nginx    │ :80, :443
                    │  (SSL/TLS)  │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐
    │   Frontend  │ │   Backend   │ │   Certbot   │
    │   (React)   │ │  (Express)  │ │ (SSL Renew) │
    └─────────────┘ └──────┬──────┘ └─────────────┘
                           │
           ┌───────────────┼───────────────┐
           │                               │
    ┌──────┴──────┐                 ┌──────┴──────┐
    │  PostgreSQL │                 │    Redis    │
    │  (Database) │                 │   (Cache)   │
    └─────────────┘                 └─────────────┘
```

## Security Notes

- Never commit `.env` files with real credentials
- Rotate secrets periodically
- Keep Docker and system packages updated
- Consider adding fail2ban for SSH protection
- Enable UFW firewall, allowing only ports 22, 80, 443
