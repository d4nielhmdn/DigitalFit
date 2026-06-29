<?php
/**
 * /api/reports.php
 * GET  ?username=   – get health report for a user
 * POST body JSON    – create/update health report (adviser only)
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

    $stmt = $db->prepare('SELECT hr.*, u.full_name as adviser_name FROM health_reports hr JOIN users u ON hr.adviser_id = u.id WHERE hr.user_id = ? ORDER BY hr.created_at DESC LIMIT 1');
    $stmt->execute([$user['id']]);
    jsonResponse(['report' => $stmt->fetch() ?: null]);
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

    $bmi = $input['bmi'] ?? '';
    $bp  = $input['bloodPressure'] ?? '';
    $summary = $input['summary'] ?? '';
    $recommendations = $input['recommendations'] ?? '';

    $stmt = $db->prepare('SELECT id FROM health_reports WHERE user_id = ?');
    $stmt->execute([$target['id']]);
    $existing = $stmt->fetch();

    if ($existing) {
        $db->prepare('UPDATE health_reports SET adviser_id=?, bmi=?, blood_pressure=?, summary=?, recommendations=?, created_at=NOW() WHERE user_id=?')
           ->execute([$adviser['id'], $bmi, $bp, $summary, $recommendations, $target['id']]);
    } else {
        $db->prepare('INSERT INTO health_reports (id, user_id, adviser_id, bmi, blood_pressure, summary, recommendations, created_at) VALUES (?,?,?,?,?,?,?,NOW())')
           ->execute([genId('hr'), $target['id'], $adviser['id'], $bmi, $bp, $summary, $recommendations]);
    }
    jsonResponse(['success' => true]);
}

jsonResponse(['error' => 'Method not allowed.'], 405);
