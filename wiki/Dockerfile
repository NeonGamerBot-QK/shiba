FROM mediawiki:1.41.1

# Install network testing tools
RUN apt-get update && apt-get install -y \
    iputils-ping \
    dnsutils \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Copy the initialization script and test script
COPY init-mediawiki.sh /usr/local/bin/
COPY test-db-connection.php /usr/local/bin/
RUN chmod +x /usr/local/bin/init-mediawiki.sh

# Set the entrypoint to our init script
ENTRYPOINT ["/usr/local/bin/init-mediawiki.sh"]
