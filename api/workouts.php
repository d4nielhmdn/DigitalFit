<?php
/**
 * /api/workouts.php
 * GET  ?username=   – get workout plan for a user
 * POST body JSON    – create/update workout plan (coach only)
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

    $stmt = $db->prepare('SELECT * FROM workout_plans WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1');
    $stmt->execute([$user['id']]);
    $plan = $stmt->fetch();

    if ($plan) {
        $plan['days'] = json_decode($plan['days_json'], true) ?: [];
        unset($plan['days_json']);
    }
    jsonResponse(['plan' => $plan]);
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

    $title = $input['title'] ?? 'My Workout Plan';
    $days = $input['days'] ?? [];
    $daysJson = json_encode($days, JSON_UNESCAPED_UNICODE);

    // Upsert: check if plan exists
    $stmt = $db->prepare('SELECT id FROM workout_plans WHERE user_id = ?');
    $stmt->execute([$target['id']]);
    $existing = $stmt->fetch();

    if ($existing) {
        $db->prepare('UPDATE workout_plans SET title=?, coach_id=?, days_json=?, updated_at=NOW() WHERE user_id=?')
           ->execute([$title, $coach['id'], $daysJson, $target['id']]);
    } else {
        $db->prepare('INSERT INTO workout_plans (id, user_id, coach_id, title, days_json, created_at, updated_at) VALUES (?,?,?,?,?,NOW(),NOW())')
           ->execute([genId('wp'), $target['id'], $coach['id'], $title, $daysJson]);
    }
    jsonResponse(['success' => true]);
}

jsonResponse(['error' => 'Method not allowed.'], 405);
