<?php
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/auth.php';
$session = requireRole('coach');

$message = '';
$msgType = '';

// ── Gym users list (for selects) ───────────────────────────────
$stmt = $pdo->prepare(
    'SELECT u.id, u.username, u.full_name, um.status AS member_status
     FROM users u
     LEFT JOIN user_memberships um ON um.user_id = u.id
     WHERE u.role = ? AND u.approval_status = ?
     ORDER BY u.username'
);
$stmt->execute(['user', 'approved']);
$gymUsers = $stmt->fetchAll();

// ── Handle POST ────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    // ── Save workout plan ──────────────────────────────────
    if ($action === 'save_workout') {
        $userId  = $_POST['workoutUserSelect'] ?? '';
        $title   = trim($_POST['workoutTitle'] ?? 'My Workout Plan');
        if (!$userId) {
            $message = 'Select a gym user first.';
            $msgType = 'error';
        } else {
            // Upsert workout plan
            $planId = 'wp_' . bin2hex(random_bytes(8));
            $check = $pdo->prepare('SELECT id FROM workout_plans WHERE user_id = ?');
            $check->execute([$userId]);
            $existing = $check->fetch();

            if ($existing) {
                $planId = $existing['id'];
                $pdo->prepare('UPDATE workout_plans SET title = ?, coach_id = ?, updated_at = NOW() WHERE id = ?')
                    ->execute([$title, $session['id'], $planId]);
                // Delete old days/exercises
                $pdo->prepare('DELETE FROM workout_days WHERE plan_id = ?')->execute([$planId]);
            } else {
                $pdo->prepare('INSERT INTO workout_plans (id, user_id, coach_id, title) VALUES (?, ?, ?, ?)')
                    ->execute([$planId, $userId, $session['id'], $title]);
            }

            // Insert days and exercises from form data
            $dayNames  = $_POST['day_name'] ?? [];
            $exNames   = $_POST['ex_name'] ?? [];
            $exSets    = $_POST['ex_sets'] ?? [];
            $exReps    = $_POST['ex_reps'] ?? [];
            $exDayIdx  = $_POST['ex_day_idx'] ?? [];

            foreach ($dayNames as $dIdx => $dayName) {
                $dayName = trim($dayName) ?: 'Day ' . ($dIdx + 1);
                $pdo->prepare('INSERT INTO workout_days (plan_id, day_name, sort_order) VALUES (?, ?, ?)')
                    ->execute([$planId, $dayName, $dIdx]);
                $dayId = $pdo->lastInsertId();

                // Find exercises for this day
                foreach ($exDayIdx as $eIdx => $di) {
                    if ((int)$di === (int)$dIdx && isset($exNames[$eIdx])) {
                        $pdo->prepare('INSERT INTO exercises (day_id, exercise_name, sets, reps, sort_order) VALUES (?, ?, ?, ?, ?)')
                            ->execute([$dayId, trim($exNames[$eIdx]) ?: 'Exercise', $exSets[$eIdx] ?? '3', $exReps[$eIdx] ?? '10', $eIdx]);
                    }
                }
            }
            $message = 'Workout plan saved!';
            $msgType = 'success';
        }
    }

    // ── Add performance record ─────────────────────────────
    if ($action === 'add_performance') {
        $userId = $_POST['performanceUserSelect'] ?? '';
        if (!$userId) {
            $message = 'Select a gym user first.';
            $msgType = 'error';
        } else {
            $date    = $_POST['perfDate'] ?: date('Y-m-d');
            $weight  = $_POST['perfWeight'] ?? '';
            $bodyFat = $_POST['perfBodyFat'] ?? '';
            $notes   = $_POST['perfNotes'] ?? '';
            if ($weight === '') {
                $message = 'Weight is required.';
                $msgType = 'error';
            } else {
                $pdo->prepare(
                    'INSERT INTO performance_records (user_id, coach_id, record_date, weight_kg, body_fat_pct, notes)
                     VALUES (?, ?, ?, ?, ?, ?)'
                )->execute([$userId, $session['id'], $date, (float)$weight, $bodyFat !== '' ? (float)$bodyFat : null, $notes]);
                $message = 'Performance record added.';
                $msgType = 'success';
            }
        }
    }
}

