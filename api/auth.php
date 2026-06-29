<?php
/**
 * DigitalFit – Auth Helpers
 * Session management and role-checking utilities
 */
require_once __DIR__ . '/config.php';

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * Return the currently logged-in user or null.
 */
function getAuthUser(): ?array {
    if (empty($_SESSION['user_id'])) return null;
    $db = getDB();
    $stmt = $db->prepare('SELECT id, username, role, full_name, approval_status, free_session_used, created_at FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    return $stmt->fetch() ?: null;
}

/**
 * Require a logged-in user. Sends 401 JSON and exits if not authenticated.
 */
function requireAuth(): array {
    $user = getAuthUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Not authenticated.']);
        exit;
    }
    return $user;
}

/**
 * Require a specific role. Sends 403 JSON and exits if the role doesn't match.
 */
function requireRole(string $role): array {
    $user = requireAuth();
    if ($user['role'] !== $role) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden: requires ' . $role . ' role.']);
        exit;
    }
    return $user;
}

/**
 * Set the current session for a user.
 */
function loginUser(array $user): void {
    session_regenerate_id(true);
    $_SESSION['user_id'] = $user['id'];
}

/**
 * Destroy the current session.
 */
function logoutUser(): void {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}

/**
 * Send JSON response and exit.
 */
function jsonResponse(mixed $data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Read JSON request body.
 */
function jsonInput(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?: [];
}

/**
 * Generate a unique ID (compatible with the frontend uid format).
 */
function genId(string $prefix = 'id'): string {
    return $prefix . '_' . base_convert((string) (time() * 1000 + random_int(0, 999)), 10, 36) . bin2hex(random_bytes(4));
}
