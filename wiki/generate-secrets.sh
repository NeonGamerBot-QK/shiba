#!/bin/bash

# Generate secure random keys for MediaWiki
echo "Generating MediaWiki secrets..."

SECRET_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-64)
UPGRADE_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-64)

echo "Secret Key: $SECRET_KEY"
echo "Upgrade Key: $UPGRADE_KEY"

# Update the Dockerfile with the generated keys
sed -i.bak "s/your-secret-key-here-change-this/$SECRET_KEY/g" Dockerfile
sed -i.bak "s/your-upgrade-key-here-change-this/$UPGRADE_KEY/g" Dockerfile

echo "Updated Dockerfile with secure keys!"
echo "You can now build and deploy your MediaWiki."
