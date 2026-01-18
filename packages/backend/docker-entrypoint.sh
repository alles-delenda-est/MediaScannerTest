#!/bin/sh
set -e

echo "==================================="
echo "Media Scanner Backend Startup"
echo "==================================="

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
max_retries=30
count=0

while [ $count -lt $max_retries ]; do
    if node -e "
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        pool.query('SELECT 1')
            .then(() => { pool.end(); process.exit(0); })
            .catch(() => { pool.end(); process.exit(1); });
    " 2>/dev/null; then
        echo "PostgreSQL is ready!"
        break
    fi

    count=$((count + 1))
    echo "Waiting for PostgreSQL... ($count/$max_retries)"
    sleep 2
done

if [ $count -eq $max_retries ]; then
    echo "ERROR: Could not connect to PostgreSQL after $max_retries attempts"
    exit 1
fi

# Run database migrations
echo ""
echo "Running database migrations..."
node dist/db/migrate.js

echo ""
echo "Starting application..."
exec node dist/index.js
