<?php
require_once __DIR__ . '/includes/auth.php';
redirectIfLoggedIn();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DigitalFit</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body data-page="home">
    <header>
        <h1>Welcome to DigitalFit</h1>
        <nav>
            <a href="login.php">Login</a>
            <a href="register.php">Register</a>
            <span id="headerUserInfo" style="display:none;"></span>
        </nav>
    </header>
    <main>
        <section class="hero">
            <h2>Achieve Your Fitness Goals</h2>
            <p>Join our community of gym users, fitness coaches, health advisers, and administrators.</p>
            <a href="login.php" class="btn">Get Started</a>
        </section>
        <section class="hero" style="margin-top: 1.5rem; text-align:left;">
            <h3 style="text-align:center;">What you can do on DigitalFit</h3>
            <div class="dashboard" style="box-shadow:none; margin:0; padding:0;">
                <div class="content" style="text-align:left;">
                    <p><strong>Gym Users</strong> — register for membership, view your workout plan and health report, and book sessions with coaches and health advisers.</p>
                    <p><strong>Fitness Coaches</strong> — build workout plans for members and keep their performance analytics up to date.</p>
                    <p><strong>Health Advisers</strong> — generate health reports and create personalised diet plans for members.</p>
                    <p><strong>Admins</strong> — view and manage all users, and manage membership plans and subscriptions.</p>
                </div>
            </div>
        </section>
    </main>
    <footer>
        <p>&copy; 2026 DigitalFit. All rights reserved.</p>
    </footer>
    <script src="script.js"></script>
</body>
</html>
