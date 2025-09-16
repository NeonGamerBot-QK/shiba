<?php
// Test database connection
$host = getenv('DB_HOST') ?: 'a.selfhosted.hackclub.com';
$port = getenv('DB_PORT') ?: '5432';
$user = getenv('DB_USER') ?: 'mysql';
$pass = getenv('DB_PASSWORD') ?: 'CHANGE_ME';
$name = getenv('DB_NAME') ?: 'default';

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
