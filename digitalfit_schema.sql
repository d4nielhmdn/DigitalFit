
CREATE DATABASE IF NOT EXISTS digitalfit
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE digitalfit;


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
) COMMENT='Every account: gym users, coaches, advisers, admins.';


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
) COMMENT='Physical stats for gym-user accounts only.';


CREATE TABLE membership_plans (
    id              VARCHAR(32)     NOT NULL,
    name            VARCHAR(100)    NOT NULL DEFAULT 'Membership',
    price_rm        DECIMAL(8,2)    NOT NULL DEFAULT 15.00,
    billing_period  ENUM('month', 'year') NOT NULL DEFAULT 'month',
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) COMMENT='Configurable membership tier (currently one tier, RM-denominated).';


CREATE TABLE plan_features (
    id              INT             NOT NULL AUTO_INCREMENT,
    plan_id         VARCHAR(32)     NOT NULL,
    feature_text    VARCHAR(255)    NOT NULL,
    sort_order      SMALLINT        NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT fk_feature_plan FOREIGN KEY (plan_id) REFERENCES membership_plans(id) ON DELETE CASCADE
) COMMENT='Ordered list of feature bullets for a membership plan.';


CREATE TABLE user_memberships (
    id          INT             NOT NULL AUTO_INCREMENT,
    user_id     VARCHAR(32)     NOT NULL,
    plan_id     VARCHAR(32)     NULL,
    status      ENUM('none', 'active', 'cancelled') NOT NULL DEFAULT 'none',
    start_date  DATE            NULL,
    end_date    DATE            NULL,
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_membership_user (user_id),
    CONSTRAINT fk_membership_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_membership_plan FOREIGN KEY (plan_id) REFERENCES membership_plans(id) ON DELETE SET NULL
) COMMENT='Current membership subscription for each gym user.';


CREATE TABLE payments (
    id          VARCHAR(32)     NOT NULL,
    user_id     VARCHAR(32)     NULL,
    plan_id     VARCHAR(32)     NULL,
    amount_rm   DECIMAL(8,2)    NOT NULL,
    description TEXT            NOT NULL DEFAULT '',
    paid_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_payment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_payment_plan FOREIGN KEY (plan_id) REFERENCES membership_plans(id) ON DELETE SET NULL
) COMMENT='Immutable ledger of all membership payments.';


CREATE TABLE bookings (
    id              VARCHAR(32)     NOT NULL,
    user_id         VARCHAR(32)     NOT NULL,
    provider_id     VARCHAR(32)     NOT NULL,
    provider_role   ENUM('coach', 'adviser') NOT NULL,
    booking_date    DATE            NOT NULL,
    booking_time    TIME            NOT NULL,
    status          ENUM('confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_booking_user     FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_provider FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE
) COMMENT='Gym-user sessions with coaches or health advisers.';


CREATE TABLE workout_plans (
    id          VARCHAR(32)     NOT NULL,
    user_id     VARCHAR(32)     NOT NULL,
    coach_id    VARCHAR(32)     NOT NULL,
    title       VARCHAR(200)    NOT NULL DEFAULT 'My Workout Plan',
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_workout_plan_user (user_id),
    CONSTRAINT fk_workout_user  FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_workout_coach FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE
) COMMENT='One workout plan per gym user, maintained by their coach.';


CREATE TABLE workout_days (
    id          INT             NOT NULL AUTO_INCREMENT,
    plan_id     VARCHAR(32)     NOT NULL,
    day_name    VARCHAR(100)    NOT NULL DEFAULT 'Day 1',
    sort_order  SMALLINT        NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT fk_day_plan FOREIGN KEY (plan_id) REFERENCES workout_plans(id) ON DELETE CASCADE
) COMMENT='Named training days within a workout plan.';


CREATE TABLE exercises (
    id              INT             NOT NULL AUTO_INCREMENT,
    day_id          INT             NOT NULL,
    exercise_name   VARCHAR(200)    NOT NULL,
    sets            VARCHAR(20)     NOT NULL DEFAULT '3',
    reps            VARCHAR(20)     NOT NULL DEFAULT '10',
    sort_order      SMALLINT        NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT fk_exercise_day FOREIGN KEY (day_id) REFERENCES workout_days(id) ON DELETE CASCADE
) COMMENT='Individual exercises within a training day.';


CREATE TABLE health_reports (
    id              INT             NOT NULL AUTO_INCREMENT,
    user_id         VARCHAR(32)     NOT NULL,
    adviser_id      VARCHAR(32)     NOT NULL,
    bmi             DECIMAL(5,2)    NULL,
    blood_pressure  VARCHAR(20)     NULL,
    summary         TEXT            NULL,
    recommendations TEXT            NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_health_report_user (user_id),
    CONSTRAINT fk_health_user    FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_health_adviser FOREIGN KEY (adviser_id) REFERENCES users(id) ON DELETE CASCADE
) COMMENT='Health assessment created by a health adviser for a gym user.';


CREATE TABLE diet_plans (
    id          INT             NOT NULL AUTO_INCREMENT,
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
) COMMENT='Personalised diet plan created by a health adviser for a gym user.';

-- 13. performance_records
--     Multiple records per gym user over time (coach-tracked).
CREATE TABLE performance_records (
    id              INT             NOT NULL AUTO_INCREMENT,
    user_id         VARCHAR(32)     NOT NULL,
    coach_id        VARCHAR(32)     NOT NULL,
    record_date     DATE            NOT NULL DEFAULT (CURRENT_DATE),
    weight_kg       DECIMAL(5,1)    NOT NULL,
    body_fat_pct    DECIMAL(4,1)    NULL,
    notes           TEXT            NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_perf_user  FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_perf_coach FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE
) COMMENT='Time-series weight / body-fat records logged by a coach for a gym user.';

CREATE INDEX idx_users_role              ON users (role);
CREATE INDEX idx_users_approval_status   ON users (approval_status);

CREATE INDEX idx_bookings_user_id        ON bookings (user_id);
CREATE INDEX idx_bookings_provider_id    ON bookings (provider_id);
CREATE INDEX idx_bookings_date           ON bookings (booking_date);

CREATE INDEX idx_workout_days_plan_id    ON workout_days (plan_id);
CREATE INDEX idx_exercises_day_id        ON exercises (day_id);
CREATE INDEX idx_perf_user_id            ON performance_records (user_id);
CREATE INDEX idx_perf_record_date        ON performance_records (record_date DESC);
CREATE INDEX idx_payments_user_id        ON payments (user_id);
CREATE INDEX idx_payments_paid_at        ON payments (paid_at DESC);


CREATE VIEW v_active_members AS
SELECT
    u.id,
    u.username,
    u.full_name,
    mp.name           AS plan_name,
    mp.price_rm,
    mp.billing_period,
    um.start_date,
    um.end_date
FROM users u
JOIN user_memberships um ON um.user_id = u.id AND um.status = 'active'
JOIN membership_plans mp ON mp.id = um.plan_id
WHERE u.role = 'user';

CREATE VIEW v_pending_approvals AS
SELECT
    id,
    username,
    full_name,
    role,
    verification_doc_path,
    verification_file_name,
    created_at AS applied_at
FROM users
WHERE role IN ('coach', 'adviser')
  AND approval_status = 'pending'
ORDER BY created_at;


CREATE VIEW v_booking_details AS
SELECT
    b.id,
    b.status,
    b.booking_date,
    b.booking_time,
    b.provider_role,
    u.username     AS user_username,
    u.full_name    AS user_full_name,
    p.username     AS provider_username,
    p.full_name    AS provider_full_name,
    b.created_at
FROM bookings b
JOIN users u ON u.id = b.user_id
JOIN users p ON p.id = b.provider_id;


CREATE VIEW v_admin_stats AS
SELECT
    SUM(CASE WHEN role = 'user'    THEN 1 ELSE 0 END) AS total_gym_users,
    SUM(CASE WHEN role = 'coach'   THEN 1 ELSE 0 END) AS total_coaches,
    SUM(CASE WHEN role = 'adviser' THEN 1 ELSE 0 END) AS total_advisers,
    SUM(CASE WHEN role = 'admin'   THEN 1 ELSE 0 END) AS total_admins,
    SUM(CASE WHEN role IN ('coach','adviser') AND approval_status = 'pending' THEN 1 ELSE 0 END) AS pending_approvals,
    SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) -
        (SELECT COUNT(*) FROM user_memberships WHERE status = 'active') AS non_members
