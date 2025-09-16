#!/bin/bash

# Create LocalSettings.php if it doesn't exist
if [ ! -f "/var/www/html/LocalSettings.php" ]; then
    echo "Creating LocalSettings.php..."
    echo "Debug: Environment variables:"
    echo "DB_HOST: $DB_HOST"
    echo "DB_PORT: $DB_PORT"
    echo "DB_USER: $DB_USER"
    echo "DB_NAME: $DB_NAME"
    echo "SITE_SERVER: $SITE_SERVER"
    
    # Test database connection
    echo "Testing database connection..."
    php /usr/local/bin/test-db-connection.php
    
    cat > /var/www/html/LocalSettings.php << EOF
<?php
# This file was automatically generated for Shiba Wiki
# MediaWiki 1.41.1 LocalSettings.php

# Database settings
\$wgDBtype = "mysql";
\$wgDBserver = "a.selfhosted.hackclub.com";  # Use external hostname
\$wgDBport = "3306";  # Use external port
\$wgDBname = getenv('DB_NAME') ?: "wikidb";
\$wgDBuser = getenv('DB_USER') ?: "wikiuser";
\$wgDBpassword = getenv('DB_PASSWORD') ?: "wikipass";

# Site settings
\$wgSitename = getenv('SITE_NAME') ?: "Shiba Wiki";
\$wgMetaNamespace = "Shiba_Wiki";

# Server settings
\$wgServer = getenv('SITE_SERVER') ?: "http://localhost:8080";
\$wgScriptPath = "";
\$wgResourceBasePath = \$wgScriptPath;

# Upload settings
\$wgEnableUploads = true;
\$wgUseImageMagick = true;
\$wgImageMagickConvertCommand = "/usr/bin/convert";

# Security settings
\$wgSecretKey = "dEsrld222IAexg2XZLFkFsd8OHOpdyl4jB5qWoof5g";
\$wgUpgradeKey = "hv3c0w6rbBUVmJGcLFe2PWe4A17RN4bDzuXC4P3mpo";

# Admin user
\$wgEmergencyContact = getenv('ADMIN_EMAIL') ?: "admin@example.com";
\$wgPasswordSender = getenv('ADMIN_EMAIL') ?: "admin@example.com";

# Cache settings
\$wgMainCacheType = CACHE_ACCEL;
\$wgMemCachedServers = [];

# Language settings
\$wgLanguageCode = "en";
\$wgLocaltimezone = "UTC";

# Email settings
\$wgEnableEmail = true;
\$wgEnableUserEmail = true;
\$wgEnotifUserTalk = false;
\$wgEnotifWatchlist = false;
\$wgEmailAuthentication = true;

# File uploads
\$wgFileExtensions = array( 'png', 'gif', 'jpg', 'jpeg', 'webp', 'svg', 'pdf', 'doc', 'docx', 'txt', 'zip' );
\$wgMaxUploadSize = 100 * 1024 * 1024; // 100MB

# Performance settings
\$wgShowExceptionDetails = true;
\$wgShowDBErrorBacktrace = true;
\$wgShowSQLErrors = true;

# Extensions (basic ones)
\$wgEnableAPI = true;
\$wgEnableWriteAPI = true;

# End of automatically generated LocalSettings.php
EOF

    # Set proper permissions
    chown www-data:www-data /var/www/html/LocalSettings.php
    chmod 644 /var/www/html/LocalSettings.php
    
    echo "LocalSettings.php created successfully!"
else
    echo "LocalSettings.php already exists, skipping creation."
fi

# Start Apache
exec apache2-foreground
