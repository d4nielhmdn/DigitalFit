-- ============================================================
--  DigitalFit – openGauss Database Schema
--  Generated from the client-side localStorage prototype
-- ============================================================
--  Run as a superuser, then connect to the new database.
--  Compatible with openGauss 3.x / 5.x (PostgreSQL-dialect DDL).
-- ============================================================

-- -------------------------------------------------------
--  1. DATABASE
-- -------------------------------------------------------
CREATE DATABASE digitalfit
    ENCODING    = 'UTF8'
    LC_COLLATE  = 'en_US.UTF-8'
    LC_CTYPE    = 'en_US.UTF-8';

\c digitalfit;

-- -------------------------------------------------------
--  2. ENUM TYPES
-- -------------------------------------------------------

CREATE TYPE user_role        AS ENUM ('user', 'coach', 'adviser', 'admin');
CREATE TYPE approval_status  AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE membership_status AS ENUM ('none', 'active', 'cancelled');
CREATE TYPE billing_period   AS ENUM ('month', 'year');
CREATE TYPE booking_status   AS ENUM ('confirmed', 'cancelled');
CREATE TYPE gender_type      AS ENUM ('male', 'female', 'other');
CREATE TYPE fitness_goal     AS ENUM (
    'lose_weight', 'gain_muscle', 'maintain', 'improve_fitness'
);

-- -------------------------------------------------------
--  3. TABLES
-- -------------------------------------------------------

-- -----------------------------------------------------------
--  3.1  users
--       Stores every account regardless of role.
--       Verification documents are stored on the filesystem /
--       object storage; only the reference path is kept here.
-- -----------------------------------------------------------
CREATE TABLE users (
    id                      VARCHAR(32)     PRIMARY KEY,
    username                VARCHAR(20)     NOT NULL
                                            CONSTRAINT uq_users_username UNIQUE
                                            CONSTRAINT chk_users_username
                                                CHECK (username ~ '^[a-zA-Z0-9_.]{3,20}$'),
    password                VARCHAR(255)    NOT NULL,
    role                    user_role       NOT NULL DEFAULT 'user',
    full_name               VARCHAR(100)    NOT NULL DEFAULT '',
    approval_status         approval_status NOT NULL DEFAULT 'approved',
    -- Coach / adviser document (stored on disk; path saved here)
    verification_doc_path   TEXT            NULL,
    verification_file_name  VARCHAR(255)    NULL,
    -- Gym-user specific flag (free trial booking)
    free_session_used       BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP       NOT NULL DEFAULT NOW(),
    -- Business rules
    CONSTRAINT chk_approval_scope CHECK (
        (role IN ('coach', 'adviser'))
        OR approval_status = 'approved'   -- admins & users are always approved
    ),
    CONSTRAINT chk_doc_required CHECK (
        role NOT IN ('coach', 'adviser')
        OR verification_doc_path IS NOT NULL  -- coaches/advisers must upload a doc
    )
);

COMMENT ON TABLE  users                         IS 'Every account: gym users, coaches, advisers, admins.';
COMMENT ON COLUMN users.verification_doc_path   IS 'Server-side path to the uploaded certification image.';
COMMENT ON COLUMN users.free_session_used       IS 'Gym users get one free booking; this tracks whether it has been used.';

