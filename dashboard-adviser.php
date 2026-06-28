<?php
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/auth.php';
$session = requireRole('adviser');

$message = '';
$msgType = '';

// ── Gym users ──────────────────────────────────────────────────
$stmt = $pdo->prepare('SELECT id, username, full_name FROM users WHERE role = ? AND approval_status = ? ORDER BY username');
$stmt->execute(['user', 'approved']);
$gymUsers = $stmt->fetchAll();

// ── Handle POST ────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    // ── Save health report ─────────────────────────────────
    if ($action === 'save_report') {
        $userId = $_POST['reportUserSelect'] ?? '';
        if (!$userId) {
            $message = 'Select a gym user first.';
            $msgType = 'error';
        } else {
            $pdo->prepare(
                'INSERT INTO health_reports (user_id, adviser_id, bmi, blood_pressure, summary, recommendations)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   adviser_id = VALUES(adviser_id), bmi = VALUES(bmi),
                   blood_pressure = VALUES(blood_pressure), summary = VALUES(summary),
                   recommendations = VALUES(recommendations), updated_at = NOW()'
            )->execute([
                $userId, $session['id'],
                $_POST['reportBmi'] !== '' ? (float)$_POST['reportBmi'] : null,
                $_POST['reportBp'] ?: null,
                $_POST['reportSummary'] ?: null,
                $_POST['reportRecommendations'] ?: null,
            ]);
            $message = 'Health report saved.';
            $msgType = 'success';
        }
    }

    // ── Save diet plan ─────────────────────────────────────
    if ($action === 'save_diet') {
        $userId = $_POST['dietUserSelect'] ?? '';
        if (!$userId) {
            $message = 'Select a gym user first.';
            $msgType = 'error';
        } else {
            $pdo->prepare(
                'INSERT INTO diet_plans (user_id, adviser_id, breakfast, lunch, dinner, snacks, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   adviser_id = VALUES(adviser_id), breakfast = VALUES(breakfast),
                   lunch = VALUES(lunch), dinner = VALUES(dinner),
                   snacks = VALUES(snacks), notes = VALUES(notes), updated_at = NOW()'
            )->execute([
                $userId, $session['id'],
                $_POST['dietBreakfast'] ?: null,
                $_POST['dietLunch'] ?: null,
                $_POST['dietDinner'] ?: null,
                $_POST['dietSnacks'] ?: null,
                $_POST['dietNotes'] ?: null,
            ]);
            $message = 'Diet plan saved.';
            $msgType = 'success';
        }
    }

    // ── Update diet plan ───────────────────────────────────
    if ($action === 'update_diet') {
        $userId = $_POST['editDietUserSelect'] ?? '';
        if (!$userId) {
            $message = 'Select a gym user first.';
            $msgType = 'error';
        } else {
            $breakfast = trim($_POST['editDietBreakfast'] ?? '');
            $lunch     = trim($_POST['editDietLunch'] ?? '');
            $dinner    = trim($_POST['editDietDinner'] ?? '');
            $snacks    = trim($_POST['editDietSnacks'] ?? '');
            $notes     = trim($_POST['editDietNotes'] ?? '');

            if ($breakfast === '' && $lunch === '' && $dinner === '' && $snacks === '' && $notes === '') {
                $message = 'Please enter at least one diet plan detail.';
                $msgType = 'error';
            } else {
                $check = $pdo->prepare('SELECT id FROM diet_plans WHERE user_id = ?');
                $check->execute([$userId]);
                $existing = $check->fetch();

                if ($existing) {
                    $pdo->prepare(
                        'UPDATE diet_plans SET adviser_id = ?, breakfast = ?, lunch = ?, dinner = ?, snacks = ?, notes = ?, updated_at = NOW()
                         WHERE user_id = ?'
                    )->execute([$session['id'], $breakfast ?: null, $lunch ?: null, $dinner ?: null, $snacks ?: null, $notes ?: null, $userId]);
                } else {
                    $pdo->prepare(
                        'INSERT INTO diet_plans (user_id, adviser_id, breakfast, lunch, dinner, snacks, notes)
                         VALUES (?, ?, ?, ?, ?, ?, ?)'
                    )->execute([$userId, $session['id'], $breakfast ?: null, $lunch ?: null, $dinner ?: null, $snacks ?: null, $notes ?: null]);
                }
                $message = 'Diet plan updated.';
                $msgType = 'success';
            }
        }
    }
}

