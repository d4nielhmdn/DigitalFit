<?php
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/auth.php';
$session = requireRole('user');

// ── Helper: get fresh user row ─────────────────────────────────
function freshUser(PDO $pdo, string $userId): array {
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    return $stmt->fetch() ?: [];
}

// ── Helper: get user profile ───────────────────────────────────
function userProfile(PDO $pdo, string $userId): array {
    $stmt = $pdo->prepare('SELECT * FROM user_profiles WHERE user_id = ?');
    $stmt->execute([$userId]);
    return $stmt->fetch() ?: [];
}

// ── Helper: get membership ─────────────────────────────────────
function userMembership(PDO $pdo, string $userId): array {
    $stmt = $pdo->prepare(
        'SELECT um.*, mp.name AS plan_name, mp.price_rm, mp.billing_period
         FROM user_memberships um
         LEFT JOIN membership_plans mp ON mp.id = um.plan_id
         WHERE um.user_id = ?'
    );
    $stmt->execute([$userId]);
    return $stmt->fetch() ?: ['status' => 'none'];
}

// ── Helper: is the user an active member? ──────────────────────
function isMember(array $membership): bool {
    return ($membership['status'] ?? 'none') === 'active';
}

// ── Booking eligibility (preserved from script.js) ─────────────
function getBookingEligibility(array $user, array $membership): array {
    if (isMember($membership)) {
        return ['allowed' => true, 'message' => 'You have an active Membership — book unlimited sessions.'];
    }
    if (empty($user['free_session_used'])) {
        return ['allowed' => true, 'message' => 'You have 1 free session available. After that, Membership (RM 15.00/month) gives unlimited bookings.'];
    }
    return ['allowed' => false, 'message' => 'You\'ve used your free session. Subscribe to Membership for unlimited bookings.'];
}

