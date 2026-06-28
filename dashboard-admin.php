<?php
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/auth.php';
$session = requireRole('admin');

$message = '';
$msgType = '';

// ── Handle POST ────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    // ── Approve / reject coach or adviser ──────────────────
    if ($action === 'approve' || $action === 'reject') {
        $userId = $_POST['user_id'] ?? '';
        $newStatus = $action === 'approve' ? 'approved' : 'rejected';
        $pdo->prepare('UPDATE users SET approval_status = ? WHERE id = ? AND role IN (?, ?)')
            ->execute([$newStatus, $userId, 'coach', 'adviser']);
        $message = 'User ' . ($action === 'approve' ? 'approved' : 'rejected') . '.';
        $msgType = $action === 'approve' ? 'success' : 'error';
    }

    // ── Delete user ────────────────────────────────────────
    if ($action === 'delete_user') {
        $userId = $_POST['user_id'] ?? '';
        $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$userId]);
        $message = 'User deleted.';
        $msgType = 'error';
    }

    // ── Update membership plan ─────────────────────────────
    if ($action === 'update_plan') {
        $planId   = $_POST['plan_id'] ?? '';
        $planName = trim($_POST['plan_name'] ?? 'Membership');
        $price    = (float)($_POST['plan_price'] ?? 15);
        $period   = $_POST['plan_period'] ?? 'month';
        $pdo->prepare('UPDATE membership_plans SET name = ?, price_rm = ?, billing_period = ? WHERE id = ?')
            ->execute([$planName, $price, $period, $planId]);
        // Update features
        $pdo->prepare('DELETE FROM plan_features WHERE plan_id = ?')->execute([$planId]);
        $features = array_filter(array_map('trim', explode("\n", $_POST['plan_features'] ?? '')));
        foreach ($features as $i => $f) {
            $pdo->prepare('INSERT INTO plan_features (plan_id, feature_text, sort_order) VALUES (?, ?, ?)')
                ->execute([$planId, $f, $i]);
        }
        $message = 'Membership plan updated.';
        $msgType = 'success';
    }
}

// ── Pending approvals ──────────────────────────────────────────
$stmt = $pdo->prepare(
    'SELECT * FROM users WHERE role IN (?, ?) AND approval_status = ? ORDER BY created_at DESC'
);
$stmt->execute(['coach', 'adviser', 'pending']);
$pending = $stmt->fetchAll();

// ── All users stats ────────────────────────────────────────────
$stats = $pdo->query(
    "SELECT role, COUNT(*) AS cnt FROM users GROUP BY role ORDER BY FIELD(role, 'user', 'coach', 'adviser', 'admin')"
)->fetchAll();

// ── All users list ─────────────────────────────────────────────
$allUsers = $pdo->query(
    'SELECT u.*, um.status AS member_status
     FROM users u
     LEFT JOIN user_memberships um ON um.user_id = u.id
     ORDER BY u.created_at DESC'
)->fetchAll();

// ── Membership plan ────────────────────────────────────────────
$stmt = $pdo->query('SELECT * FROM membership_plans ORDER BY created_at LIMIT 1');
$plan = $stmt->fetch();
$planFeatures = [];
if ($plan) {
    $stmt = $pdo->prepare('SELECT feature_text FROM plan_features WHERE plan_id = ? ORDER BY sort_order');
    $stmt->execute([$plan['id']]);
    $planFeatures = $stmt->fetchAll(PDO::FETCH_COLUMN);
}

// ── Active subscriptions ───────────────────────────────────────
$subscriptions = $pdo->query(
    'SELECT u.username, u.full_name, um.status, um.start_date, um.end_date, mp.name AS plan_name, mp.price_rm
     FROM user_memberships um
     JOIN users u ON u.id = um.user_id
     LEFT JOIN membership_plans mp ON mp.id = um.plan_id
     WHERE um.status != ?
     ORDER BY um.status, um.start_date DESC',
)->fetchAll();

