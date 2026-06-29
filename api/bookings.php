<?php
/**
 * /api/bookings.php
 * GET  ?type=my|provider  – list my bookings or bookings for a provider
 * POST body JSON          – create a booking
 * PUT  body JSON          – cancel a booking (set status=cancelled)
 */
require_once __DIR__ . '/auth.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $current = requireAuth();
    $type = $_GET['type'] ?? 'my';
    $db = getDB();

    if ($type === 'my') {
        // Bookings I made (as a gym user)
        $stmt = $db->prepare('SELECT b.*, u.full_name as provider_name FROM bookings b JOIN users u ON b.provider_id = u.id WHERE b.user_id = ? ORDER BY b.booking_date DESC, b.booking_time DESC');
        $stmt->execute([$current['id']]);
        jsonResponse(['bookings' => $stmt->fetchAll()]);
    } elseif ($type === 'provider') {
        // Bookings where I am the provider (coach/adviser)
        $stmt = $db->prepare('SELECT b.*, u.full_name as user_name FROM bookings b JOIN users u ON b.user_id = u.id WHERE b.provider_id = ? ORDER BY b.booking_date DESC, b.booking_time DESC');
        $stmt->execute([$current['id']]);
        jsonResponse(['bookings' => $stmt->fetchAll()]);
    } else {
        jsonResponse(['error' => 'Invalid type.'], 400);
    }
}

if ($method === 'POST') {
    $current = requireAuth();
    $input = jsonInput();

    $providerUsername = $input['providerUsername'] ?? '';
    $date = $input['date'] ?? '';
    $time = $input['time'] ?? '';

    if (!$providerUsername || !$date || !$time) {
        jsonResponse(['error' => 'Please complete all booking fields.'], 400);
    }

    $db = getDB();

    // Check provider exists and is approved
    $stmt = $db->prepare("SELECT id, role FROM users WHERE username = ? AND role IN ('coach','adviser') AND approval_status = 'approved'");
    $stmt->execute([$providerUsername]);
    $provider = $stmt->fetch();
    if (!$provider) jsonResponse(['error' => 'Selected provider not available.'], 400);

    $providerRole = $provider['role'];

    // Check for time clash (60-min sessions)
    $stmt = $db->prepare("SELECT id FROM bookings WHERE provider_id = ? AND booking_date = ? AND status != 'cancelled' AND ABS(TIME_TO_SEC(TIMEDIFF(booking_time, ?))) < 3600");
    $stmt->execute([$provider['id'], $date, $time]);
    if ($stmt->fetch()) {
        $label = $providerRole === 'coach' ? 'coach' : 'health adviser';
        jsonResponse(['error' => "That time slot is already booked for the selected {$label}. Please choose another time."], 409);
    }

    // Check eligibility
    $stmt = $db->prepare('SELECT free_session_used FROM users WHERE id = ?');
    $stmt->execute([$current['id']]);
    $me = $stmt->fetch();

    // Check membership
    $stmt = $db->prepare("SELECT id FROM member_subscriptions WHERE user_id = ? AND status = 'active'");
    $stmt->execute([$current['id']]);
    $hasMembership = (bool) $stmt->fetch();

    if (!$hasMembership && $me['free_session_used']) {
        jsonResponse(['error' => "You've used your free session. Subscribe to Membership for unlimited bookings."], 403);
    }

    $id = genId('bk');
    $db->prepare('INSERT INTO bookings (id, user_id, provider_id, booking_date, booking_time, status, created_at) VALUES (?,?,?,?,?,?,NOW())')
       ->execute([$id, $current['id'], $provider['id'], $date, $time, 'confirmed']);

    // Mark free session used if not a member
    if (!$hasMembership && !$me['free_session_used']) {
        $db->prepare('UPDATE users SET free_session_used = 1 WHERE id = ?')->execute([$current['id']]);
    }

    jsonResponse(['success' => true, 'bookingId' => $id]);
}

if ($method === 'PUT') {
    $current = requireAuth();
    $input = jsonInput();
    $bookingId = $input['id'] ?? '';
    if (!$bookingId) jsonResponse(['error' => 'Booking ID required.'], 400);

    $db = getDB();
    $db->prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ? AND user_id = ?")
       ->execute([$bookingId, $current['id']]);
    jsonResponse(['success' => true]);
}

jsonResponse(['error' => 'Method not allowed.'], 405);
