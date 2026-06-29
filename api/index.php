<?php
/**
 * Simple router – proxies API calls to the correct handler.
 * All requests to /api/ are rewritten here by .htaccess
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri = rtrim($uri, '/');
$base = '/DigitalFit-main/api';

// Map routes to files
$routes = [
    $base . '/login'       => 'login.php',
    $base . '/register'    => 'register.php',
    $base . '/logout'      => 'logout.php',
    $base . '/session'     => 'session.php',
    $base . '/users'       => 'users.php',
    $base . '/workouts'    => 'workouts.php',
    $base . '/reports'     => 'reports.php',
    $base . '/diets'       => 'diets.php',
    $base . '/performance' => 'performance.php',
    $base . '/bookings'    => 'bookings.php',
    $base . '/plans'       => 'plans.php',
    $base . '/payments'    => 'payments.php',
    $base . '/seed'        => 'seed.php',
];

if (isset($routes[$uri])) {
    require __DIR__ . '/' . $routes[$uri];
} else {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Not found: ' . $uri]);
}
