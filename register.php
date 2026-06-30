<?php
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/auth.php';

$error   = '';
$success = '';

// Ensure upload directory exists
$uploadDir = __DIR__ . '/uploads';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username     = trim($_POST['regUsername'] ?? '');
    $password     = $_POST['regPassword'] ?? '';
    $confirmPwd   = $_POST['regConfirmPassword'] ?? '';
    $role         = $_POST['regRole'] ?? '';

    // ── Validation (preserved from original script.js) ─────────
    if ($username === '' || $password === '' || $role === '') {
        $error = 'Please fill in all fields.';
    } elseif (!preg_match('/^[a-zA-Z0-9_.]{3,20}$/', $username)) {
        $error = 'Username must be 3-20 characters (letters, numbers, _ or .).';
    } elseif (strlen($password) < 6) {
        $error = 'Password must be at least 6 characters.';
    } elseif ($password !== $confirmPwd) {
        $error = 'Passwords do not match.';
    } else {
        // Check for duplicate username
        $stmt = $pdo->prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)');
        $stmt->execute([$username]);
        if ($stmt->fetch()) {
            $error = 'That username is already taken.';
        } else {
            $needsDoc = in_array($role, ['coach', 'adviser']);
            $docPath  = null;
            $docName  = null;

            // ── File upload for coach / adviser ─────────────────
            if ($needsDoc) {
                $file = $_FILES['regDocument'] ?? null;
                if (!$file || $file['error'] !== UPLOAD_ERR_OK || $file['size'] === 0) {
                    $error = 'Please upload a certification or ID image for admin review.';
                } elseif (!str_starts_with($file['type'], 'image/')) {
                    $error = 'The uploaded file must be an image.';
                } elseif ($file['size'] > 2 * 1024 * 1024) {
                    $error = 'Image must be smaller than 2MB.';
                } else {
                    $ext      = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'jpg';
                    $docName  = $file['name'];
                    $docPath  = 'uploads/' . uniqid('doc_', true) . '.' . $ext;
                    if (!move_uploaded_file($file['tmp_name'], __DIR__ . '/' . $docPath)) {
                        $error = 'Could not save the uploaded file. Please try again.';
                        $docPath = null;
                    }
                }
            }

            if (!$error) {
                // ── Create user ─────────────────────────────────
                $id       = 'u_' . bin2hex(random_bytes(12));
                $fullName = $username;
                $plainPw = $password;

                if ($role === 'user') {
                    // Gym users are auto-approved
                    $stmt = $pdo->prepare(
                        'INSERT INTO users (id, username, password, role, full_name, approval_status, free_session_used)
                         VALUES (?, ?, ?, ?, ?, ?, ?)'
                    );
                    $stmt->execute([$id, $username, $plainPw, $role, $fullName, 'approved', 0]);

                    // Create empty profile row
                    $stmt = $pdo->prepare(
                        'INSERT INTO user_profiles (user_id) VALUES (?)'
                    );
                    $stmt->execute([$id]);

                    // Create empty membership row
                    $stmt = $pdo->prepare(
                        'INSERT INTO user_memberships (user_id, status) VALUES (?, ?)'
                    );
                    $stmt->execute([$id, 'none']);

                    $success = 'Account created! Redirecting to login…';
                } else {
                    // Coach / adviser — pending approval
                    $stmt = $pdo->prepare(
                        'INSERT INTO users (id, username, password, role, full_name, approval_status, verification_doc_path, verification_file_name)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
                    );
                    $stmt->execute([$id, $username, $plainPw, $role, $fullName, 'pending', $docPath, $docName]);
                    $success = 'Account created! Your account must be approved by an admin before you can log in.';
                }
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Register - DigitalFit</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body data-page="register">
    <header>
        <h1>DigitalFit Registration</h1>
        <nav>
            <a href="index.php">Home</a>
            <a href="login.php">Login</a>
        </nav>
    </header>
    <main>
        <div class="login-container auth-card">
            <a class="auth-brand" href="index.php"><span>DIGITALFIT</span></a>
            <h2>Sign Up</h2>
            <p class="auth-subtitle">Transform your fitness journey</p>
            <form id="registerForm" method="post" action="register.php" enctype="multipart/form-data">
                <label for="regUsername">Username:</label>
                <input type="text" placeholder="Username" id="regUsername" name="regUsername" required minlength="3" maxlength="20" autocomplete="username" value="<?php echo htmlspecialchars($username ?? ''); ?>">

                <label for="regPassword">Password:</label>
                <input type="password" placeholder="Password" id="regPassword" name="regPassword" required minlength="6" autocomplete="new-password">

                <label for="regConfirmPassword">Confirm Password:</label>
                <input type="password" placeholder="Confirm Password" id="regConfirmPassword" name="regConfirmPassword" required minlength="6" autocomplete="new-password">

                <label for="regRole">I am a:</label>
                <select id="regRole" name="regRole" required>
                    <option value="">Select Role</option>
                    <option value="user"    <?php echo ($role ?? '') === 'user'    ? 'selected' : ''; ?>>Gym User</option>
                    <option value="coach"   <?php echo ($role ?? '') === 'coach'   ? 'selected' : ''; ?>>Fitness Coach</option>
                    <option value="adviser" <?php echo ($role ?? '') === 'adviser' ? 'selected' : ''; ?>>Health Adviser</option>
                </select>

                <div id="regDocumentGroup" class="<?php echo in_array($role ?? '', ['coach', 'adviser']) ? '' : 'hidden'; ?>">
                    <label for="regDocument">Certification / ID document (image):</label>
                    <input type="file" id="regDocument" name="regDocument" accept="image/*">
                    <p class="hint">Coaches and health advisers must upload an image (e.g. certificate or ID) for an admin to review. You won't be able to log in until your account is approved.</p>
                </div>

                <?php if ($error): ?>
                    <div class="status-message error" style="display:block;"><?php echo htmlspecialchars($error); ?></div>
                <?php endif; ?>
                <?php if ($success): ?>
                    <div class="status-message success" style="display:block;"><?php echo htmlspecialchars($success); ?></div>
                    <script>setTimeout(function(){ window.location.href = 'login.php'; }, 1600);</script>
                <?php else: ?>
                    <div id="registerMessage" class="status-message" style="display:none;"></div>
                <?php endif; ?>

                <button type="submit">Sign Up</button>
            </form>
            <p class="auth-switch">Already have an account? <a href="login.php">Log In</a></p>
        </div>
    </main>
    <footer>
        <p>&copy; 2026 DigitalFit. All rights reserved.</p>
    </footer>
    <script src="script.js"></script>
</body>
</html>
