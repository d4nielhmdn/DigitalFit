<?php
/**
 * /api/diets.php
 * GET  ?username=   – get diet plan for a user
 * POST body JSON    – create/update diet plan (adviser only)
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

    $stmt = $db->prepare('SELECT dp.*, u.full_name as adviser_name FROM diet_plans dp JOIN users u ON dp.adviser_id = u.id WHERE dp.user_id = ? ORDER BY dp.updated_at DESC LIMIT 1');
    $stmt->execute([$user['id']]);
    jsonResponse(['diet' => $stmt->fetch() ?: null]);
}

if ($method === 'POST') {
    $adviser = requireRole('adviser');
    $input = jsonInput();
    $targetUsername = $input['username'] ?? '';
    if (!$targetUsername) jsonResponse(['error' => 'Target username required.'], 400);

    $db = getDB();
    $stmt = $db->prepare('SELECT id FROM users WHERE username = ? AND role = ?');
    $stmt->execute([$targetUsername, 'user']);
    $target = $stmt->fetch();
    if (!$target) jsonResponse(['error' => 'Gym user not found.'], 404);

    $breakfast = $input['breakfast'] ?? '';
    $lunch     = $input['lunch'] ?? '';
    $dinner    = $input['dinner'] ?? '';
    $snacks    = $input['snacks'] ?? '';
    $notes     = $input['notes'] ?? '';

    $stmt = $db->prepare('SELECT id FROM diet_plans WHERE user_id = ?');
    $stmt->execute([$target['id']]);
    $existing = $stmt->fetch();

    if ($existing) {
        $db->prepare('UPDATE diet_plans SET adviser_id=?, breakfast=?, lunch=?, dinner=?, snacks=?, notes=?, updated_at=NOW() WHERE user_id=?')
           ->execute([$adviser['id'], $breakfast, $lunch, $dinner, $snacks, $notes, $target['id']]);
    } else {
        $db->prepare('INSERT INTO diet_plans (id, user_id, adviser_id, breakfast, lunch, dinner, snacks, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,NOW(),NOW())')
           ->execute([genId('dp'), $target['id'], $adviser['id'], $breakfast, $lunch, $dinner, $snacks, $notes]);
    }
    jsonResponse(['success' => true]);
}

jsonResponse(['error' => 'Method not allowed.'], 405);