// ── Adviser bookings ───────────────────────────────────────────
$stmt = $pdo->prepare(
    'SELECT b.*, u.full_name AS user_name, u.username AS user_username
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     WHERE b.provider_id = ?
     ORDER BY b.booking_date DESC, b.booking_time DESC'
);
$stmt->execute([$session['id']]);
$adviserBookings = $stmt->fetchAll();

// ── Fill selects for health report ─────────────────────────────
$selectedReportUser = $_POST['reportUserSelect'] ?? '';
$reportData = null;
if ($selectedReportUser) {
    $stmt = $pdo->prepare('SELECT * FROM health_reports WHERE user_id = ?');
    $stmt->execute([$selectedReportUser]);
    $reportData = $stmt->fetch();
    if (!$reportData) {
        // Auto-fill BMI from profile
        $stmt = $pdo->prepare('SELECT weight_kg, height_cm FROM user_profiles WHERE user_id = ?');
        $stmt->execute([$selectedReportUser]);
        $prof = $stmt->fetch();
        if ($prof && $prof['weight_kg'] && $prof['height_cm']) {
            $reportData = ['bmi' => number_format($prof['weight_kg'] / (($prof['height_cm'] / 100) ** 2), 1)];
        }
    }
}

$selectedDietUser = $_POST['dietUserSelect'] ?? '';
$dietExisting = null;
if ($selectedDietUser) {
    $stmt = $pdo->prepare('SELECT * FROM diet_plans WHERE user_id = ?');
    $stmt->execute([$selectedDietUser]);
    $dietExisting = $stmt->fetch();
}

$selectedEditUser = $_POST['editDietUserSelect'] ?? '';
$editDietExisting = null;
if ($selectedEditUser) {
    $stmt = $pdo->prepare('SELECT * FROM diet_plans WHERE user_id = ?');
    $stmt->execute([$selectedEditUser]);
    $editDietExisting = $stmt->fetch();
}

