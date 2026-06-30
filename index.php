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
    <header class="site-header">
        <a class="brand" href="index.php" aria-label="DigitalFit Home">
            <span>DIGITALFIT</span>
        </a>
        <nav>
            <a href="index.php" class="active">Home</a>
            <a href="#membership">Membership</a>
            <a href="login.php" class="nav-button">Login</a>
            <a href="register.php" class="nav-button nav-button-fill">Register</a>
            <span id="headerUserInfo" style="display:none;"></span>
        </nav>
    </header>

    <main class="home-main">
        <section class="home-hero">
            <div class="hero-overlay"></div>
            <div class="hero-content">
                <p class="eyebrow">Digital Fitness Coaching</p>
                <h1>Health <span>and</span> Fitness Journey Starts Here</h1>
                <p>Personalised workout plans, health advice, coaching sessions, and membership management in one simple web app.</p>
                <div class="hero-actions">
                    <a href="register.php" class="btn">Get Started</a>
                </div>
            </div>
        </section>

        <section id="membership" class="section-block pricing-section">
            <h2>Our Pricing Plan</h2>
            <div class="pricing-grid">
                <article class="pricing-card">
                    <h3>Monthly</h3>
                    <p class="price">RM15<span>/month</span></p>
                    <p class="small-note">RM180 / Year</p>
                    <a href="register.php" class="card-button">Get Started!</a>
                </article>
            </div>
        </section>
    </main>

    <footer>
        <p>&copy; 2026 DigitalFit. All rights reserved.</p>
    </footer>
    <script src="script.js"></script>
</body>
</html>
