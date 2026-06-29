-- ============================================================
--  DigitalFit – MySQL Database Schema (PHP Backend Edition)
--  Compatible with MySQL 8.0+ (XAMPP)
-- ============================================================

CREATE DATABASE IF NOT EXISTS digitalfit
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE digitalfit;

-- -------------------------------------------------------
-- 1. users
-- -------------------------------------------------------
CREATE TABLE users (
    id                      VARCHAR(32)     NOT NULL,
    username                VARCHAR(20)     NOT NULL,
    password                VARCHAR(255)    NOT NULL,
    role                    ENUM('user', 'coach', 'adviser', 'admin') NOT NULL DEFAULT 'user',
    full_name               VARCHAR(100)    NOT NULL DEFAULT '',
    approval_status         ENUM('pending', 'approved', 'rejected')   NOT NULL DEFAULT 'approved',
    verification_doc_path   TEXT            NULL,
    verification_file_name  VARCHAR(255)    NULL,
    free_session_used       BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_username (username)
);

-- -------------------------------------------------------
-- 2. user_profiles
-- -------------------------------------------------------
CREATE TABLE user_profiles (
    user_id      VARCHAR(32)     NOT NULL,
    age          SMALLINT        NULL,
    gender       ENUM('male', 'female', 'other') NULL,
    weight_kg    DECIMAL(5,1)    NULL,
    height_cm    SMALLINT        NULL,
    fitness_goal ENUM('lose_weight', 'gain_muscle', 'maintain', 'improve_fitness') NULL,
    updated_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -------------------------------------------------------
-- 3. membership_plans
-- -------------------------------------------------------
CREATE TABLE membership_plans (
    id              VARCHAR(32)     NOT NULL,
    name            VARCHAR(100)    NOT NULL DEFAULT 'Membership',
    price           DECIMAL(8,2)    NOT NULL DEFAULT 15.00,
    period          ENUM('month', 'year') NOT NULL DEFAULT 'month',
    features_json   JSON            NULL,
    PRIMARY KEY (id)
);

-- -------------------------------------------------------
-- 4. member_subscriptions
-- -------------------------------------------------------
CREATE TABLE member_subscriptions (
    id          VARCHAR(32)     NOT NULL,
    user_id     VARCHAR(32)     NOT NULL,
    plan_id     VARCHAR(32)     NULL,
    status      ENUM('active', 'cancelled') NOT NULL DEFAULT 'active',
    start_date  DATE            NULL,
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_sub_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_sub_plan FOREIGN KEY (plan_id) REFERENCES membership_plans(id) ON DELETE SET NULL
);

-- -------------------------------------------------------
-- 5. payments
-- -------------------------------------------------------
CREATE TABLE payments (
    id          VARCHAR(32)     NOT NULL,
    user_id     VARCHAR(32)     NOT NULL,
    amount      DECIMAL(8,2)    NOT NULL,
    description TEXT            NOT NULL DEFAULT '',
    payment_date TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_payment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -------------------------------------------------------
-- 6. bookings
-- -------------------------------------------------------
CREATE TABLE bookings (
    id              VARCHAR(32)     NOT NULL,
    user_id         VARCHAR(32)     NOT NULL,
    provider_id     VARCHAR(32)     NOT NULL,
    booking_date    DATE            NOT NULL,
    booking_time    TIME            NOT NULL,
    status          ENUM('confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_booking_user     FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_provider FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -------------------------------------------------------
-- 7. workout_plans
-- -------------------------------------------------------
CREATE TABLE workout_plans (
    id          VARCHAR(32)     NOT NULL,
    user_id     VARCHAR(32)     NOT NULL,
    coach_id    VARCHAR(32)     NOT NULL,
    title       VARCHAR(200)    NOT NULL DEFAULT 'My Workout Plan',
    days_json   JSON            NULL,
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_workout_plan_user (user_id),
    CONSTRAINT fk_workout_user  FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_workout_coach FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -------------------------------------------------------
-- 8. health_reports
-- -------------------------------------------------------
CREATE TABLE health_reports (
    id              VARCHAR(32)     NOT NULL,
    user_id         VARCHAR(32)     NOT NULL,
    adviser_id      VARCHAR(32)     NOT NULL,
    bmi             VARCHAR(20)     NULL,
    blood_pressure  VARCHAR(20)     NULL,
    summary         TEXT            NULL,
    recommendations TEXT            NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_health_report_user (user_id),
    CONSTRAINT fk_health_user    FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_health_adviser FOREIGN KEY (adviser_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -------------------------------------------------------
-- 9. diet_plans
-- -------------------------------------------------------
CREATE TABLE diet_plans (
    id          VARCHAR(32)     NOT NULL,
    user_id     VARCHAR(32)     NOT NULL,
    adviser_id  VARCHAR(32)     NOT NULL,
    breakfast   TEXT            NULL,
    lunch       TEXT            NULL,
    dinner      TEXT            NULL,
    snacks      TEXT            NULL,
    notes       TEXT            NULL,
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_diet_plan_user (user_id),
    CONSTRAINT fk_diet_user    FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_diet_adviser FOREIGN KEY (adviser_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -------------------------------------------------------
-- 10. performance_records
-- -------------------------------------------------------
CREATE TABLE performance_records (
    id              VARCHAR(32)     NOT NULL,
    user_id         VARCHAR(32)     NOT NULL,
    coach_id        VARCHAR(32)     NOT NULL,
    record_date     DATE            NOT NULL,
    weight_kg       DECIMAL(5,1)    NOT NULL,
    body_fat_pct    DECIMAL(4,1)    NULL,
    notes           TEXT            NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_perf_user  FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_perf_coach FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -------------------------------------------------------
-- INDEXES
-- -------------------------------------------------------
CREATE INDEX idx_users_role            ON users (role);
CREATE INDEX idx_users_approval       ON users (approval_status);
CREATE INDEX idx_bookings_user        ON bookings (user_id);
CREATE INDEX idx_bookings_provider    ON bookings (provider_id);
CREATE INDEX idx_bookings_date        ON bookings (booking_date);
CREATE INDEX idx_perf_user            ON performance_records (user_id);
CREATE INDEX idx_perf_date            ON performance_records (record_date DESC);
CREATE INDEX idx_payments_user        ON payments (user_id);
CREATE INDEX idx_payments_date        ON payments (payment_date DESC);
CREATE INDEX idx_subs_user            ON member_subscriptions (user_id);
