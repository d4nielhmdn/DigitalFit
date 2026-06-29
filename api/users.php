<?php
/**
 * /api/users.php
 * GET    ?action=list[&role=]   – list users (admin only for full list)
 * GET    ?action=get&username=  – get single user
 * PUT    body JSON              – update user profile or admin actions
 * DELETE ?action=delete&username= – delete user (admin only)
 */
require_once __DIR__ . '/auth.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'GET' && $action === 'list') {
    $current = requireAuth();
    $role = $_GET['role'] ?? '';
    $db = getDB();

    if ($current['role'] === 'admin') {
        if ($role && in_array($role, ['user', 'coach', 'adviser', 'admin'])) {
            $stmt = $db->prepare('SELECT id, username, role, full_name, approval_status, verification_doc_path, verification_file_name, free_session_used, created_at FROM users WHERE role = ? ORDER BY created_at DESC');
            $stmt->execute([$role]);
        } else {
            $stmt = $db->query('SELECT id, username, role, full_name, approval_status, verification_doc_path, verification_file_name, free_session_used, created_at FROM users ORDER BY created_at DESC');
        }
        $users = $stmt->fetchAll();

        // Attach profiles and memberships for gym users
        foreach ($users as &$u) {
            if ($u['role'] === 'user') {
                $pStmt = $db->prepare('SELECT age, gender, weight_kg, height_cm, fitness_goal FROM user_profiles WHERE user_id = ?');
                $pStmt->execute([$u['id']]);
                $u['profile'] = $pStmt->fetch() ?: null;

                $mStmt = $db->prepare('SELECT mp.name as plan_name, ms.status, ms.start_date FROM member_subscriptions ms LEFT JOIN membership_plans mp ON ms.plan_id = mp.id WHERE ms.user_id = ? AND ms.status = ?');
                $mStmt->execute([$u['id'], 'active']);
                $u['membership'] = $mStmt->fetch() ?: null;
            }
        }
        jsonResponse(['users' => $users]);
    } else {
        // Non-admin: can only list coaches and advisers for booking
        $allowedRoles = ['coach', 'adviser'];
        $roleFilter = $role && in_array($role, $allowedRoles) ? $role : null;
        if ($roleFilter) {
            $stmt = $db->prepare("SELECT id, username, role, full_name FROM users WHERE role = ? AND approval_status = 'approved' ORDER BY full_name");
            $stmt->execute([$roleFilter]);
        } else {
            $stmt = $db->query("SELECT id, username, role, full_name FROM users WHERE role IN ('coach','adviser') AND approval_status = 'approved' ORDER BY full_name");
        }
        jsonResponse(['users' => $stmt->fetchAll()]);
    }
    exit;
}

if ($method === 'GET' && $action === 'get') {
    requireAuth();
    $username = $_GET['username'] ?? '';
    if (!$username) jsonResponse(['error' => 'Username required.'], 400);

    $db = getDB();
    $stmt = $db->prepare('SELECT id, username, role, full_name, approval_status, free_session_used, created_at FROM users WHERE username = ?');
    $stmt->execute([$username]);
    $user = $stmt->fetch();
    if (!$user) jsonResponse(['error' => 'User not found.'], 404);

    if ($user['role'] === 'user') {
        $pStmt = $db->prepare('SELECT age, gender, weight_kg, height_cm, fitness_goal FROM user_profiles WHERE user_id = ?');
        $pStmt->execute([$user['id']]);
        $user['profile'] = $pStmt->fetch() ?: null;

        $mStmt = $db->prepare('SELECT mp.name as plan_name, ms.status, ms.start_date, ms.plan_id FROM member_subscriptions ms LEFT JOIN membership_plans mp ON ms.plan_id = mp.id WHERE ms.user_id = ? AND ms.status = ?');
        $mStmt->execute([$user['id'], 'active']);
        $user['membership'] = $mStmt->fetch() ?: null;
    }
    jsonResponse(['user' => $user]);
    exit;
}

if ($method === 'PUT') {
    $current = requireAuth();
    $input = jsonInput();
    $db = getDB();

    // Admin updating any user
    if ($current['role'] === 'admin' && !empty($input['targetUsername'])) {
        $targetUsername = $input['targetUsername'];
        $stmt = $db->prepare('SELECT * FROM users WHERE username = ?');
        $stmt->execute([$targetUsername]);
        $target = $stmt->fetch();
        if (!$target) jsonResponse(['error' => 'User not found.'], 404);

        // Admin actions: change role, approval status, reset password, delete
        if (isset($input['role'])) {
            $db->prepare('UPDATE users SET role = ?, approval_status = ? WHERE id = ?')
               ->execute([$input['role'], 'approved', $target['id']]);
            jsonResponse(['success' => true]);
        }
        if (isset($input['approvalStatus'])) {
            $db->prepare('UPDATE users SET approval_status = ? WHERE id = ?')
               ->execute([$input['approvalStatus'], $target['id']]);
            jsonResponse(['success' => true]);
        }
        if (isset($input['password'])) {
            $db->prepare('UPDATE users SET password = ? WHERE id = ?')->execute([$input['password'], $target['id']]);
            jsonResponse(['success' => true]);
        }
        jsonResponse(['error' => 'No valid action.'], 400);
    }

    // User updating their own profile
    $targetUsername = $current['username'];
    $stmt = $db->prepare('SELECT id, role FROM users WHERE username = ?');
    $stmt->execute([$targetUsername]);
    $target = $stmt->fetch();

    if ($target['role'] === 'user') {
        // Update profile
        if (isset($input['profile'])) {
            $p = $input['profile'];
            $db->prepare('UPDATE user_profiles SET age=?, gender=?, weight_kg=?, height_cm=?, fitness_goal=? WHERE user_id=?')
               ->execute([
                   $p['age'] ?? null, $p['gender'] ?? null,
                   $p['weight'] ?? null, $p['height'] ?? null,
                   $p['goal'] ?? null, $target['id']
               ]);
        }
        // Update free_session_used
        if (isset($input['freeSessionUsed'])) {
            $db->prepare('UPDATE users SET free_session_used = ? WHERE id = ?')
               ->execute([$input['freeSessionUsed'] ? 1 : 0, $target['id']]);
        }
        jsonResponse(['success' => true]);
    }
    jsonResponse(['error' => 'No action taken.'], 400);
}

if ($method === 'DELETE' && $action === 'delete') {
    $current = requireRole('admin');
    $username = $_GET['username'] ?? '';
    if (!$username) jsonResponse(['error' => 'Username required.'], 400);
    if ($username === $current['username']) jsonResponse(['error' => 'Cannot delete your own account.'], 400);

    $db = getDB();
    $stmt = $db->prepare('SELECT id FROM users WHERE username = ?');
    $stmt->execute([$username]);
    $user = $stmt->fetch();
    if (!$user) jsonResponse(['error' => 'User not found.'], 404);

    $db->prepare('DELETE FROM users WHERE id = ?')->execute([$user['id']]);
    jsonResponse(['success' => true]);
}

jsonResponse(['error' => 'Invalid request.'], 400);
