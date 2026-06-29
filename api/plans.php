<?php
/**
 * /api/plans.php
 * GET                          – get membership plans
 * PUT  body JSON               – update plan (admin only)
 * POST body JSON (subscribe)   – subscribe to membership
 * POST body JSON (cancel)      – cancel subscription
 */
require_once __DIR__ . '/auth.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    requireAuth();
    $db = getDB();
    $stmt = $db->query('SELECT * FROM membership_plans ORDER BY price ASC');
    $plans = $stmt->fetchAll();
    foreach ($plans as &$p) {
        $p['features'] = json_decode($p['features_json'], true) ?: [];
        unset($p['features_json']);
    }
    jsonResponse(['plans' => $plans]);
}

if ($method === 'PUT') {
    requireRole('admin');
    $input = jsonInput();

    $db = getDB();
    $stmt = $db->query('SELECT id FROM membership_plans LIMIT 1');
    $plan = $stmt->fetch();

    $name     = $input['name'] ?? 'Membership';
    $price    = floatval($input['price'] ?? 15);
    $period   = $input['period'] ?? 'month';
    $features = $input['features'] ?? [];
    $featuresJson = json_encode($features, JSON_UNESCAPED_UNICODE);

    if ($plan) {
        $db->prepare('UPDATE membership_plans SET name=?, price=?, period=?, features_json=? WHERE id=?')
           ->execute([$name, $price, $period, $featuresJson, $plan['id']]);
    } else {
        $db->prepare('INSERT INTO membership_plans (id, name, price, period, features_json) VALUES (?,?,?,?,?)')
           ->execute([genId('plan'), $name, $price, $period, $featuresJson]);
    }
    jsonResponse(['success' => true]);
}

if ($method === 'POST') {
    $current = requireAuth();
    $input = jsonInput();
    $action = $input['action'] ?? '';

    $db = getDB();

    if ($action === 'subscribe') {
        // User subscribing to membership
        $stmt = $db->query('SELECT id, name FROM membership_plans LIMIT 1');
        $plan = $stmt->fetch();
        if (!$plan) jsonResponse(['error' => 'No membership plan available.'], 400);

        // Check if already active
        $stmt = $db->prepare("SELECT id FROM member_subscriptions WHERE user_id = ? AND status = 'active'");
        $stmt->execute([$current['id']]);
        if ($stmt->fetch()) jsonResponse(['error' => 'Already subscribed.'], 400);

        // Cancel any previous subscription
        $db->prepare("UPDATE member_subscriptions SET status = 'cancelled' WHERE user_id = ?")->execute([$current['id']]);

        $db->prepare('INSERT INTO member_subscriptions (id, user_id, plan_id, status, start_date) VALUES (?,?,?,?,CURDATE())')
           ->execute([genId('sub'), $current['id'], $plan['id'], 'active']);

        // Record payment
        $db->prepare('INSERT INTO payments (id, user_id, amount, description, payment_date) VALUES (?,?,?,?,NOW())')
           ->execute([genId('pay'), $current['id'], $plan['price'], 'Subscribe to ' . $plan['name']]);

        jsonResponse(['success' => true]);
    }

    if ($action === 'cancel') {
        $db->prepare("UPDATE member_subscriptions SET status = 'cancelled' WHERE user_id = ? AND status = 'active'")
           ->execute([$current['id']]);
        jsonResponse(['success' => true]);
    }

    if ($action === 'revoke') {
        requireRole('admin');
        $username = $input['username'] ?? '';
        if (!$username) jsonResponse(['error' => 'Username required.'], 400);
        $stmt = $db->prepare('SELECT id FROM users WHERE username = ?');
        $stmt->execute([$username]);
        $user = $stmt->fetch();
        if (!$user) jsonResponse(['error' => 'User not found.'], 404);

        $db->prepare("UPDATE member_subscriptions SET status = 'cancelled' WHERE user_id = ? AND status = 'active'")
           ->execute([$user['id']]);
        jsonResponse(['success' => true]);
    }

    jsonResponse(['error' => 'Invalid action.'], 400);
}

jsonResponse(['error' => 'Method not allowed.'], 405);