function h(string $s): string { return htmlspecialchars($s); }
function fmtDate(?string $d): string {
    if (!$d) return '—';
    $ts = strtotime($d);
    return $ts ? date('M j, Y', $ts) : $d;
}
function fmtMoney(float $n): string { return 'RM ' . number_format($n, 2); }
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard - DigitalFit</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body data-page="dashboard-admin">
    <header>
        <h1>Admin Dashboard</h1>
        <nav>
            <a href="index.php">Home</a>
            <span id="headerUserInfo"><?php echo h($session['fullName']) . ' · Admin'; ?></span>
            <a href="logout.php" id="logoutLink">Logout</a>
        </nav>
    </header>
    <main>
        <div class="dashboard">
            <div class="menu">
                <a href="#approvals" data-section="approvals">Approvals</a>
                <a href="#allUsers" data-section="allUsers">View All Users</a>
                <a href="#manageUsers" data-section="manageUsers">Manage Users</a>
                <a href="#manageMembership" data-section="manageMembership">Manage Membership</a>
            </div>
            <div class="content">
                <h2>Welcome, <span id="welcomeName"><?php echo h($session['fullName']); ?></span>!</h2>
                <p>Approve coach and adviser applications, manage every account, and manage the membership plan and subscriptions on offer.</p>

                <?php if ($message): ?>
                    <div class="status-message <?php echo $msgType; ?>" style="display:block;"><?php echo h($message); ?></div>
                <?php endif; ?>

                <!-- ── Approvals ────────────────────────────── -->
                <div id="approvals" class="section">
                    <h3>Pending Coach &amp; Adviser Approvals</h3>
                    <p>New fitness coach and health adviser accounts must be approved here before they can log in. Click a submitted document to view it full size.</p>
                    <div id="approvalsBox">
                        <?php if (!$pending): ?>
                            <p><em>No pending applications.</em></p>
                        <?php else: ?>
                            <?php foreach ($pending as $p): ?>
                                <div class="plan-day" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem;">
                                    <div>
                                        <strong><?php echo h($p['full_name'] ?: $p['username']); ?></strong>
                                        <span style="color:#888;">(<?php echo h($p['username']); ?> · <?php echo h($p['role']); ?>)</span>
                                        <br><em>Applied <?php echo fmtDate($p['created_at']); ?></em>
                                        <?php if ($p['verification_doc_path']): ?>
                                            <br><a href="<?php echo h($p['verification_doc_path']); ?>" target="_blank">View document (<?php echo h($p['verification_file_name'] ?? 'upload'); ?>)</a>
                                        <?php endif; ?>
                                    </div>
                                    <div style="display:flex; gap:.5rem;">
                                        <form method="post" style="display:inline;">
                                            <input type="hidden" name="action" value="approve">
                                            <input type="hidden" name="user_id" value="<?php echo h($p['id']); ?>">
                                            <button type="submit" class="btn-success">Approve</button>
                                        </form>
                                        <form method="post" style="display:inline;">
                                            <input type="hidden" name="action" value="reject">
                                            <input type="hidden" name="user_id" value="<?php echo h($p['id']); ?>">
                                            <button type="submit" class="btn-danger">Reject</button>
                                        </form>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </div>
                </div>

                <!-- ── All Users ────────────────────────────── -->
                <div id="allUsers" class="section">
                    <h3>All Users</h3>
                    <div id="adminStats" style="display:flex; gap:1rem; flex-wrap:wrap; margin-bottom:1rem;">
                        <?php
                        $total = 0;
                        foreach ($stats as $s) { $total += $s['cnt']; }
                        ?>
                        <div class="stat-card"><h4>Total</h4><p><?php echo $total; ?></p></div>
                        <?php foreach ($stats as $s): ?>
                            <div class="stat-card"><h4><?php echo h(ucfirst($s['role'])); ?>s</h4><p><?php echo $s['cnt']; ?></p></div>
                        <?php endforeach; ?>
                    </div>
                    <h4>Registered Accounts</h4>
                    <div id="allUsersBox">
                        <table class="data-table">
                            <thead><tr><th>Username</th><th>Full Name</th><th>Role</th><th>Status</th><th>Membership</th><th>Joined</th></tr></thead>
                            <tbody>
                            <?php foreach ($allUsers as $u): ?>
                                <tr>
                                    <td><?php echo h($u['username']); ?></td>
                                    <td><?php echo h($u['full_name']); ?></td>
                                    <td><?php echo h($u['role']); ?></td>
                                    <td><?php echo h($u['approval_status']); ?></td>
                                    <td><?php echo h($u['member_status'] ?? '—'); ?></td>
                                    <td><?php echo fmtDate($u['created_at']); ?></td>
                                </tr>
                            <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- ── Manage Users ─────────────────────────── -->
                <div id="manageUsers" class="section">
                    <h3>Manage Users</h3>
                    <div class="form-group" style="max-width:240px;">
                        <label for="userRoleFilter">Filter by role:</label>
                        <select id="userRoleFilter" onchange="filterUserTable()">
                            <option value="">All roles</option>
                            <option value="user">Gym User</option>
                            <option value="coach">Fitness Coach</option>
                            <option value="adviser">Health Adviser</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div id="usersTableBox">
                        <table class="data-table" id="manageUsersTable">
                            <thead><tr><th>Username</th><th>Full Name</th><th>Role</th><th>Approval</th><th></th></tr></thead>
                            <tbody>
                            <?php foreach ($allUsers as $u): ?>
                                <tr data-role="<?php echo h($u['role']); ?>">
                                    <td><?php echo h($u['username']); ?></td>
                                    <td><?php echo h($u['full_name']); ?></td>
                                    <td><?php echo h($u['role']); ?></td>
                                    <td><?php echo h($u['approval_status']); ?></td>
                                    <td>
                                        <form method="post" style="display:inline;" onsubmit="return confirm('Delete user <?php echo h(addslashes($u['username'])); ?>? This cannot be undone.');">
                                            <input type="hidden" name="action" value="delete_user">
                                            <input type="hidden" name="user_id" value="<?php echo h($u['id']); ?>">
                                            <button type="submit" class="btn-danger">Delete</button>
                                        </form>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- ── Manage Membership ────────────────────── -->
                <div id="manageMembership" class="section">
                    <h3>Membership Plan</h3>
                    <p>DigitalFit offers a single membership tier, priced in Malaysian Ringgit (RM).</p>
                    <div id="plansAdminBox">
                        <?php if ($plan): ?>
                            <form method="post" style="max-width:500px;">
                                <input type="hidden" name="action" value="update_plan">
                                <input type="hidden" name="plan_id" value="<?php echo h($plan['id']); ?>">
                                <div class="form-group">
                                    <label for="plan_name">Plan name:</label>
                                    <input type="text" id="plan_name" name="plan_name" value="<?php echo h($plan['name']); ?>" required>
                                </div>
                                <div class="form-group">
                                    <label for="plan_price">Price (RM):</label>
                                    <input type="number" step="0.01" id="plan_price" name="plan_price" value="<?php echo h($plan['price_rm']); ?>" required>
                                </div>
                                <div class="form-group">
                                    <label for="plan_period">Billing period:</label>
                                    <select id="plan_period" name="plan_period">
                                        <option value="month" <?php echo $plan['billing_period'] === 'month' ? 'selected' : ''; ?>>Monthly</option>
                                        <option value="year"  <?php echo $plan['billing_period'] === 'year'  ? 'selected' : ''; ?>>Yearly</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="plan_features">Features (one per line):</label>
                                    <textarea id="plan_features" name="plan_features" rows="5"><?php echo h(implode("\n", $planFeatures)); ?></textarea>
                                </div>
                                <button type="submit" class="btn-success">Save Plan</button>
                            </form>
                        <?php else: ?>
                            <p><em>No membership plan configured. Run the schema seeder.</em></p>
                        <?php endif; ?>
                    </div>

                    <h3>Member Subscriptions</h3>
                    <div id="subscriptionsBox">
                        <?php if (!$subscriptions): ?>
                            <p><em>No subscriptions yet.</em></p>
                        <?php else: ?>
                            <table class="data-table">
                                <thead><tr><th>User</th><th>Plan</th><th>Price</th><th>Status</th><th>Start</th><th>End</th></tr></thead>
                                <tbody>
                                <?php foreach ($subscriptions as $sub): ?>
                                    <tr>
                                        <td><?php echo h($sub['full_name'] ?: $sub['username']); ?></td>
                                        <td><?php echo h($sub['plan_name'] ?? '—'); ?></td>
                                        <td><?php echo $sub['price_rm'] ? fmtMoney((float)$sub['price_rm']) : '—'; ?></td>
                                        <td><?php echo h($sub['status']); ?></td>
                                        <td><?php echo fmtDate($sub['start_date']); ?></td>
                                        <td><?php echo fmtDate($sub['end_date']); ?></td>
                                    </tr>
                                <?php endforeach; ?>
                                </tbody>
                            </table>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
        </div>
    </main>
    <footer>
        <p>&copy; 2026 DigitalFit. All rights reserved.</p>
    </footer>
    <script>
    function filterUserTable() {
        var role = document.getElementById('userRoleFilter').value;
        document.querySelectorAll('#manageUsersTable tbody tr').forEach(function(tr) {
            tr.style.display = !role || tr.getAttribute('data-role') === role ? '' : 'none';
        });
    }
    </script>
    <script src="script.js"></script>
</body>
</html>
