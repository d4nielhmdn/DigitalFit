<?php
/**
 * DigitalFit – Database Connection
 * ================================
 * Include this file on any PHP page that needs access to MySQL.
 * Uses PDO with utf8mb4 and error-exception mode.
 *
 * Adjust the credentials below to match your XAMPP MySQL setup.
 */

define('DB_HOST', '127.0.0.1');
define('DB_PORT', '3306');
define('DB_NAME', 'digitalfit');
define('DB_USER', 'root');
define('DB_PASS', '');                         // default XAMPP root password is empty
define('DB_CHARSET', 'utf8mb4');

$dsn = sprintf(
    'mysql:host=%s;port=%s;dbname=%s;charset=%s',
    DB_HOST,
    DB_PORT,
    DB_NAME,
    DB_CHARSET
);

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
} catch (PDOException $e) {
    // In production, log the error and show a friendly message.
    error_log('DigitalFit DB connection failed: ' . $e->getMessage());
    http_response_code(500);
    die('Database connection failed. Please try again later.');
}
