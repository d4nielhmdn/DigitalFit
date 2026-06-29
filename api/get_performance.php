<?php
/**
 * DigitalFit – AJAX helper: get performance history for a gym user.
 * Called by the coach dashboard via fetch().
 */
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
requireRole('coach');

header('Content-Type: application/json');

$userId = $_GET['user_id'] ?? '';
if (!$userId) {
    echo json_encode([]);
    exit;
}

$stmt = $pdo->prepare(
    'SELECT record_date, weight_kg, body_fat_pct, notes
     FROM performance_records
     WHERE user_id = ?
     ORDER BY record_date DESC'
);
$stmt->execute([$userId]);
$records = $stmt->fetchAll();

// Format dates for display
foreach ($records as &$r) {
    $r['record_date'] = date('M j, Y', strtotime($r['record_date']));
}
unset($r);

echo json_encode($records);
