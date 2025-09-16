<?php
// Test database connection
$host = 'a.selfhosted.hackclub.com';  // Use external hostname
$port = '5432';  // Use external port
$user = getenv('DB_USER') ?: 'wikiuser';
$pass = getenv('DB_PASSWORD') ?: 'wikipass';
$name = getenv('DB_NAME') ?: 'wikidb';

echo "Testing database connection...\n";
echo "Host: $host\n";
echo "Port: $port\n";
echo "User: $user\n";
echo "Database: $name\n";

try {
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$name", $user, $pass);
    echo "✅ Database connection successful!\n";
} catch (PDOException $e) {
    echo "❌ Database connection failed: " . $e->getMessage() . "\n";
}
?>
