-- ============================================================
--  DigitalFit – Seed Data
--  Run AFTER digitalfit_schema.sql to populate starter data.
--  Passwords are stored as plain text (uni assignment).
--  Default passwords:
--    admin / admin123
--    coachjohn / coach123
--    coachjane / coach123
--    advisormary / advise123
-- ============================================================

USE digitalfit;

-- Admin account (approved)
INSERT INTO users (id, username, password, role, full_name, approval_status, free_session_used)
VALUES ('u_admin01', 'admin', 'admin123', 'admin', 'System Admin', 'approved', FALSE);

-- Coach accounts (pre-approved for demo)
INSERT INTO users (id, username, password, role, full_name, approval_status, free_session_used)
VALUES
  ('u_coach01', 'coachjohn', 'coach123', 'coach', 'John Doe', 'approved', FALSE),
  ('u_coach02', 'coachjane', 'coach123', 'coach', 'Jane Smith', 'approved', FALSE);

-- Adviser account (pre-approved for demo)
INSERT INTO users (id, username, password, role, full_name, approval_status, free_session_used)
VALUES ('u_adv01', 'advisormary', 'advise123', 'adviser', 'Mary Lee', 'approved', FALSE);

-- Membership plan
INSERT INTO membership_plans (id, name, price_rm, billing_period)
VALUES ('plan_001', 'Membership', 15.00, 'month');

-- Plan features (in display order)
INSERT INTO plan_features (plan_id, feature_text, sort_order) VALUES
  ('plan_001', 'Unlimited coach & health adviser sessions', 0),
  ('plan_001', 'Personalised workout plans', 1),
  ('plan_001', 'Health reports & diet plans', 2);