// ── Coach bookings ─────────────────────────────────────────────
$stmt = $pdo->prepare(
    'SELECT b.*, u.full_name AS user_name, u.username AS user_username
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     WHERE b.provider_id = ?
     ORDER BY b.booking_date DESC, b.booking_time DESC'
);
$stmt->execute([$session['id']]);
$coachBookings = $stmt->fetchAll();

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
    <title>Fitness Coach Dashboard - DigitalFit</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body data-page="dashboard-coach">
    <header>
        <h1>Fitness Coach Dashboard</h1>
        <nav>
            <a href="index.php">Home</a>
            <span id="headerUserInfo"><?php echo h($session['fullName']) . ' · Fitness Coach'; ?></span>
            <a href="logout.php" id="logoutLink">Logout</a>
        </nav>
    </header>
    <main>
        <div class="dashboard">
            <div class="menu">
                <a href="#workoutPlans" data-section="workoutPlans">Create Workout Plan</a>
                <a href="#performance" data-section="performance">Performance Analytics</a>
                <a href="#mySessions" data-section="mySessions">My Sessions</a>
            </div>
            <div class="content">
                <h2>Welcome, <span id="welcomeName"><?php echo h($session['fullName']); ?></span>!</h2>
                <p>Build workout plans for your gym members and keep their performance analytics up to date.</p>

                <?php if ($message): ?>
                    <div class="status-message <?php echo $msgType; ?>" style="display:block;"><?php echo h($message); ?></div>
                <?php endif; ?>

                <!-- ── Workout Plan Editor ──────────────────── -->
                <div id="workoutPlans" class="section">
                    <h3>Create / Update Workout Plan</h3>
                    <form id="workoutForm" method="post">
                        <input type="hidden" name="action" value="save_workout">
                        <div class="form-group">
                            <label for="workoutUserSelect">Gym user:</label>
                            <select id="workoutUserSelect" name="workoutUserSelect">
                                <option value="">Select a gym user</option>
                                <?php foreach ($gymUsers as $u): ?>
                                    <option value="<?php echo h($u['id']); ?>">
                                        <?php echo h($u['full_name'] ?: $u['username']) . ' (' . ($u['member_status'] === 'active' ? 'Member' : 'Free') . ')'; ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="workoutTitle">Plan title:</label>
                            <input type="text" id="workoutTitle" name="workoutTitle" placeholder="e.g. 4-Week Strength Plan">
                        </div>

                        <div id="workoutDaysBox"></div>
                        <div class="inline-actions">
                            <button type="button" id="addDayBtn" class="btn-secondary">+ Add training day</button>
                            <button type="submit" class="btn-success">Save Workout Plan</button>
                        </div>
                        <div id="workoutMessage" class="status-message" style="display:none;"></div>
                    </form>
                </div>

                <!-- ── Performance Analytics ────────────────── -->
                <div id="performance" class="section">
                    <h3>Update Performance Analytics</h3>
                    <div class="form-group">
                        <label for="performanceUserSelect">Gym user:</label>
                        <select id="performanceUserSelect" name="performanceUserSelect" form="performanceForm">
                            <option value="">Select a gym user</option>
                            <?php foreach ($gymUsers as $u): ?>
                                <option value="<?php echo h($u['id']); ?>"><?php echo h($u['full_name'] ?: $u['username']); ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <h4>History</h4>
                    <div id="performanceHistory"><p><em>Select a gym user above to see their history.</em></p></div>

                    <h4>Add a Record</h4>
                    <form id="performanceForm" method="post">
                        <input type="hidden" name="action" value="add_performance">
                        <!-- performanceUserSelect above uses form="performanceForm" -->
                        <div class="form-group">
                            <label for="perfDate">Date:</label>
                            <input type="date" id="perfDate" name="perfDate">
                        </div>
                        <div class="form-group">
                            <label for="perfWeight">Weight (kg):</label>
                            <input type="number" step="0.1" id="perfWeight" name="perfWeight" required>
                        </div>
                        <div class="form-group">
                            <label for="perfBodyFat">Body fat (%):</label>
                            <input type="number" step="0.1" id="perfBodyFat" name="perfBodyFat">
                        </div>
                        <div class="form-group">
                            <label for="perfNotes">Notes:</label>
                            <input type="text" id="perfNotes" name="perfNotes" placeholder="e.g. Improved squat form">
                        </div>
                        <div id="performanceMessage" class="status-message" style="display:none;"></div>
                        <button type="submit" class="btn-success">Add Record</button>
                    </form>
                </div>

                <!-- ── My Sessions ──────────────────────────── -->
                <div id="mySessions" class="section">
                    <h3>Upcoming Booked Sessions</h3>
                    <div id="coachBookings">
                        <?php if (!$coachBookings): ?>
                            <p><em>No upcoming sessions booked yet.</em></p>
                        <?php else: ?>
                            <table class="data-table">
                                <thead><tr><th>Gym user</th><th>Date</th><th>Time</th><th>Status</th></tr></thead>
                                <tbody>
                                <?php foreach ($coachBookings as $b): ?>
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