function h(string $s): string { return htmlspecialchars($s); }
function fmtDate(?string $d): string {
    if (!$d) return '—';
    $ts = strtotime($d);
    return $ts ? date('M j, Y', $ts) : $d;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Health Adviser Dashboard - DigitalFit</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body data-page="dashboard-adviser">
    <header>
        <h1>Health Adviser Dashboard</h1>
        <nav>
            <a href="index.php">Home</a>
            <span id="headerUserInfo"><?php echo h($session['fullName']) . ' · Health Adviser'; ?></span>
            <a href="logout.php" id="logoutLink">Logout</a>
        </nav>
    </header>
    <main>
        <div class="dashboard">
            <div class="menu">
                <a href="#healthReports" data-section="healthReports">Generate Health Report</a>
                <a href="#dietPlans" data-section="dietPlans">Create Diet Plan</a>
                <a href="#editDietPlans" data-section="editDietPlans">Edit Diet Plan</a>
                <a href="#myConsults" data-section="myConsults">My Consultations</a>
            </div>
            <div class="content">
                <h2>Welcome, <span id="welcomeName"><?php echo h($session['fullName']); ?></span>!</h2>
                <p>Generate health reports and build personalised diet plans for gym members.</p>

                <?php if ($message): ?>
                    <div class="status-message <?php echo $msgType; ?>" style="display:block;"><?php echo h($message); ?></div>
                <?php endif; ?>

                <!-- ── Health Reports ───────────────────────── -->
                <div id="healthReports" class="section">
                    <h3>Generate Health Report</h3>
                    <form method="post" id="reportFormRedirect">
                        <input type="hidden" name="action" value="">
                        <div class="form-group">
                            <label for="reportUserSelect">Gym user:</label>
                            <select id="reportUserSelect" name="reportUserSelect" onchange="this.form.submit()">
                                <option value="">Select a gym user</option>
                                <?php foreach ($gymUsers as $u): ?>
                                    <option value="<?php echo h($u['id']); ?>" <?php echo $selectedReportUser === $u['id'] ? 'selected' : ''; ?>>
                                        <?php echo h($u['full_name'] ?: $u['username']); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </form>
                    <form id="reportForm" method="post">
                        <input type="hidden" name="action" value="save_report">
                        <input type="hidden" name="reportUserSelect" value="<?php echo h($selectedReportUser); ?>">
                        <div class="form-group">
                            <label for="reportBmi">BMI:</label>
                            <input type="text" id="reportBmi" name="reportBmi" placeholder="auto-filled from profile if available"
                                   value="<?php echo h($reportData['bmi'] ?? ''); ?>">
                        </div>
                        <div class="form-group">
                            <label for="reportBp">Blood pressure:</label>
                            <input type="text" id="reportBp" name="reportBp" placeholder="e.g. 120/80"
                                   value="<?php echo h($reportData['blood_pressure'] ?? ''); ?>">
                        </div>
                        <div class="form-group">
                            <label for="reportSummary">Summary:</label>
                            <textarea id="reportSummary" name="reportSummary" rows="3" placeholder="Overall health summary"><?php echo h($reportData['summary'] ?? ''); ?></textarea>
                        </div>
                        <div class="form-group">
                            <label for="reportRecommendations">Recommendations:</label>
                            <textarea id="reportRecommendations" name="reportRecommendations" rows="3" placeholder="Recommendations for the member"><?php echo h($reportData['recommendations'] ?? ''); ?></textarea>
                        </div>
                        <div id="reportMessage" class="status-message" style="display:none;"></div>
                        <button type="submit" class="btn-success">Save Health Report</button>
                    </form>
                </div>

                <!-- ── Diet Plans ───────────────────────────── -->
                <div id="dietPlans" class="section">
                    <h3>Create Diet Plan</h3>
                    <form method="post" id="dietFormRedirect">
                        <input type="hidden" name="action" value="">
                        <div class="form-group">
                            <label for="dietUserSelect">Gym user:</label>
                            <select id="dietUserSelect" name="dietUserSelect" onchange="this.form.submit()">
                                <option value="">Select a gym user</option>
                                <?php foreach ($gymUsers as $u): ?>
                                    <option value="<?php echo h($u['id']); ?>" <?php echo $selectedDietUser === $u['id'] ? 'selected' : ''; ?>>
                                        <?php echo h($u['full_name'] ?: $u['username']); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </form>
                    <form id="dietForm" method="post">
                        <input type="hidden" name="action" value="save_diet">
                        <input type="hidden" name="dietUserSelect" value="<?php echo h($selectedDietUser); ?>">
                        <div class="form-group">
                            <label for="dietBreakfast">Breakfast:</label>
                            <textarea id="dietBreakfast" name="dietBreakfast" rows="2"><?php echo h($dietExisting['breakfast'] ?? ''); ?></textarea>
                        </div>
                        <div class="form-group">
                            <label for="dietLunch">Lunch:</label>
                            <textarea id="dietLunch" name="dietLunch" rows="2"><?php echo h($dietExisting['lunch'] ?? ''); ?></textarea>
                        </div>
                        <div class="form-group">
                            <label for="dietDinner">Dinner:</label>
                            <textarea id="dietDinner" name="dietDinner" rows="2"><?php echo h($dietExisting['dinner'] ?? ''); ?></textarea>
                        </div>
                        <div class="form-group">
                            <label for="dietSnacks">Snacks:</label>
                            <textarea id="dietSnacks" name="dietSnacks" rows="2"><?php echo h($dietExisting['snacks'] ?? ''); ?></textarea>
                        </div>
                        <div class="form-group">
                            <label for="dietNotes">Notes (allergies, goals, etc.):</label>
                            <textarea id="dietNotes" name="dietNotes" rows="2"><?php echo h($dietExisting['notes'] ?? ''); ?></textarea>
                        </div>
                        <div id="dietMessage" class="status-message" style="display:none;"></div>
                        <button type="submit" class="btn-success">Save Diet Plan</button>
                    </form>
                </div>

                <!-- ── Edit Diet Plans ──────────────────────── -->
                <div id="editDietPlans" class="section">
                    <h3>Edit Diet Plan</h3>
                    <p>Update an existing diet plan for a gym member.</p>
                    <form method="post" id="editDietFormRedirect">
                        <input type="hidden" name="action" value="">
                        <div class="form-group">
                            <label for="editDietUserSelect">Gym user:</label>
                            <select id="editDietUserSelect" name="editDietUserSelect" onchange="this.form.submit()">
                                <option value="">Select a gym user</option>
                                <?php foreach ($gymUsers as $u): ?>
                                    <option value="<?php echo h($u['id']); ?>" <?php echo $selectedEditUser === $u['id'] ? 'selected' : ''; ?>>
                                        <?php echo h($u['full_name'] ?: $u['username']); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </form>
                    <form id="editDietForm" method="post">
                        <input type="hidden" name="action" value="update_diet">
                        <input type="hidden" name="editDietUserSelect" value="<?php echo h($selectedEditUser); ?>">
                        <?php if ($selectedEditUser && !$editDietExisting): ?>
                            <div class="status-message error" style="display:block;">No existing diet plan found. Create one first.</div>
                        <?php endif; ?>
                        <div class="form-group">
                            <label for="editDietBreakfast">Breakfast:</label>
                            <textarea id="editDietBreakfast" name="editDietBreakfast" rows="2"><?php echo h($editDietExisting['breakfast'] ?? ''); ?></textarea>
                        </div>
                        <div class="form-group">
                            <label for="editDietLunch">Lunch:</label>
                            <textarea id="editDietLunch" name="editDietLunch" rows="2"><?php echo h($editDietExisting['lunch'] ?? ''); ?></textarea>
                        </div>
                        <div class="form-group">
                            <label for="editDietDinner">Dinner:</label>
                            <textarea id="editDietDinner" name="editDietDinner" rows="2"><?php echo h($editDietExisting['dinner'] ?? ''); ?></textarea>
                        </div>
                        <div class="form-group">
                            <label for="editDietSnacks">Snacks:</label>
                            <textarea id="editDietSnacks" name="editDietSnacks" rows="2"><?php echo h($editDietExisting['snacks'] ?? ''); ?></textarea>
                        </div>
                        <div class="form-group">
                            <label for="editDietNotes">Notes:</label>
                            <textarea id="editDietNotes" name="editDietNotes" rows="2"><?php echo h($editDietExisting['notes'] ?? ''); ?></textarea>
                        </div>
                        <div id="editDietMessage" class="status-message" style="display:none;"></div>
                        <button type="submit" class="btn-success">Update Diet Plan</button>
                    </form>
                </div>

                <!-- ── My Consultations ─────────────────────── -->
                <div id="myConsults" class="section">
                    <h3>Upcoming Booked Consultations</h3>
                    <div id="adviserBookings">
                        <?php if (!$adviserBookings): ?>
                            <p><em>No upcoming consultations booked yet.</em></p>
                        <?php else: ?>
                            <table class="data-table">
                                <thead><tr><th>Gym user</th><th>Date</th><th>Time</th><th>Status</th></tr></thead>
                                <tbody>
                                <?php foreach ($adviserBookings as $b): ?>
                                    <tr>
                                        <td><?php echo h($b['user_name'] ?: $b['user_username']); ?></td>
                                        <td><?php echo fmtDate($b['booking_date']); ?></td>
                                        <td><?php echo h($b['booking_time']); ?></td>
                                        <td><?php echo h($b['status']); ?></td>
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
    <script src="script.js"></script>
</body>
</html>
