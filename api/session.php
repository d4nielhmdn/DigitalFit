<?php
/**
 * GET /api/session.php – Return current session info
 */
require_once __DIR__ . '/auth.php';

$user = getAuthUser();
if (!$user) {
    jsonResponse(['user' => null]);
}

jsonResponse([
    'user' => [
        'id'       => $user['id'],
        'username' => $user['username'],
        'role'     => $user['role'],
        'fullName' => $user['full_name'] ?: $user['username'],
    ],
]);
