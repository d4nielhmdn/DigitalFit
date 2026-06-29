<?php
/**
 * /api/performance.php
 * GET  ?username=   – get performance records for a user
 * POST body JSON    – add a performance record (coach only)
 */
require_once __DIR__ . '/auth.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    requireAuth();
    $username = $_GET['username'] ?? '';
    if (!$username) jsonResponse(['error' => 'Username required.'], 400);

    $db = getDB();
    $stmt = $db->prepare('SELECT u.id FROM users u WHERE u.username = ?');
    $stmt->execute([$username]);
    $user = $stmt->fetch();
    if (!$user) jsonResponse(['error' => 'User not found.'], 404);

    $stmt = $db->prepare('SELECT * FROM performance_records WHERE user_id = ? ORDER BY record_date DESC');
    $stmt->execute([$user['id']]);
    jsonResponse(['records' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $coach = requireRole('coach');
    $input = jsonInput();
    $targetUsername = $input['username'] ?? '';
    if (!$targetUsername) jsonResponse(['error' => 'Target username required.'], 400);

    $db = getDB();
    $stmt = $db->prepare('SELECT id FROM users WHERE username = ? AND role = ?');
    $stmt->execute([$targetUsername, 'user']);
    $target = $stmt->fetch();
    if (!$target) jsonResponse(['error' => 'Gym user not found.'], 404);

    $date    = $input['date'] ?? date('Y-m-d');
    $weight  = $input['weight'] ?? null;
    $bodyFat = $input['bodyFat'] ?? null;
    $notes   = $input['notes'] ?? '';

    if (!$weight) jsonResponse(['error' => 'Weight is required.'], 400);

    $db->prepare('INSERT INTO performance_records (id, user_id, coach_id, record_date, weight_kg, body_fat_pct, notes, created_at) VALUES (?,?,?,?,?,?,?,NOW())')
       ->execute([genId('pr'), $target['id'], $coach['id'], $date, $weight, $bodyFat, $notes]);
    jsonResponse(['success' => true]);
}

jsonResponse(['error' => 'Method not allowed.'], 405);
