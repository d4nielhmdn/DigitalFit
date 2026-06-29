<?php
/**
 * /api/payments.php
 * GET – list payments (admin: all, user: own)
 */
require_once __DIR__ . '/auth.php';

$current = requireAuth();
$db = getDB();

if ($current['role'] === 'admin') {
    $stmt = $db->query('SELECT p.*, u.username, u.full_name FROM payments p JOIN users u ON p.user_id = u.id ORDER BY p.payment_date DESC');
} else {
    $stmt = $db->prepare('SELECT * FROM payments WHERE user_id = ? ORDER BY payment_date DESC');
    $stmt->execute([$current['id']]);
}

jsonResponse(['payments' => $stmt->fetchAll()]);
