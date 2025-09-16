#!/bin/bash

# Start Shiba Wiki with Docker
echo "Starting Shiba Wiki..."

# Check if .env file exists
if [ -f .env ]; then
    echo "📋 Using configuration from .env file"
    source .env
    if [ ! -z "$DB_HOST" ] && [ "$DB_HOST" != "database" ]; then
        echo "🗄️  Using external database: $DB_HOST"
        echo "Wiki will be available at: ${SITE_SERVER:-http://localhost:8080}"
    else
        echo "🗄️  Using local Docker MySQL database"
        echo "Wiki will be available at: http://localhost:8080"
    fi
else
    echo "📋 Using default configuration (no .env file found)"
    echo "🗄️  Using local Docker MySQL database"
    echo "Wiki will be available at: http://localhost:8080"
fi

echo "Admin credentials: ${ADMIN_USER:-admin} / ${ADMIN_PASS:-adminpass}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Check if using external database
if [ -f .env ] && [ ! -z "$DB_HOST" ] && [ "$DB_HOST" != "database" ]; then
    echo "Starting MediaWiki with external database..."
    docker-compose -f docker-compose.local.yml up -d mediawiki
else
    echo "Starting MediaWiki with local database..."
    docker-compose -f docker-compose.local.yml --profile local-db up -d
fi

# Wait a moment for services to start
echo "Waiting for services to start..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    echo ""
    echo "✅ Shiba Wiki is now running!"
    if [ -f .env ] && [ ! -z "$SITE_SERVER" ]; then
        echo "🌐 Open your browser and go to: $SITE_SERVER"
    else
        echo "🌐 Open your browser and go to: http://localhost:8080"
    fi
    echo "👤 Admin login: ${ADMIN_USER:-admin} / ${ADMIN_PASS:-adminpass}"
    echo ""
    echo "To stop the wiki, run: docker-compose down"
    echo "To view logs, run: docker-compose logs -f"
    echo ""
    echo "💡 To use an external database (like Coolify), see coolify-setup.md"
else
    echo "❌ Failed to start services. Check the logs with: docker-compose logs"
    exit 1
fi
