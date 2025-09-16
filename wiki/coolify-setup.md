# Coolify Setup Guide for Shiba Wiki

This guide will help you set up the Shiba Wiki to use a MySQL database hosted on your Coolify server.

## Step 1: Create MySQL Database on Coolify

1. **Log into your Coolify dashboard**
2. **Create a new MySQL service:**
   - Go to "Services" → "Add Service"
   - Select "MySQL" from the database options
   - Choose a version (MySQL 8.0 recommended)
   - Set the following configuration:
     - **Database Name**: `wikidb`
     - **Username**: `wikiuser`
     - **Password**: Choose a strong password
     - **Root Password**: Choose a strong root password

3. **Note the connection details:**
   - Host: Usually something like `mysql.your-coolify-domain.com`
   - Port: Usually `3306`
   - Database: `wikidb`
   - Username: `wikiuser`
   - Password: (the one you set)

## Step 2: Configure Environment Variables

1. **Copy the environment file:**
   ```bash
   cp env.example .env
   ```

2. **Edit the `.env` file** with your Coolify database details:
   ```bash
   # MediaWiki Configuration
   SITE_NAME=Shiba Wiki
   SITE_SERVER=https://your-wiki-domain.com
   ADMIN_USER=admin
   ADMIN_PASS=your-secure-admin-password
   ADMIN_EMAIL=admin@yourdomain.com

   # External Database Configuration (Coolify MySQL)
   DB_HOST=mysql.your-coolify-domain.com
   DB_PORT=3306
   DB_USER=wikiuser
   DB_PASSWORD=your-database-password
   DB_NAME=wikidb
   ```

## Step 3: Deploy to Coolify

### Option A: Deploy as Docker Compose Service

1. **Create a new project in Coolify**
2. **Upload your wiki folder** or connect to your Git repository
3. **Set the environment variables** in Coolify dashboard
4. **Deploy using the docker-compose.yml**

### Option B: Deploy as Standalone Container

1. **Create a new project in Coolify**
2. **Use the MediaWiki Docker image**: `mediawiki:1.41.1`
3. **Set environment variables** in Coolify dashboard
4. **Mount volumes** for persistent data:
   - `/var/www/html/images` → Persistent volume for uploads
   - `/var/www/html/cache` → Persistent volume for cache

## Step 4: Environment Variables for Coolify

Set these in your Coolify project settings:

```bash
# MediaWiki Configuration
SITE_NAME=Shiba Wiki
SITE_SERVER=https://your-wiki-domain.com
ADMIN_USER=admin
ADMIN_PASS=your-secure-admin-password
ADMIN_EMAIL=admin@yourdomain.com

# Database Configuration
DB_HOST=mysql.your-coolify-domain.com
DB_PORT=3306
DB_USER=wikiuser
DB_PASSWORD=your-database-password
DB_NAME=wikidb
```

## Step 5: Local Development with Coolify Database

If you want to run the wiki locally but use the Coolify database:

1. **Create a `.env` file** with your Coolify database details
2. **Start only the MediaWiki container:**
   ```bash
   docker-compose up mediawiki
   ```
   (This will skip the local database since it's in the `local-db` profile)

## Troubleshooting

- **Connection issues**: Verify your Coolify MySQL service is running and accessible
- **Permission issues**: Ensure the database user has proper privileges
- **SSL issues**: You may need to configure SSL for the database connection
- **Firewall**: Make sure the MySQL port (3306) is accessible from your deployment

## Security Notes

- Use strong passwords for both admin and database accounts
- Consider using SSL/TLS for database connections
- Regularly backup your database
- Keep MediaWiki and extensions updated
