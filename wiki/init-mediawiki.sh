#!/bin/bash

# Create LocalSettings.php if it doesn't exist or if we have environment variables
if [ ! -f "/var/www/html/LocalSettings.php" ] || [ -n "$DB_PASSWORD" ]; then
    echo "Creating/Updating LocalSettings.php..."
    # Remove existing LocalSettings.php to ensure clean recreation
    rm -f /var/www/html/LocalSettings.php
    echo "Debug: Environment variables:"
    echo "DB_HOST: $DB_HOST"
    echo "DB_PORT: $DB_PORT"
    echo "DB_USER: $DB_USER"
    echo "DB_NAME: $DB_NAME"
    echo "SITE_SERVER: $SITE_SERVER"
    echo "MEDIAWIKI_DB_HOST: $MEDIAWIKI_DB_HOST"
    echo "MEDIAWIKI_DB_PORT: $MEDIAWIKI_DB_PORT"
    echo "MEDIAWIKI_DB_USER: $MEDIAWIKI_DB_USER"
    echo "MEDIAWIKI_DB_NAME: $MEDIAWIKI_DB_NAME"
    echo "MEDIAWIKI_SITE_SERVER: $MEDIAWIKI_SITE_SERVER"
    
    # Test database connection
    echo "Testing database connection..."
    php /usr/local/bin/test-db-connection.php || echo "Database connection test failed, but continuing with installation..."
    
    # Run MediaWiki database setup
    echo "Setting up MediaWiki database schema..."
    php /var/www/html/maintenance/install.php \
        --dbtype=mysql \
        --dbserver="a.selfhosted.hackclub.com" \
        --dbport="${DB_PORT:-3306}" \
        --dbname="${DB_NAME:-default}" \
        --dbuser="${DB_USER:-mysql}" \
        --dbpass="${DB_PASSWORD}" \
        --scriptpath="" \
        --lang=en \
        --pass="${ADMIN_PASS}" \
        "${SITE_NAME:-Shiba Wiki}" \
        "${ADMIN_USER:-admin}" || echo "MediaWiki installation failed, but continuing..."
    
    cat > /var/www/html/LocalSettings.php << EOF
<?php
# This file was automatically generated for Shiba Wiki
# MediaWiki 1.41.1 LocalSettings.php

# Database settings
\$wgDBtype = "mysql";
\$wgDBserver = "a.selfhosted.hackclub.com";  # Always use external hostname
\$wgDBport = getenv('DB_PORT') ?: "3306";
\$wgDBname = getenv('DB_NAME') ?: "default";
\$wgDBuser = getenv('DB_USER') ?: "mysql";
\$wgDBpassword = getenv('DB_PASSWORD');

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

# Enable skins
wfLoadSkin( 'MinervaNeue' );
wfLoadSkin( 'MonoBook' );
wfLoadSkin( 'Timeless' );
wfLoadSkin( 'Vector' );

# Set default skin
\$wgDefaultSkin = 'vector';

# Hide editing interface for non-logged-in users (but allow logged-in admins)
\$wgGroupPermissions['*']['edit'] = false;
\$wgGroupPermissions['*']['createpage'] = false;
\$wgGroupPermissions['*']['createtalk'] = false;
\$wgGroupPermissions['*']['writeapi'] = false;

# Allow logged-in users to edit (this includes admins)
\$wgGroupPermissions['user']['edit'] = true;
\$wgGroupPermissions['user']['createpage'] = true;
\$wgGroupPermissions['user']['createtalk'] = true;

# Hide login/logout buttons for a cleaner look
\$wgShowIPinHeader = false;
\$wgShowUserGroups = false;

# Disable user registration
\$wgDisableUserRegistration = true;

# Hide various UI elements for cleaner appearance
\$wgShowExceptionDetails = false;
\$wgShowDBErrorBacktrace = false;
\$wgShowSQLErrors = false;

# Custom CSS to hide more UI elements for a cleaner look
\$wgResourceModules['ext.gadget.cleanui'] = [
    'styles' => 'cleanui.css',
    'localBasePath' => '/var/www/html/',
    'remoteExtPath' => '',
];

# Add custom CSS to hide edit buttons, talk pages, and other intimidating elements
\$wgHooks['BeforePageDisplay'][] = function( \$out, \$skin ) {
    \$out->addInlineStyle('
        .mw-editsection,
        .mw-editsection-like,
        .ca-edit,
        .ca-addsection,
        .ca-talk,
        .ca-history,
        .ca-move,
        .ca-delete,
        .ca-protect,
        .ca-watch,
        .ca-unwatch,
        .mw-indicators,
        .mw-jump-link,
        .vector-page-toolbar,
        .vector-page-toolbar-container,
        .vector-page-toolbar .mw-portlet,
        .vector-user-menu,
        .vector-user-links,
        .mw-navigation,
        .mw-footer,
        .mw-footer-info,
        .mw-footer-places,
        .mw-footer-icons,
        .mw-createaccount,
        .mw-createaccount-join,
        .ca-createaccount,
        .createaccount,
        .mw-ui-button[href*="createaccount"],
        .mw-ui-button[href*="Special:UserLogin"] {
            display: none !important;
        }
        
        /* Make the main content area cleaner */
        .mw-body {
            margin-top: 0 !important;
        }
        
        /* Hide the "This page is a stub" and other notices */
        .ambox,
        .metadata,
        .catlinks,
        .printfooter {
            display: none !important;
        }
        
        /* Clean up the header */
        .vector-header-container {
            border-bottom: none !important;
        }
    ');
    return true;
};

# Logo configuration
\$wgLogos = [
    '1x' => "\$wgScriptPath/images/ShibaStar.png",
    'icon' => "\$wgScriptPath/images/ShibaStar.png",
    'wordmark' => [
        'src' => "\$wgScriptPath/images/ShibaStar.png",
        'width' => 120,
        'height' => 120,
    ],
];

# End of automatically generated LocalSettings.php
EOF

    # Set proper permissions
    chown www-data:www-data /var/www/html/LocalSettings.php
    chmod 644 /var/www/html/LocalSettings.php
    
    # Set permissions for logo
    if [ -f "/var/www/html/images/ShibaStar.png" ]; then
        chown www-data:www-data /var/www/html/images/ShibaStar.png
        chmod 644 /var/www/html/images/ShibaStar.png
        echo "Logo permissions set successfully!"
        echo "Logo file exists at: /var/www/html/images/ShibaStar.png"
        ls -la /var/www/html/images/ShibaStar.png
    else
        echo "WARNING: Logo file not found at /var/www/html/images/ShibaStar.png"
        echo "Contents of /var/www/html/images/:"
        ls -la /var/www/html/images/ || echo "Images directory not found"
    fi
    
    echo "LocalSettings.php created successfully!"
else
    echo "LocalSettings.php already exists, skipping creation."
fi

# Start Apache
exec apache2-foreground
