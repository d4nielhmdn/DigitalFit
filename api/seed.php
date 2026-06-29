<?php
/**
 * /api/seed.php
 * POST – Seed the database with initial demo data
 * Creates admin, coaches, adviser, and membership plan.
 */
require_once __DIR__ . '/auth.php';

// Only allow if DB is empty
$db = getDB();
$stmt = $db->query('SELECT COUNT(*) as cnt FROM users');
$row = $stmt->fetch();
if ($row['cnt'] > 0) {
    jsonResponse(['message' => 'Database already has users. Seed skipped.']);
}

$db->beginTransaction();
try {
    // Create admin
    $adminId = genId('u');
    $db->prepare('INSERT INTO users (id, username, password, role, full_name, approval_status, created_at) VALUES (?,?,?,?,?,?,NOW())')
       ->execute([$adminId, 'admin', 'admin123', 'admin', 'System Admin', 'approved']);

    // Create coaches
    $coach1Id = genId('u');
    $db->prepare('INSERT INTO users (id, username, password, role, full_name, approval_status, created_at) VALUES (?,?,?,?,?,?,NOW())')
       ->execute([$coach1Id, 'coachjohn', 'coach123', 'coach', 'John Doe', 'approved']);
    $coach2Id = genId('u');
    $db->prepare('INSERT INTO users (id, username, password, role, full_name, approval_status, created_at) VALUES (?,?,?,?,?,?,NOW())')
       ->execute([$coach2Id, 'coachjane', 'coach123', 'coach', 'Jane Smith', 'approved']);

    // Create adviser
    $adviserId = genId('u');
    $db->prepare('INSERT INTO users (id, username, password, role, full_name, approval_status, created_at) VALUES (?,?,?,?,?,?,NOW())')
       ->execute([$adviserId, 'advisormary', 'advise123', 'adviser', 'Mary Lee', 'approved']);

    // Create membership plan
    $planId = genId('plan');
    $features = ['Unlimited coach & health adviser sessions', 'Personalised workout plans', 'Health reports & diet plans'];
    $db->prepare('INSERT INTO membership_plans (id, name, price, period, features_json) VALUES (?,?,?,?,?)')
       ->execute([$planId, 'Membership', 15.00, 'month', json_encode($features)]);

    $db->commit();
    jsonResponse(['success' => true, 'message' => 'Demo data seeded.']);
} catch (Exception $e) {
    $db->rollBack();
    jsonResponse(['error' => 'Seed failed: ' . $e->getMessage()], 500);
}