// ── Time clash check (preserved from script.js) ────────────────
function hasTimeClash(PDO $pdo, string $providerId, string $date, string $time, ?string $excludeId = null): bool {
    $sessionMin = 60;
    $newStart   = timeToMinutes($time);
    $newEnd     = $newStart + $sessionMin;

    $sql  = 'SELECT booking_time, id FROM bookings WHERE provider_id = ? AND booking_date = ? AND status = ?';
    $params = [$providerId, $date, 'confirmed'];
    if ($excludeId) {
        $sql .= ' AND id != ?';
        $params[] = $excludeId;
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    while ($row = $stmt->fetch()) {
        $s = timeToMinutes($row['booking_time']);
        $e = $s + $sessionMin;
        if ($newStart < $e && $s < $newEnd) {
            return true;
        }
    }
    return false;
}

function timeToMinutes(string $t): int {
    $parts = explode(':', $t . ':0');
    return (int)$parts[0] * 60 + (int)($parts[1] ?? 0);
}

// ── Handle POST actions ────────────────────────────────────────
$message   = '';
$msgType   = '';
$user      = freshUser($pdo, $session['id']);
$profile   = userProfile($pdo, $session['id']);
$membership = userMembership($pdo, $session['id']);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    // ── Subscribe to membership ────────────────────────────
    if ($action === 'subscribe') {
        $planId = $_POST['plan_id'] ?? '';
        $stmt = $pdo->prepare('SELECT * FROM membership_plans WHERE id = ?');
        $stmt->execute([$planId]);
        $plan = $stmt->fetch();
        if ($plan) {
            $pdo->prepare('UPDATE user_memberships SET plan_id = ?, status = ?, start_date = CURDATE(), end_date = NULL WHERE user_id = ?')
                ->execute([$planId, 'active', $session['id']]);
            // Record payment (mock)
            $payId = 'pay_' . bin2hex(random_bytes(8));
            $pdo->prepare('INSERT INTO payments (id, user_id, plan_id, amount_rm, description) VALUES (?, ?, ?, ?, ?)')
                ->execute([$payId, $session['id'], $planId, $plan['price_rm'], 'Subscribe to ' . $plan['name']]);
            $message = 'Payment successful! Membership activated.';
            $msgType = 'success';
        }
        $membership = userMembership($pdo, $session['id']);
    }

    // ── Cancel membership ──────────────────────────────────
    if ($action === 'cancel_membership') {
        $pdo->prepare('UPDATE user_memberships SET status = ?, end_date = CURDATE() WHERE user_id = ?')
            ->execute(['cancelled', $session['id']]);
        $membership = userMembership($pdo, $session['id']);
        $message = 'Membership cancelled.';
        $msgType = 'error';
    }

    // ── Book a session ─────────────────────────────────────
    if ($action === 'book') {
        $elig = getBookingEligibility($user, $membership);
        if (!$elig['allowed']) {
            $message = $elig['message'];
            $msgType = 'error';
        } else {
            $type       = $_POST['bookingType'] ?? '';
            $providerId = $_POST['bookingProviderId'] ?? '';
            $date       = $_POST['bookingDate'] ?? '';
            $time       = $_POST['bookingTime'] ?? '';

            if (!$type || !$providerId || !$date || !$time) {
                $message = 'Please complete all booking fields.';
                $msgType = 'error';
            } elseif ($date < date('Y-m-d')) {
                $message = 'Please choose a date that is today or later.';
                $msgType = 'error';
            } elseif (hasTimeClash($pdo, $providerId, $date, $time)) {
                $message = 'That time slot is already booked for the selected ' . ($type === 'coach' ? 'coach' : 'health adviser') . '. Please choose another time.';
                $msgType = 'error';
            } else {
                $bkId = 'bk_' . bin2hex(random_bytes(8));
                $pdo->prepare(
                    'INSERT INTO bookings (id, user_id, provider_id, provider_role, booking_date, booking_time, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?)'
                )->execute([$bkId, $session['id'], $providerId, $type, $date, $time, 'confirmed']);

                // Mark free session used
                if (!isMember($membership) && empty($user['free_session_used'])) {
                    $pdo->prepare('UPDATE users SET free_session_used = 1 WHERE id = ?')
                        ->execute([$session['id']]);
                }
                $message = 'Booking confirmed!';
                $msgType = 'success';
            }
        }
        $user = freshUser($pdo, $session['id']);
    }

    // ── Cancel a booking ───────────────────────────────────
    if ($action === 'cancel_booking') {
        $bkId = $_POST['booking_id'] ?? '';
        $pdo->prepare('UPDATE bookings SET status = ? WHERE id = ? AND user_id = ?')
            ->execute(['cancelled', $bkId, $session['id']]);
        $message = 'Booking cancelled.';
        $msgType = 'error';
    }

    // ── Save profile ───────────────────────────────────────
    if ($action === 'save_profile') {
        $pdo->prepare(
            'INSERT INTO user_profiles (user_id, age, gender, weight_kg, height_cm, fitness_goal)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               age = VALUES(age), gender = VALUES(gender),
               weight_kg = VALUES(weight_kg), height_cm = VALUES(height_cm),
               fitness_goal = VALUES(fitness_goal)'
        )->execute([
            $session['id'],
            $_POST['age'] !== '' ? (int)$_POST['age'] : null,
            $_POST['gender'] ?: null,
            $_POST['weight'] !== '' ? (float)$_POST['weight'] : null,
            $_POST['height'] !== '' ? (int)$_POST['height'] : null,
            $_POST['goal'] ?: null,
        ]);
        $profile = userProfile($pdo, $session['id']);
        $message = 'Profile saved!';
        $msgType = 'success';
    }
}

// ── Refresh after POST actions ─────────────────────────────────
$user       = freshUser($pdo, $session['id']);
$profile    = userProfile($pdo, $session['id']);
$membership = userMembership($pdo, $session['id']);
$elig       = getBookingEligibility($user, $membership);

// ── Load data for display ──────────────────────────────────────
// Workout plan
$workoutPlan = null;
$stmt = $pdo->prepare('SELECT * FROM workout_plans WHERE user_id = ?');
$stmt->execute([$session['id']]);
$workoutPlan = $stmt->fetch();

// Health report
$stmt = $pdo->prepare('SELECT hr.*, u.full_name AS adviser_name FROM health_reports hr JOIN users u ON u.id = hr.adviser_id WHERE hr.user_id = ?');
$stmt->execute([$session['id']]);
$healthReport = $stmt->fetch();

// Diet plan
$stmt = $pdo->prepare('SELECT dp.*, u.full_name AS adviser_name FROM diet_plans dp JOIN users u ON u.id = dp.adviser_id WHERE dp.user_id = ?');
$stmt->execute([$session['id']]);
$dietPlan = $stmt->fetch();

