#!/bin/bash
set -e

# Wait for database to be ready
if [ ! -z "$MEDIAWIKI_DB_HOST" ] && [ "$MEDIAWIKI_DB_HOST" != "database" ]; then
    echo "Waiting for database connection..."
    until mysqladmin ping -h"$MEDIAWIKI_DB_HOST" -P"${MEDIAWIKI_DB_PORT:-3306}" -u"$MEDIAWIKI_DB_USER" -p"$MEDIAWIKI_DB_PASSWORD" --silent; do
        echo "Database is unavailable - sleeping"
        sleep 2
    done
    echo "Database is ready!"
fi

# Check if MediaWiki is already configured
if [ ! -f "/var/www/html/LocalSettings.php" ]; then
    echo "MediaWiki not configured, starting setup..."
    
    # Set proper permissions
    chown -R www-data:www-data /var/www/html
    chmod -R 755 /var/www/html
    
    # Create images directory with proper permissions
    mkdir -p /var/www/html/images
    chown -R www-data:www-data /var/www/html/images
    chmod -R 755 /var/www/html/images
fi

# Start Apache
exec apache2-foreground
