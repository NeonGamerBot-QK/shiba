FROM mediawiki:1.41.1

# Copy the initialization script and test script
COPY init-mediawiki.sh /usr/local/bin/
COPY test-db-connection.php /usr/local/bin/
RUN chmod +x /usr/local/bin/init-mediawiki.sh

# Set the entrypoint to our init script
ENTRYPOINT ["/usr/local/bin/init-mediawiki.sh"]
