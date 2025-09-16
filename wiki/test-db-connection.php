<?php
// Test database connection
$host = 'a.selfhosted.hackclub.com';  // Always use external hostname
$port = getenv('DB_PORT') ?: '3306';
$user = getenv('DB_USER') ?: 'mysql';
$pass = getenv('DB_PASSWORD');
$name = getenv('DB_NAME') ?: 'default';

echo "Testing database connection...\n";
echo "Host: $host\n";
echo "Port: $port\n";
echo "User: $user\n";
echo "Database: $name\n";

try {
    // First try connecting without specifying a database
    $pdo = new PDO("mysql:host=$host;port=$port", $user, $pass);
    echo "✅ Database connection successful (no database specified)!\n";
    
    // Now try to create the database if it doesn't exist
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$name`");
    echo "✅ Database '$name' created or already exists!\n";
    
    // Now try connecting with the database
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$name", $user, $pass);
    echo "✅ Database connection with database '$name' successful!\n";
    
} catch (PDOException $e) {
    echo "❌ Database connection failed: " . $e->getMessage() . "\n";
}
?>
