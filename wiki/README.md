# Shiba Wiki

This is a MediaWiki installation for the Shiba project.

## Quick Start

1. **Start the wiki with Docker:**
   ```bash
   ./start-wiki.sh
   ```
   Or manually:
   ```bash
   docker-compose -f docker-compose.local.yml up -d
   ```

2. **Access the wiki:**
   - Open your browser and go to `http://localhost:8080`
   - The wiki should be automatically configured with the following credentials:
     - Admin username: `admin`
     - Admin password: `adminpass`

3. **Stop the wiki:**
   ```bash
   docker-compose -f docker-compose.local.yml down
   ```

## Manual Installation (Alternative)

If you prefer to set up MediaWiki manually without Docker:

1. **Set up a database:**
   - Create a MySQL/MariaDB database named `wikidb`
   - Create a user `wikiuser` with password `wikipass`
   - Grant all privileges on `wikidb` to `wikiuser`

2. **Configure web server:**
   - Point your web server to the `wiki` directory
   - Ensure PHP 7.4+ is installed with required extensions

3. **Run the installer:**
   - Navigate to your wiki URL in a browser
   - Follow the MediaWiki installation wizard
   - Use the database credentials from step 1

## Configuration

The Docker setup includes:
- MediaWiki 1.41.1
- MySQL 8.0 database
- Pre-configured database connection
- Admin account setup

### Docker Compose Files

- **`docker-compose.yml`** - For Coolify deployment (uses `expose` instead of `ports`)
- **`docker-compose.local.yml`** - For local development (uses `ports` for direct access)
- **`start-wiki.sh`** - Automatically uses the local compose file

## Files

- `docker-compose.yml` - Docker configuration for easy deployment
- `LocalSettings.php` - MediaWiki configuration (generated after first run)
- `images/` - Uploaded files and images
- `cache/` - MediaWiki cache files

## Troubleshooting

- If the wiki doesn't start, check Docker logs: `docker-compose logs`
- Database connection issues: Verify the database container is running
- Permission issues: Ensure the `images/` directory is writable