-- -----------------------------------------------------------
--  3.2  user_profiles
--       Physical stats for gym users (role = ''user'').
--       One row per gym user, created on first profile save.
-- -----------------------------------------------------------
CREATE TABLE user_profiles (
    user_id     VARCHAR(32)     PRIMARY KEY
                                REFERENCES users(id) ON DELETE CASCADE,
    age         SMALLINT        NULL CONSTRAINT chk_profile_age    CHECK (age    BETWEEN 10 AND 100),
    gender      gender_type     NULL,
    weight_kg   NUMERIC(5,1)    NULL CONSTRAINT chk_profile_weight CHECK (weight_kg > 0),
    height_cm   SMALLINT        NULL CONSTRAINT chk_profile_height CHECK (height_cm > 0),
    fitness_goal fitness_goal   NULL,
    updated_at  TIMESTAMP       NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_profiles IS 'Physical stats for gym-user accounts only.';

-- -----------------------------------------------------------
--  3.3  membership_plans
--       DigitalFit keeps a single membership tier priced in RM.
--       The admin can rename / reprice it in the dashboard.
-- -----------------------------------------------------------
CREATE TABLE membership_plans (
    id              VARCHAR(32)     PRIMARY KEY,
    name            VARCHAR(100)    NOT NULL DEFAULT 'Membership',
    price_rm        NUMERIC(8,2)    NOT NULL DEFAULT 15.00
                                    CONSTRAINT chk_plan_price CHECK (price_rm >= 0),
    billing_period  billing_period  NOT NULL DEFAULT 'month',
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP       NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE membership_plans IS 'Configurable membership tier (currently one tier, RM-denominated).';

-- -----------------------------------------------------------
--  3.4  plan_features
--       Bullet-point features shown on the membership card.
-- -----------------------------------------------------------
CREATE TABLE plan_features (
    id              SERIAL          PRIMARY KEY,
    plan_id         VARCHAR(32)     NOT NULL
                                    REFERENCES membership_plans(id) ON DELETE CASCADE,
    feature_text    VARCHAR(255)    NOT NULL,
    sort_order      SMALLINT        NOT NULL DEFAULT 0
);

COMMENT ON TABLE plan_features IS 'Ordered list of feature bullets for a membership plan.';

-- -----------------------------------------------------------
--  3.5  user_memberships
--       Tracks each gym user''s subscription to a plan.
--       One row per user (UNIQUE); status is updated in-place.
-- -----------------------------------------------------------
CREATE TABLE user_memberships (
    id          SERIAL              PRIMARY KEY,
    user_id     VARCHAR(32)         NOT NULL
                                    REFERENCES users(id) ON DELETE CASCADE
                                    CONSTRAINT uq_membership_user UNIQUE,
    plan_id     VARCHAR(32)         NULL
                                    REFERENCES membership_plans(id) ON DELETE SET NULL,
    status      membership_status   NOT NULL DEFAULT 'none',
    start_date  DATE                NULL,
    end_date    DATE                NULL,   -- reserved for future fixed-term billing
    created_at  TIMESTAMP           NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP           NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_membership_dates CHECK (
        end_date IS NULL OR end_date > start_date
    )
);

COMMENT ON TABLE  user_memberships IS 'Current membership subscription for each gym user.';
COMMENT ON COLUMN user_memberships.end_date IS 'NULL = open-ended (cancel any time). Can be set for prepaid terms.';

-- -----------------------------------------------------------
--  3.6  payments
--       Immutable record of every successful payment.
-- -----------------------------------------------------------
CREATE TABLE payments (
    id          VARCHAR(32)     PRIMARY KEY,
    user_id     VARCHAR(32)     NULL
                                REFERENCES users(id) ON DELETE SET NULL,
    plan_id     VARCHAR(32)     NULL
                                REFERENCES membership_plans(id) ON DELETE SET NULL,
    amount_rm   NUMERIC(8,2)    NOT NULL CONSTRAINT chk_payment_amount CHECK (amount_rm >= 0),
    description TEXT            NOT NULL DEFAULT '',
    paid_at     TIMESTAMP       NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE payments IS 'Immutable ledger of all membership payments.';

-- -----------------------------------------------------------
--  3.7  bookings
--       Gym users can book a coach (training session) or an
--       adviser (health consultation).
--       Session duration is fixed at 60 minutes in the app;
--       overlap is prevented at the application layer and by
--       the unique index on (provider_id, booking_date,
--       booking_time).
-- -----------------------------------------------------------
CREATE TABLE bookings (
    id              VARCHAR(32)     PRIMARY KEY,
    user_id         VARCHAR(32)     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id     VARCHAR(32)     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_role   user_role       NOT NULL
                                    CONSTRAINT chk_booking_provider_role
                                        CHECK (provider_role IN ('coach', 'adviser')),
    booking_date    DATE            NOT NULL,
    booking_time    TIME            NOT NULL,
    status          booking_status  NOT NULL DEFAULT 'confirmed',
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_booking_self CHECK (user_id <> provider_id)
);

COMMENT ON TABLE  bookings IS 'Gym-user sessions with coaches or health advisers.';
COMMENT ON COLUMN bookings.provider_role IS 'Denormalised role of the provider for quick filtering.';

-- -----------------------------------------------------------
--  3.8  workout_plans
--       A coach creates/updates one workout plan per gym user.
--       Days and exercises are stored in child tables.
-- -----------------------------------------------------------
CREATE TABLE workout_plans (
    id          VARCHAR(32)     PRIMARY KEY,
    user_id     VARCHAR(32)     NOT NULL
                                REFERENCES users(id) ON DELETE CASCADE
                                CONSTRAINT uq_workout_plan_user UNIQUE,
    coach_id    VARCHAR(32)     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(200)    NOT NULL DEFAULT 'My Workout Plan',
    created_at  TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP       NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE workout_plans IS 'One workout plan per gym user, maintained by their coach.';

-- -----------------------------------------------------------
--  3.9  workout_days
-- -----------------------------------------------------------
CREATE TABLE workout_days (
    id          SERIAL          PRIMARY KEY,
    plan_id     VARCHAR(32)     NOT NULL
                                REFERENCES workout_plans(id) ON DELETE CASCADE,
    day_name    VARCHAR(100)    NOT NULL DEFAULT 'Day 1',
    sort_order  SMALLINT        NOT NULL DEFAULT 0
);

COMMENT ON TABLE workout_days IS 'Named training days within a workout plan.';

-- -----------------------------------------------------------
--  3.10  exercises
-- -----------------------------------------------------------
CREATE TABLE exercises (
    id              SERIAL          PRIMARY KEY,
    day_id          INTEGER         NOT NULL
                                    REFERENCES workout_days(id) ON DELETE CASCADE,
    exercise_name   VARCHAR(200)    NOT NULL,
    sets            VARCHAR(20)     NOT NULL DEFAULT '3',
    reps            VARCHAR(20)     NOT NULL DEFAULT '10',
    sort_order      SMALLINT        NOT NULL DEFAULT 0
);

COMMENT ON TABLE  exercises IS 'Individual exercises within a training day.';
COMMENT ON COLUMN exercises.sets IS 'Stored as text to allow ranges like "3-4" or "AMRAP".';
COMMENT ON COLUMN exercises.reps IS 'Stored as text to allow ranges like "8-12" or descriptive values.';

-- -----------------------------------------------------------
--  3.11  health_reports
--         One report per gym user (latest overwrites previous).
-- -----------------------------------------------------------
CREATE TABLE health_reports (
    id              SERIAL          PRIMARY KEY,
    user_id         VARCHAR(32)     NOT NULL
                                    REFERENCES users(id) ON DELETE CASCADE
                                    CONSTRAINT uq_health_report_user UNIQUE,
    adviser_id      VARCHAR(32)     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bmi             NUMERIC(5,2)    NULL,
    blood_pressure  VARCHAR(20)     NULL,   -- e.g. "120/80"
    summary         TEXT            NULL,
    recommendations TEXT            NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP       NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE health_reports IS 'Health assessment created by a health adviser for a gym user.';

-- -----------------------------------------------------------
--  3.12  diet_plans
--         One plan per gym user (latest overwrites previous).
-- -----------------------------------------------------------
CREATE TABLE diet_plans (
    id          SERIAL          PRIMARY KEY,
    user_id     VARCHAR(32)     NOT NULL
                                REFERENCES users(id) ON DELETE CASCADE
                                CONSTRAINT uq_diet_plan_user UNIQUE,
    adviser_id  VARCHAR(32)     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    breakfast   TEXT            NULL,
    lunch       TEXT            NULL,
    dinner      TEXT            NULL,
    snacks      TEXT            NULL,
    notes       TEXT            NULL,
    created_at  TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP       NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE diet_plans IS 'Personalised diet plan created by a health adviser for a gym user.';

-- -----------------------------------------------------------
--  3.13  performance_records
--         Multiple records per gym user over time (coach-tracked).
-- -----------------------------------------------------------
CREATE TABLE performance_records (
    id              SERIAL          PRIMARY KEY,
    user_id         VARCHAR(32)     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coach_id        VARCHAR(32)     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    record_date     DATE            NOT NULL DEFAULT CURRENT_DATE,
    weight_kg       NUMERIC(5,1)    NOT NULL CONSTRAINT chk_perf_weight CHECK (weight_kg > 0),
    body_fat_pct    NUMERIC(4,1)    NULL CONSTRAINT chk_perf_bf CHECK (body_fat_pct BETWEEN 0 AND 100),
    notes           TEXT            NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE performance_records IS 'Time-series weight / body-fat records logged by a coach for a gym user.';

-- -------------------------------------------------------
--  4. INDEXES
-- -------------------------------------------------------

-- users
CREATE INDEX idx_users_role            ON users (role);
CREATE INDEX idx_users_approval_status ON users (approval_status);

-- bookings – most common look-ups
CREATE INDEX idx_bookings_user_id      ON bookings (user_id);
CREATE INDEX idx_bookings_provider_id  ON bookings (provider_id);
CREATE INDEX idx_bookings_date         ON bookings (booking_date);
-- Prevent exact duplicate slot (application also checks 60-min overlap window)
CREATE UNIQUE INDEX uq_bookings_slot
    ON bookings (provider_id, booking_date, booking_time)
    WHERE status = 'confirmed';

-- workout_days
CREATE INDEX idx_workout_days_plan_id  ON workout_days (plan_id);

-- exercises
CREATE INDEX idx_exercises_day_id      ON exercises (day_id);

-- performance_records
CREATE INDEX idx_perf_user_id          ON performance_records (user_id);
CREATE INDEX idx_perf_record_date      ON performance_records (record_date DESC);

-- payments
CREATE INDEX idx_payments_user_id      ON payments (user_id);
CREATE INDEX idx_payments_paid_at      ON payments (paid_at DESC);

-- -------------------------------------------------------
--  5. TRIGGERS  (auto-update updated_at columns)
-- -------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE PROCEDURE fn_set_updated_at();

CREATE TRIGGER trg_membership_plans_updated_at
    BEFORE UPDATE ON membership_plans
    FOR EACH ROW EXECUTE PROCEDURE fn_set_updated_at();

CREATE TRIGGER trg_user_memberships_updated_at
    BEFORE UPDATE ON user_memberships
    FOR EACH ROW EXECUTE PROCEDURE fn_set_updated_at();

CREATE TRIGGER trg_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE PROCEDURE fn_set_updated_at();

CREATE TRIGGER trg_workout_plans_updated_at
    BEFORE UPDATE ON workout_plans
    FOR EACH ROW EXECUTE PROCEDURE fn_set_updated_at();

CREATE TRIGGER trg_health_reports_updated_at
    BEFORE UPDATE ON health_reports
    FOR EACH ROW EXECUTE PROCEDURE fn_set_updated_at();

CREATE TRIGGER trg_diet_plans_updated_at
    BEFORE UPDATE ON diet_plans
    FOR EACH ROW EXECUTE PROCEDURE fn_set_updated_at();

CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE PROCEDURE fn_set_updated_at();

-- -------------------------------------------------------
--  6. VIEWS
-- -------------------------------------------------------

-- 6.1  Active gym members at a glance
CREATE VIEW v_active_members AS
SELECT
    u.id,
    u.username,
    u.full_name,
    mp.name        AS plan_name,
    mp.price_rm,
    mp.billing_period,
    um.start_date,
    um.end_date
FROM users            u
JOIN user_memberships um ON um.user_id  = u.id AND um.status = 'active'
JOIN membership_plans mp ON mp.id       = um.plan_id
WHERE u.role = 'user';

COMMENT ON VIEW v_active_members IS 'Gym users with an active membership subscription.';

-- 6.2  Pending coach / adviser applications for admin review
CREATE VIEW v_pending_approvals AS
SELECT
    id,
    username,
    full_name,
    role,
    verification_doc_path,
    verification_file_name,
    created_at  AS applied_at
FROM users
WHERE role IN ('coach', 'adviser')
  AND approval_status = 'pending'
ORDER BY created_at;

COMMENT ON VIEW v_pending_approvals IS 'Coach and adviser accounts awaiting admin approval.';

-- 6.3  Booking details with user and provider names
CREATE VIEW v_booking_details AS
SELECT
    b.id,
    b.status,
    b.booking_date,
    b.booking_time,
    b.provider_role,
    u.username          AS user_username,
    u.full_name         AS user_full_name,
    p.username          AS provider_username,
    p.full_name         AS provider_full_name,
    b.created_at
FROM bookings b
JOIN users u ON u.id = b.user_id
JOIN users p ON p.id = b.provider_id;

COMMENT ON VIEW v_booking_details IS 'Bookings joined with user and provider display names.';

-- 6.4  Admin dashboard stats
CREATE VIEW v_admin_stats AS
SELECT
    COUNT(*) FILTER (WHERE role = 'user')    AS total_gym_users,
    COUNT(*) FILTER (WHERE role = 'coach')   AS total_coaches,
    COUNT(*) FILTER (WHERE role = 'adviser') AS total_advisers,
    COUNT(*) FILTER (WHERE role = 'admin')   AS total_admins,
    COUNT(*) FILTER (
        WHERE role IN ('coach','adviser')
          AND approval_status = 'pending'
    )                                         AS pending_approvals,
    COUNT(*) FILTER (WHERE role = 'user')
        - (SELECT COUNT(*) FROM user_memberships WHERE status = 'active')
                                              AS non_members
FROM users;

COMMENT ON VIEW v_admin_stats IS 'Single-row summary counts shown on the admin dashboard.';

-- 6.5  Full workout plan (plan + days + exercises) as JSON per user
CREATE VIEW v_workout_plan_json AS
SELECT
    wp.user_id,
    u.username,
    wp.title,
    c.username          AS coach_username,
    c.full_name         AS coach_full_name,
    wp.updated_at,
    (
        SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
                'id',         wd.id,
                'day_name',   wd.day_name,
                'sort_order', wd.sort_order,
                'exercises',  (
                    SELECT JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'id',            ex.id,
                            'exercise_name', ex.exercise_name,
                            'sets',          ex.sets,
                            'reps',          ex.reps,
                            'sort_order',    ex.sort_order
                        ) ORDER BY ex.sort_order
                    )
                    FROM exercises ex WHERE ex.day_id = wd.id
                )
            ) ORDER BY wd.sort_order
        )
        FROM workout_days wd WHERE wd.plan_id = wp.id
    ) AS days_json
FROM workout_plans wp
JOIN users u ON u.id = wp.user_id
JOIN users c ON c.id = wp.coach_id;

COMMENT ON VIEW v_workout_plan_json IS 'Workout plans aggregated as JSON, mirroring the structure the JS front-end expects.';

-- 6.6  Latest performance record per gym user
CREATE VIEW v_latest_performance AS
SELECT DISTINCT ON (pr.user_id)
    pr.user_id,
    u.username,
    u.full_name,
    pr.record_date,
    pr.weight_kg,
    pr.body_fat_pct,
    pr.notes,
    c.username  AS coach_username
FROM performance_records pr
JOIN users u ON u.id = pr.user_id
JOIN users c ON c.id = pr.coach_id
ORDER BY pr.user_id, pr.record_date DESC;

COMMENT ON VIEW v_latest_performance IS 'Most recent performance record for each gym user.';

-- -------------------------------------------------------
--  7. SEED DATA
-- -------------------------------------------------------

-- 7.1  Default admin + demo staff
INSERT INTO users (id, username, password, role, full_name, approval_status)
VALUES
    ('u_admin_001',  'admin',       'admin123',   'admin',   'System Admin', 'approved'),
    ('u_coach_001',  'coachjohn',   'coach123',   'coach',   'John Doe',     'approved'),
    ('u_coach_002',  'coachjane',   'coach123',   'coach',   'Jane Smith',   'approved'),
    ('u_advis_001',  'advisermary', 'advise123',  'adviser', 'Mary Lee',     'approved');

-- 7.2  Single membership tier
INSERT INTO membership_plans (id, name, price_rm, billing_period)
VALUES ('plan_001', 'Membership', 15.00, 'month');

INSERT INTO plan_features (plan_id, feature_text, sort_order)
VALUES
    ('plan_001', 'Unlimited coach & health adviser sessions', 1),
    ('plan_001', 'Personalised workout plans',               2),
    ('plan_001', 'Health reports & diet plans',              3);

-- -------------------------------------------------------
--  8. USEFUL QUERIES (reference / application layer)
-- -------------------------------------------------------

-- A) Login check (returns user row if credentials match)
-- SELECT id, username, role, full_name, approval_status
-- FROM   users
-- WHERE  username = :username
--   AND  password = :password
--   AND  role     = :role;

-- B) List all gym users with membership status for coach selects
-- SELECT u.id, u.username, u.full_name,
--        COALESCE(um.status, 'none') AS membership_status
-- FROM   users u
-- LEFT JOIN user_memberships um ON um.user_id = u.id
-- WHERE  u.role = 'user'
-- ORDER  BY u.full_name;

-- C) Detect a scheduling clash (60-min sessions)
-- SELECT id FROM bookings
-- WHERE  provider_id   = :provider_id
--   AND  booking_date  = :date
--   AND  status        = 'confirmed'
--   AND  booking_time  < (:time::TIME + INTERVAL '60 minutes')
--   AND  (booking_time + INTERVAL '60 minutes') > :time::TIME;