// Membership plan
$stmt = $pdo->prepare('SELECT * FROM membership_plans ORDER BY created_at LIMIT 1');
$stmt->execute();
$plan = $stmt->fetch();

// My bookings
$stmt = $pdo->prepare(
    'SELECT b.*, u.full_name AS provider_name
     FROM bookings b
     JOIN users u ON u.id = b.provider_id
     WHERE b.user_id = ?
     ORDER BY b.booking_date DESC, b.booking_time DESC'
);
$stmt->execute([$session['id']]);
$myBookings = $stmt->fetchAll();

// Providers for booking form
$stmt = $pdo->prepare('SELECT id, username, full_name FROM users WHERE role = ? AND approval_status = ?');
$stmt->execute(['coach', 'approved']);
$coaches = $stmt->fetchAll();
$stmt->execute(['adviser', 'approved']);
$advisers = $stmt->fetchAll();

// ── Helpers ────────────────────────────────────────────────────
function h(string $s): string { return htmlspecialchars($s); }
function fmtDate(?string $d): string {
    if (!$d) return '—';
    $ts = strtotime($d);
    return $ts ? date('M j, Y', $ts) : $d;
}
function fmtMoney(float $n): string { return 'RM ' . number_format($n, 2); }
function labelGoal(?string $g): string {
    return match($g) {
        'lose_weight' => 'Lose Weight', 'gain_muscle' => 'Gain Muscle',
        'maintain' => 'Maintain', 'improve_fitness' => 'Improve Fitness',
        default => $g ?: '—'
    };
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gym User Dashboard - DigitalFit</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body data-page="dashboard-user">
    <header>
        <h1>Gym User Dashboard</h1>
        <nav>
            <a href="index.php">Home</a>
            <span id="headerUserInfo"><?php echo h($session['fullName']) . ' · Gym User'; ?></span>
            <a href="logout.php" id="logoutLink">Logout</a>
        </nav>
    </header>
    <main>
        <div class="dashboard">
            <div class="menu">
                <a href="#workouts" data-section="workouts">My Workouts</a>
                <a href="#membership" data-section="membership">Membership</a>
                <a href="#bookings" data-section="bookings">Book Sessions</a>
                <a href="#progress" data-section="progress">Progress &amp; Reports</a>
                <a href="#profile" data-section="profile">Profile</a>
            </div>
            <div class="content">
                <h2>Welcome, <span id="welcomeName"><?php echo h($session['fullName']); ?></span>!</h2>
                <p>Here you can register for membership, view your workout plan and health report, and book sessions with coaches and health advisers.</p>

                <?php if ($message): ?>
                    <div class="status-message <?php echo $msgType; ?>" style="display:block;"><?php echo h($message); ?></div>
                <?php endif; ?>

                <!-- ── Workout Plan ──────────────────────────── -->
                <div id="workouts" class="section">
                    <h3>My Workout Plan</h3>
                    <div id="workoutPlanBox">
                        <?php if (!isMember($membership)): ?>
                            <p>Personalised workout plans are a Membership benefit.
                                <a href="#" data-jump="membership">Subscribe to Membership</a> (<?php echo $plan ? fmtMoney((float)$plan['price_rm']) : 'RM 15.00'; ?>/month) to unlock yours.</p>
                        <?php elseif (!$workoutPlan): ?>
                            <p>You don't have a workout plan yet. Book a session with a coach and they'll build one for you.</p>
                        <?php else: ?>
                            <?php
                            $stmt = $pdo->prepare('SELECT full_name FROM users WHERE id = ?');
                            $stmt->execute([$workoutPlan['coach_id']]);
                            $coach = $stmt->fetch();
                            ?>
                            <p><strong>Plan:</strong> <?php echo h($workoutPlan['title']); ?>
                                · <strong>Coach:</strong> <?php echo h($coach['full_name'] ?? $workoutPlan['coach_id']); ?>
                                · <em>updated <?php echo fmtDate($workoutPlan['updated_at']); ?></em></p>
                            <?php
                            $stmt = $pdo->prepare('SELECT * FROM workout_days WHERE plan_id = ? ORDER BY sort_order');
                            $stmt->execute([$workoutPlan['id']]);
                            $days = $stmt->fetchAll();
                            foreach ($days as $day):
                            ?>
                                <div class="plan-day">
                                    <strong><?php echo h($day['day_name']); ?></strong>
                                    <ul>
                                    <?php
                                    $stmt = $pdo->prepare('SELECT * FROM exercises WHERE day_id = ? ORDER BY sort_order');
                                    $stmt->execute([$day['id']]);
                                    $exercises = $stmt->fetchAll();
                                    if ($exercises):
                                        foreach ($exercises as $ex):
                                    ?>
                                        <li><?php echo h($ex['exercise_name']); ?> — <?php echo h($ex['sets']); ?> sets × <?php echo h($ex['reps']); ?> reps</li>
                                    <?php endforeach; else: ?>
                                        <li><em>No exercises listed for this day.</em></li>
                                    <?php endif; ?>
                                    </ul>
                                </div>
                            <?php endforeach; ?>
                            <?php if (!$days): ?>
                                <p><em>No training days added yet.</em></p>
                            <?php endif; ?>
                        <?php endif; ?>
                    </div>
                </div>

                <!-- ── Membership ────────────────────────────── -->
                <div id="membership" class="section">
                    <h3>Membership</h3>
                    <div id="membershipStatus">
                        <?php if ($membership['status'] === 'active'): ?>
                            <div class="status-message success">Active Membership since <?php echo fmtDate($membership['start_date']); ?> — unlimited bookings and full features.</div>
                            <form method="post" style="display:inline;">
                                <input type="hidden" name="action" value="cancel_membership">
                                <button type="submit" class="btn-danger" onclick="return confirm('Cancel your Membership?')">Cancel membership</button>
                            </form>
                        <?php elseif ($membership['status'] === 'cancelled'): ?>
                            <div class="status-message error">Your membership was cancelled. Subscribe again to regain unlimited bookings and full features.</div>
                        <?php else: ?>
                            <div class="status-message">
                                <?php echo $user['free_session_used'] ? "You've used your free session." : 'You have 1 free session available.'; ?>
                                Subscribe to Membership for unlimited bookings and full features.
                            </div>
                        <?php endif; ?>
                    </div>

                    <h4>Membership Plan</h4>
                    <div id="membershipPlans">
                        <?php if ($plan): ?>
                            <div class="plan-card">
                                <h4><?php echo h($plan['name']); ?> — <?php echo fmtMoney((float)$plan['price_rm']); ?> / <?php echo h($plan['billing_period']); ?></h4>
                                <ul>
                                    <?php
                                    $stmt = $pdo->prepare('SELECT feature_text FROM plan_features WHERE plan_id = ? ORDER BY sort_order');
                                    $stmt->execute([$plan['id']]);
                                    while ($f = $stmt->fetch()):
                                    ?>
                                        <li><?php echo h($f['feature_text']); ?></li>
                                    <?php endwhile; ?>
                                </ul>
                                <?php if ($membership['status'] === 'active'): ?>
                                    <button type="button" class="btn-primary" disabled>Current plan</button>
                                <?php else: ?>
                                    <form method="post">
                                        <input type="hidden" name="action" value="subscribe">
                                        <input type="hidden" name="plan_id" value="<?php echo h($plan['id']); ?>">
                                        <button type="submit" class="btn-primary">Subscribe</button>
                                    </form>
                                <?php endif; ?>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>

                <!-- ── Book Sessions ─────────────────────────── -->
                <div id="bookings" class="section">
                    <h3>Book a Coach or Health Adviser</h3>
                    <div id="bookingEligibility">
                        <div class="status-message <?php echo $elig['allowed'] ? 'success' : 'error'; ?>">
                            <?php echo h($elig['message']); ?>
                        </div>
                        <?php if (!$elig['allowed']): ?>
                            <button type="button" id="goToMembershipBtn" class="btn-primary" data-jump="membership">Go to Membership</button>
                        <?php endif; ?>
                    </div>

                    <?php if ($elig['allowed']): ?>
                    <div id="bookingFlow">
                        <form id="bookingForm" method="post">
                            <input type="hidden" name="action" value="book">
                            <div class="form-group">
                                <label for="bookingType">I want to book a:</label>
                                <select id="bookingType" name="bookingType">
                                    <option value="coach">Fitness Coach</option>
                                    <option value="adviser">Health Adviser</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="bookingProvider">Choose:</label>
                                <select id="bookingProvider" name="bookingProviderId">
                                    <option value="">Select a coach</option>
                                    <?php foreach ($coaches as $c): ?>
                                        <option value="<?php echo h($c['id']); ?>" data-role="coach"><?php echo h($c['full_name'] ?: $c['username']); ?></option>
                                    <?php endforeach; ?>
                                    <?php foreach ($advisers as $a): ?>
                                        <option value="<?php echo h($a['id']); ?>" data-role="adviser" style="display:none;"><?php echo h($a['full_name'] ?: $a['username']); ?></option>
                                    <?php endforeach; ?>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="bookingDate">Date:</label>
                                <input type="date" id="bookingDate" name="bookingDate" required>
                            </div>
                            <div class="form-group">
                                <label for="bookingTime">Time:</label>
                                <input type="time" id="bookingTime" name="bookingTime" required>
                            </div>
                            <div id="bookingMessage" class="status-message" style="display:none;"></div>
                            <button type="submit" class="btn-success">Book Session</button>
                        </form>
                    </div>
                    <?php endif; ?>

                    <h4>My Bookings</h4>
                    <div id="myBookings">
                        <?php if (!$myBookings): ?>
                            <p><em>You have no bookings yet.</em></p>
                        <?php else: ?>
                            <table class="data-table">
                                <thead><tr><th>Type</th><th>With</th><th>Date</th><th>Time</th><th>Status</th><th></th></tr></thead>
                                <tbody>
                                <?php foreach ($myBookings as $b): ?>
                                    <tr>
                                        <td><?php echo $b['provider_role'] === 'coach' ? 'Coach session' : 'Adviser consultation'; ?></td>
                                        <td><?php echo h($b['provider_name']); ?></td>
                                        <td><?php echo fmtDate($b['booking_date']); ?></td>
                                        <td><?php echo h($b['booking_time']); ?></td>
                                        <td><?php echo h($b['status']); ?></td>
                                        <td>
                                            <?php if ($b['status'] === 'confirmed'): ?>
                                                <form method="post" style="display:inline;">
                                                    <input type="hidden" name="action" value="cancel_booking">
                                                    <input type="hidden" name="booking_id" value="<?php echo h($b['id']); ?>">
                                                    <button type="submit" class="btn-danger">Cancel</button>
                                                </form>
                                            <?php endif; ?>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                                </tbody>
                            </table>
                        <?php endif; ?>
                    </div>
                </div>

                <!-- ── Progress & Reports ────────────────────── -->
                <div id="progress" class="section">
                    <h3>Progress</h3>
                    <div id="progressStats">
                        <?php
                        $bmi = '—';
                        if ($profile['weight_kg'] && $profile['height_cm']) {
                            $h = $profile['height_cm'] / 100;
                            $bmi = number_format($profile['weight_kg'] / ($h * $h), 1);
                        }
                        ?>
                        <div class="stat-card"><h4>Weight</h4><p><?php echo h($profile['weight_kg'] ? $profile['weight_kg'] . ' kg' : '—'); ?></p></div>
                        <div class="stat-card"><h4>Height</h4><p><?php echo h($profile['height_cm'] ? $profile['height_cm'] . ' cm' : '—'); ?></p></div>
                        <div class="stat-card"><h4>BMI</h4><p><?php echo h($bmi); ?></p></div>
                        <div class="stat-card"><h4>Goal</h4><p><?php echo h(labelGoal($profile['fitness_goal'])); ?></p></div>
                        <div class="stat-card"><h4>Membership</h4><p><?php echo isMember($membership) ? 'Active' : 'None'; ?></p></div>
                    </div>

                    <h3>My Health Report</h3>
                    <div id="healthReportBox">
                        <?php if (!isMember($membership)): ?>
                            <p>Health reports and diet plans are a Membership benefit.
                                <a href="#" data-jump="membership">Subscribe to Membership</a> (<?php echo $plan ? fmtMoney((float)$plan['price_rm']) : 'RM 15.00'; ?>/month) to unlock yours.</p>
                        <?php elseif (!$healthReport): ?>
                            <p><em>No health report yet. Book a session with a health adviser to get one.</em></p>
                        <?php else: ?>
                            <div class="plan-day">
                                <p><strong>By:</strong> <?php echo h($healthReport['adviser_name']); ?> · <em><?php echo fmtDate($healthReport['created_at']); ?></em></p>
                                <p><strong>BMI:</strong> <?php echo h($healthReport['bmi'] ?? '—'); ?> · <strong>Blood pressure:</strong> <?php echo h($healthReport['blood_pressure'] ?? '—'); ?></p>
                                <p><strong>Summary:</strong> <?php echo h($healthReport['summary'] ?? '—'); ?></p>
                                <p><strong>Recommendations:</strong> <?php echo h($healthReport['recommendations'] ?? '—'); ?></p>
                            </div>
                        <?php endif; ?>
                    </div>

                    <h3>My Diet Plan</h3>
                    <div id="dietPlanBox">
                        <?php if (!isMember($membership)): ?>
                            <p>Health reports and diet plans are a Membership benefit.
                                <a href="#" data-jump="membership">Subscribe to Membership</a> (<?php echo $plan ? fmtMoney((float)$plan['price_rm']) : 'RM 15.00'; ?>/month) to unlock yours.</p>
                        <?php elseif (!$dietPlan): ?>
                            <p><em>No diet plan yet.</em></p>
                        <?php else: ?>
                            <div class="plan-meal"><strong>Breakfast:</strong> <?php echo h($dietPlan['breakfast'] ?? '—'); ?></div>
                            <div class="plan-meal"><strong>Lunch:</strong> <?php echo h($dietPlan['lunch'] ?? '—'); ?></div>
                            <div class="plan-meal"><strong>Dinner:</strong> <?php echo h($dietPlan['dinner'] ?? '—'); ?></div>
                            <div class="plan-meal"><strong>Snacks:</strong> <?php echo h($dietPlan['snacks'] ?? '—'); ?></div>
                            <?php if (!empty($dietPlan['notes'])): ?>
                                <div class="plan-meal"><strong>Notes:</strong> <?php echo h($dietPlan['notes']); ?></div>
                            <?php endif; ?>
                        <?php endif; ?>
                    </div>
                </div>

                <!-- ── Profile ───────────────────────────────── -->
                <div id="profile" class="section">
                    <h3>My Profile</h3>
                    <form id="profileForm" method="post">
                        <input type="hidden" name="action" value="save_profile">
                        <label for="age">Age:</label>
                        <input type="number" id="age" name="age" min="10" max="100" placeholder="Enter your age" value="<?php echo h($profile['age'] ?? ''); ?>">

                        <label for="gender">Gender:</label>
                        <select id="gender" name="gender">
                            <option value="">Select Gender</option>
                            <option value="male"   <?php echo ($profile['gender'] ?? '') === 'male'   ? 'selected' : ''; ?>>Male</option>
                            <option value="female" <?php echo ($profile['gender'] ?? '') === 'female' ? 'selected' : ''; ?>>Female</option>
                            <option value="other"  <?php echo ($profile['gender'] ?? '') === 'other'  ? 'selected' : ''; ?>>Other</option>
                        </select>

                        <label for="weight">Weight (kg):</label>
                        <input type="number" id="weight" name="weight" step="0.1" placeholder="Enter your weight" value="<?php echo h($profile['weight_kg'] ?? ''); ?>">

                        <label for="height">Height (cm):</label>
                        <input type="number" id="height" name="height" placeholder="Enter your height" value="<?php echo h($profile['height_cm'] ?? ''); ?>">

                        <label for="goal">Fitness Goal:</label>
                        <select id="goal" name="goal">
                            <option value="">Select Goal</option>
                            <option value="lose_weight"     <?php echo ($profile['fitness_goal'] ?? '') === 'lose_weight'     ? 'selected' : ''; ?>>Lose Weight</option>
                            <option value="gain_muscle"     <?php echo ($profile['fitness_goal'] ?? '') === 'gain_muscle'     ? 'selected' : ''; ?>>Gain Muscle</option>
                            <option value="maintain"        <?php echo ($profile['fitness_goal'] ?? '') === 'maintain'        ? 'selected' : ''; ?>>Maintain</option>
                            <option value="improve_fitness" <?php echo ($profile['fitness_goal'] ?? '') === 'improve_fitness' ? 'selected' : ''; ?>>Improve Fitness</option>
                        </select>

                        <button type="submit">Save Profile</button>
                    </form>
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