FROM users;

CREATE VIEW v_workout_plan_json AS
SELECT
    wp.user_id,
    u.username,
    wp.title,
    c.username       AS coach_username,
    c.full_name      AS coach_full_name,
    wp.updated_at,
    (
        SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
                'id',         wd.id,
                'day_name',   wd.day_name,
                'sort_order', wd.sort_order,
                'exercises', (
                    SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'id',            ex.id,
                            'exercise_name', ex.exercise_name,
                            'sets',          ex.sets,
                            'reps',          ex.reps,
                            'sort_order',    ex.sort_order
                        )
                    )
                    FROM exercises ex WHERE ex.day_id = wd.id
                )
            )
        )
        FROM workout_days wd WHERE wd.plan_id = wp.id
    ) AS days_json
FROM workout_plans wp
JOIN users u ON u.id = wp.user_id
JOIN users c ON c.id = wp.coach_id;

CREATE VIEW v_latest_performance AS
SELECT
    pr.user_id,
    u.username,
    u.full_name,
    pr.record_date,
    pr.weight_kg,
    pr.body_fat_pct,
    pr.notes,
    c.username AS coach_username
FROM performance_records pr
JOIN users u ON u.id = pr.user_id
JOIN users c ON c.id = pr.coach_id
WHERE pr.id = (
    SELECT id
    FROM performance_records pr2
    WHERE pr2.user_id = pr.user_id
    ORDER BY record_date DESC
    LIMIT 1
);

INSERT INTO users (id, username, password, role, full_name, approval_status)
VALUES
    ('u_admin_001',  'admin',       'admin123',  'admin',   'System Admin', 'approved'),
    ('u_coach_001',  'coachjohn',   'coach123',  'coach',   'John Doe',     'approved'),
    ('u_coach_002',  'coachjane',   'coach123',  'coach',   'Jane Smith',   'approved'),
    ('u_advis_001',  'advisermary', 'advise123', 'adviser', 'Mary Lee',     'approved');

INSERT INTO membership_plans (id, name, price_rm, billing_period)
VALUES ('plan_001', 'Membership', 15.00, 'month');

INSERT INTO plan_features (plan_id, feature_text, sort_order)
VALUES
    ('plan_001', 'Unlimited coach & health adviser sessions', 1),
    ('plan_001', 'Personalised workout plans',               2),
    ('plan_001', 'Health reports & diet plans',              3);