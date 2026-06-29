<?php
/**
 * POST /api/login.php
 * Body: { username, password, role }
 */
require_once __DIR__ . '/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed.'], 405);
}

$input = jsonInput();
$username = trim($input['username'] ?? '');
$password = $input['password'] ?? '';
$role     = trim($input['role'] ?? '');

if (!$username || !$password || !$role) {
    jsonResponse(['error' => 'Username, password, and role are required.'], 400);
}

$db = getDB();
$stmt = $db->prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)');
$stmt->execute([$username]);
$user = $stmt->fetch();

if (!$user || $user['password'] !== $password) {
    jsonResponse(['error' => 'Invalid username, password or role.'], 401);
}

if ($user['role'] !== $role) {
    jsonResponse(['error' => 'Invalid username, password or role.'], 401);
}

// Check approval for coach/adviser
if (in_array($user['role'], ['coach', 'adviser']) && $user['approval_status'] !== 'approved') {
    $notice = $user['approval_status'] === 'rejected'
        ? 'Your application was not approved. Please contact an administrator.'
        : 'Your account is awaiting admin approval. Please check back later.';
    jsonResponse(['error' => $notice], 403);
}

loginUser($user);

jsonResponse([
    'success'  => true,
    'user'     => [
        'id'       => $user['id'],
        'username' => $user['username'],
        'role'     => $user['role'],
        'fullName' => $user['full_name'] ?: $user['username'],
    ],
    'redirect' => dashboardUrl($user['role']),
]);

function dashboardUrl(string $role): string {
    $map = [
        'user'    => 'dashboard-user.html',
        'coach'   => 'dashboard-coach.html',
        'adviser' => 'dashboard-adviser.html',
        'admin'   => 'dashboard-admin.html',
    ];
    return $map[$role] ?? 'index.html';
}
