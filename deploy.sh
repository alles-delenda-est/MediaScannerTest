#!/bin/bash
# =============================================================================
# Media Scanner - Production Deployment Script
# =============================================================================
# Usage: ./deploy.sh [DOMAIN] [EMAIL]
# Example: ./deploy.sh scanner.example.com admin@example.com
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_step() {
    echo -e "\n${GREEN}==>${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}WARNING:${NC} $1"
}

print_error() {
    echo -e "${RED}ERROR:${NC} $1"
}

# Check if running as root or with sudo
check_permissions() {
    if [ "$EUID" -ne 0 ] && ! groups | grep -q docker; then
        print_error "Please run as root or ensure user is in docker group"
        exit 1
    fi
}

# Parse arguments
DOMAIN="${1:-}"
EMAIL="${2:-}"

if [ -z "$DOMAIN" ]; then
    echo "Usage: $0 <domain> [email]"
    echo "Example: $0 scanner.example.com admin@example.com"
    exit 1
fi

if [ -z "$EMAIL" ]; then
    EMAIL="admin@${DOMAIN}"
    print_warning "No email provided, using: $EMAIL"
fi

print_step "Starting deployment for: $DOMAIN"

# Step 1: Check .env file exists
print_step "Step 1: Checking environment configuration..."
if [ ! -f .env ]; then
    if [ -f .env.production ]; then
        print_warning ".env not found, copying from .env.production"
        cp .env.production .env
        echo ""
        print_error "Please edit .env with your actual credentials before continuing!"
        echo "Required values to update:"
        echo "  - POSTGRES_PASSWORD"
        echo "  - JWT_SECRET"
        echo "  - SESSION_SECRET"
        echo "  - ANTHROPIC_API_KEY"
        echo "  - GOOGLE_CLIENT_ID"
        echo "  - GOOGLE_CLIENT_SECRET"
        echo ""
        exit 1
    else
        print_error "No .env or .env.production file found!"
        exit 1
    fi
fi

# Check for placeholder values in .env
if grep -q "YOUR_DOMAIN\|CHANGE_THIS\|REPLACE_WITH" .env; then
    print_error "Found placeholder values in .env file!"
    echo "Please replace all YOUR_DOMAIN, CHANGE_THIS, and REPLACE_WITH values"
    exit 1
fi

# Step 2: Update domain in nginx.conf
print_step "Step 2: Updating nginx configuration with domain: $DOMAIN"
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" nginx/nginx.conf
sed -i "s/YOUR_DOMAIN/$DOMAIN/g" .env

echo "Updated nginx/nginx.conf and .env with domain: $DOMAIN"

# Step 3: Create certbot directories
print_step "Step 3: Creating certbot directories..."
mkdir -p certbot/conf certbot/www
echo "Created certbot/conf and certbot/www"

# Step 4: Check if SSL certificates exist
print_step "Step 4: Checking SSL certificates..."
if [ -d "certbot/conf/live/$DOMAIN" ]; then
    echo "SSL certificates already exist for $DOMAIN"
    SKIP_CERT=true
else
    SKIP_CERT=false
    echo "No existing SSL certificates found, will obtain new ones"
fi

# Step 5: Initial SSL certificate (if needed)
if [ "$SKIP_CERT" = false ]; then
    print_step "Step 5: Obtaining SSL certificate..."

    # Use initial nginx config for ACME challenge
    echo "Starting nginx in HTTP-only mode for ACME challenge..."
    cp nginx/nginx.conf nginx/nginx.conf.backup
    cp nginx/nginx-init.conf nginx/nginx.conf

    # Start nginx with init config
    docker compose -f docker-compose.prod.yml up -d nginx

    # Wait for nginx to be ready
    sleep 5

    # Request certificate
    echo "Requesting certificate from Let's Encrypt..."
    docker compose -f docker-compose.prod.yml run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        -d "$DOMAIN" \
        --email "$EMAIL" \
        --agree-tos \
        --non-interactive

    # Restore full nginx config
    mv nginx/nginx.conf.backup nginx/nginx.conf

    # Stop nginx (will be restarted with full stack)
    docker compose -f docker-compose.prod.yml stop nginx

    echo "SSL certificate obtained successfully!"
else
    print_step "Step 5: Skipping SSL certificate (already exists)"
fi

# Step 6: Deploy full stack
print_step "Step 6: Building and deploying full stack..."
docker compose -f docker-compose.prod.yml up -d --build

# Step 7: Wait for services to be healthy
print_step "Step 7: Waiting for services to be healthy..."
sleep 10

# Check health
echo "Checking service health..."
docker compose -f docker-compose.prod.yml ps

# Step 8: Verify deployment
print_step "Step 8: Verifying deployment..."
echo ""

# Check health endpoint
HEALTH_URL="https://$DOMAIN/health"
echo "Testing health endpoint: $HEALTH_URL"

# Give services more time to start
sleep 5

if curl -sf -o /dev/null "$HEALTH_URL" 2>/dev/null; then
    echo -e "${GREEN}Health check passed!${NC}"
else
    print_warning "Health check failed or not yet available"
    echo "This may be normal if services are still starting"
    echo "Try: curl $HEALTH_URL"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Deployment complete!${NC}"
echo "=========================================="
echo ""
echo "Your application should now be available at:"
echo "  https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "  docker compose -f docker-compose.prod.yml ps      # Check status"
echo "  docker compose -f docker-compose.prod.yml logs    # View logs"
echo "  docker compose -f docker-compose.prod.yml down    # Stop all services"
echo ""
echo "Verification checklist:"
echo "  [ ] Health endpoint: curl https://$DOMAIN/health"
echo "  [ ] Dashboard loads in browser"
echo "  [ ] Google OAuth login works"
echo "  [ ] Manual scan executes"
echo ""