-- D) Upsert a workout plan (coach saving for a user)
-- INSERT INTO workout_plans (id, user_id, coach_id, title)
-- VALUES (:id, :user_id, :coach_id, :title)
-- ON CONFLICT (user_id) DO UPDATE
--     SET coach_id   = EXCLUDED.coach_id,
--         title      = EXCLUDED.title,
--         updated_at = NOW();

-- E) Upsert health report
-- INSERT INTO health_reports (user_id, adviser_id, bmi, blood_pressure, summary, recommendations)
-- VALUES (:user_id, :adviser_id, :bmi, :bp, :summary, :recs)
-- ON CONFLICT (user_id) DO UPDATE
--     SET adviser_id      = EXCLUDED.adviser_id,
--         bmi             = EXCLUDED.bmi,
--         blood_pressure  = EXCLUDED.blood_pressure,
--         summary         = EXCLUDED.summary,
--         recommendations = EXCLUDED.recommendations,
--         updated_at      = NOW();

-- F) Upsert diet plan
-- INSERT INTO diet_plans (user_id, adviser_id, breakfast, lunch, dinner, snacks, notes)
-- VALUES (:user_id, :adviser_id, :breakfast, :lunch, :dinner, :snacks, :notes)
-- ON CONFLICT (user_id) DO UPDATE
--     SET adviser_id = EXCLUDED.adviser_id,
--         breakfast  = EXCLUDED.breakfast,
--         lunch      = EXCLUDED.lunch,
--         dinner     = EXCLUDED.dinner,
--         snacks     = EXCLUDED.snacks,
--         notes      = EXCLUDED.notes,
--         updated_at = NOW();

-- G) Activate membership after payment
-- UPDATE user_memberships
--    SET plan_id    = :plan_id,
--        status     = 'active',
--        start_date = CURRENT_DATE,
--        end_date   = NULL
-- WHERE  user_id = :user_id;

-- H) Full performance history for a gym user (newest first)
-- SELECT record_date, weight_kg, body_fat_pct, notes, c.full_name AS coach
-- FROM   performance_records pr
-- JOIN   users c ON c.id = pr.coach_id
-- WHERE  pr.user_id = :user_id
-- ORDER  BY record_date DESC;
