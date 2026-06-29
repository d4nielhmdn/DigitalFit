<?php
/**
 * DigitalFit – Authentication & Session Helpers
 * ==============================================
 * Include this after db.php on any page that needs
 * login state, role checks, or user data.
 *
 * Start the session first, then call requireLogin('user')
 * (or 'coach', 'adviser', 'admin') to boot unauthenticated
 * visitors back to login.php.
 */

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// ── Role → dashboard mapping ──────────────────────────────────
define('ROLE_DASHBOARD', [
    'user'    => 'dashboard-user.php',
    'coach'   => 'dashboard-coach.php',
    'adviser' => 'dashboard-adviser.php',
    'admin'   => 'dashboard-admin.php',
]);

define('ROLE_LABEL', [
    'user'    => 'Gym User',
    'coach'   => 'Fitness Coach',
    'adviser' => 'Health Adviser',
    'admin'   => 'Admin',
]);

// ── Redirect if already logged in ─────────────────────────────
function redirectIfLoggedIn(): void
{
    if (!empty($_SESSION['user'])) {
        $role = $_SESSION['user']['role'];
        if (isset(ROLE_DASHBOARD[$role])) {
            header('Location: ' . ROLE_DASHBOARD[$role]);
            exit;
        }
    }
}

// ── Require a specific role (or send to login) ────────────────
function requireRole(string $role): array
{
    if (empty($_SESSION['user']) || $_SESSION['user']['role'] !== $role) {
        header('Location: login.php');
        exit;
    }
    return $_SESSION['user'];
}

// ── Quick check: is the current session logged in? ────────────
function isLoggedIn(): bool
{
    return !empty($_SESSION['user']);
}

// ── Get fresh user record from the database ───────────────────
function getFreshUser(PDO $pdo, string $userId): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    return $user ?: null;
}

// ── Log in a user (set session) ───────────────────────────────
function loginUser(array $user): void
{
    $_SESSION['user'] = [
        'id'       => $user['id'],
        'username' => $user['username'],
        'role'     => $user['role'],
        'fullName' => $user['full_name'] ?? $user['username'],
    ];
}

// ── Log out ───────────────────────────────────────────────────
function logoutUser(): void
{
    unset($_SESSION['user']);
    session_destroy();
    header('Location: login.php');
    exit;
}
