<?php
/**
 * POST /api/register.php
 * Body: { username, password, role }
 * Multipart: includes optional "document" file for coach/adviser
 */
require_once __DIR__ . '/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed.'], 405);
}

$username = trim($_POST['username'] ?? '');
$password = $_POST['password'] ?? '';
$role     = trim($_POST['role'] ?? '');

if (!$username || !$password || !$role) {
    jsonResponse(['error' => 'Please fill in all fields.'], 400);
}

if (!preg_match('/^[a-zA-Z0-9_.]{3,20}$/', $username)) {
    jsonResponse(['error' => 'Username must be 3-20 characters (letters, numbers, _ or .).'], 400);
}

if (strlen($password) < 6) {
    jsonResponse(['error' => 'Password must be at least 6 characters.'], 400);
}

if (!in_array($role, ['user', 'coach', 'adviser'])) {
    jsonResponse(['error' => 'Invalid role.'], 400);
}

$db = getDB();

// Check if username exists
$stmt = $db->prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)');
$stmt->execute([$username]);
if ($stmt->fetch()) {
    jsonResponse(['error' => 'That username is already taken.'], 409);
}

$needsDoc = in_array($role, ['coach', 'adviser']);
$docPath  = null;
$docName  = null;

if ($needsDoc) {
    if (empty($_FILES['document']) || $_FILES['document']['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(['error' => 'Please upload a certification or ID image for admin review.'], 400);
    }
    $file = $_FILES['document'];
    if (strpos($file['type'], 'image/') !== 0) {
        jsonResponse(['error' => 'The uploaded file must be an image.'], 400);
    }
    if ($file['size'] > 2 * 1024 * 1024) {
        jsonResponse(['error' => 'Image must be smaller than 2MB.'], 400);
    }
    $uploadDir = __DIR__ . '/uploads';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
    $ext = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'jpg';
    $docName = $file['name'];
    $docPath = 'uploads/' . genId('doc') . '.' . $ext;
    move_uploaded_file($file['tmp_name'], __DIR__ . '/' . $docPath);
}

$id = genId('u');
$approvalStatus = ($role === 'user') ? 'approved' : 'pending';

$stmt = $db->prepare('INSERT INTO users (id, username, password, role, full_name, approval_status, verification_doc_path, verification_file_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())');
$stmt->execute([$id, $username, $password, $role, $username, $approvalStatus, $docPath, $docName]);

// For gym users, create a profile row
if ($role === 'user') {
    $stmt = $db->prepare('INSERT INTO user_profiles (user_id) VALUES (?)');
    $stmt->execute([$id]);
}

if ($needsDoc) {
    jsonResponse(['success' => true, 'message' => 'Account created! Your account must be approved by an admin before you can log in.']);
} else {
    jsonResponse(['success' => true, 'message' => 'Account created! You may now log in.']);
}
