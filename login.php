<?php
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/auth.php';
redirectIfLoggedIn();

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';
    $role     = $_POST['role'] ?? '';

    if ($username === '' || $password === '' || $role === '') {
        $error = 'Please fill in all fields.';
    } else {
        // Find user by username AND role (exact match, case-insensitive)
        $stmt = $pdo->prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND role = ?');
        $stmt->execute([$username, $role]);
        $user = $stmt->fetch();

        if (!$user || $password !== $user['password']) {
            $error = 'Invalid username, password or role.';
        } elseif (in_array($user['role'], ['coach', 'adviser']) && $user['approval_status'] !== 'approved') {
            // ── Preserved: coach / adviser must be admin-approved ──
            $error = $user['approval_status'] === 'rejected'
                ? 'Your application was not approved. Please contact an administrator.'
                : 'Your account is awaiting admin approval. Please check back later.';
        } else {
            // ── Preserved: set session, redirect to role dashboard ──
            loginUser($user);
            header('Location: ' . ROLE_DASHBOARD[$user['role']]);
            exit;
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - DigitalFit</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body data-page="login">
    <header>
        <h1>DigitalFit Login</h1>
        <nav>
            <a href="index.php">Home</a>
        </nav>
    </header>
    <main>
        <div class="login-container">
            <h2>Login</h2>
            <form id="loginForm" method="post" action="login.php">
                <label for="username">Username:</label>
                <input type="text" id="username" name="username" required minlength="3" maxlength="20" autocomplete="username" value="<?php echo htmlspecialchars($username ?? ''); ?>">

                <label for="password">Password:</label>
                <input type="password" id="password" name="password" required minlength="6" autocomplete="current-password">

                <label for="role">Role:</label>
                <select id="role" name="role" required>
                    <option value="">Select Role</option>
                    <option value="user"    <?php echo ($role ?? '') === 'user'    ? 'selected' : ''; ?>>Gym User</option>
                    <option value="coach"   <?php echo ($role ?? '') === 'coach'   ? 'selected' : ''; ?>>Fitness Coach</option>
                    <option value="adviser" <?php echo ($role ?? '') === 'adviser' ? 'selected' : ''; ?>>Health Adviser</option>
                    <option value="admin"   <?php echo ($role ?? '') === 'admin'   ? 'selected' : ''; ?>>Admin</option>
                </select>

                <?php if ($error): ?>
                    <div class="status-message error" style="display:block;"><?php echo htmlspecialchars($error); ?></div>
                <?php else: ?>
                    <div id="loginMessage" class="status-message" style="display:none;"></div>
                <?php endif; ?>

                <button type="submit">Login</button>
            </form>
            <p>New user? <a href="register.php">Register here</a></p>
        </div>
    </main>
    <footer>
        <p>&copy; 2026 DigitalFit. All rights reserved.</p>
    </footer>
    <script src="script.js"></script>
</body>
</html>
