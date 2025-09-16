# Coolify Deployment Guide for Shiba Wiki

## Current Issue
Your MediaWiki deployment is showing a 502 Bad Gateway error because:
1. **Container Not Starting** - The MediaWiki container is failing to start properly
2. **Database Connection Issues** - Environment variables need to be properly set
3. **MediaWiki Setup Required** - The container needs to complete initial setup

## Step-by-Step Fix

### 1. Set Environment Variables in Coolify

In your Coolify project settings, add these environment variables:

```bash
# Database Configuration (use your Coolify MySQL details)
DB_HOST=mysql-database-pcswcokok4o0oow8ck0ggooc
DB_PORT=3306
DB_USER=mysql
DB_PASSWORD=SOxOZr68REbGT0r1iouM7bSgcCmbfZ0pX3CFPgtVTOoeoODgo9pM6b4vByYCqkGT
DB_NAME=default

# MediaWiki Configuration
SITE_NAME=Shiba Wiki
SITE_SERVER=https://ho4cc0cs4s880cckwgg4o8kg.a.selfhosted.hackclub.com
ADMIN_USER=admin
ADMIN_PASS=your-secure-password-here
ADMIN_EMAIL=admin@yourdomain.com
```

### 2. Redeploy the Application

After setting the environment variables:
1. Go to your Coolify project
2. Click "Deploy" or "Redeploy"
3. Wait for the build to complete
4. Check the container logs to ensure it's starting properly

### 3. MediaWiki is Pre-Configured!

The MediaWiki installation is now **automatically configured** with your database settings:
- ✅ **No installation wizard needed** - LocalSettings.php is pre-generated
- ✅ **Database connection configured** - Uses your Coolify MySQL automatically
- ✅ **Secure keys generated** - Secret and upgrade keys are set
- ✅ **Ready to use** - Just visit your wiki URL and start creating content!

**Visit your wiki:** `https://ho4cc0cs4s880cckwgg4o8kg.a.selfhosted.hackclub.com`

**Default admin account:**
- Username: `admin`
- Password: `adminpass` (change this after first login)

### 4. SSL Certificate Fix

The SSL certificate issue might resolve itself after the MediaWiki setup is complete. If it persists:

1. Check Coolify's SSL settings for your domain
2. Ensure the domain is properly configured in Coolify
3. Wait a few minutes for SSL propagation

## Troubleshooting

### If MediaWiki Setup Page Doesn't Appear
- Check the container logs in Coolify
- Ensure the database connection is working
- Verify all environment variables are set correctly

### If Database Connection Fails
- Verify the MySQL service is running in Coolify
- Check that the database credentials are correct
- Ensure the database name exists

### If SSL Issues Persist
- Check Coolify's SSL certificate status
- Verify domain configuration
- Contact Coolify support if needed

## Expected Result

After completing these steps, you should have:
- ✅ Working MediaWiki installation
- ✅ Proper SSL certificate
- ✅ Database connection established
- ✅ Admin account created
- ✅ Wiki accessible at your domain
- ✅ Persistent storage for configuration and uploads

## Data Persistence

Your MediaWiki data is now persistent across redeployments:
- **Configuration**: `LocalSettings.php` and other config files are saved in `mediawiki-config` volume
- **Uploads**: Images and files are saved in `mediawiki-data` volume
- **Database**: All content is stored in your Coolify MySQL database

## Next Steps

Once MediaWiki is set up:
1. Complete the installation wizard (no need to manually download `LocalSettings.php`)
2. Your configuration will be automatically saved to persistent storage
3. Start creating content in your wiki!
4. Everything will persist across Coolify redeployments
