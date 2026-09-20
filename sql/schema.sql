-- ============================================================
--  Alpha Ultimate ERP — Full NeonDB Schema v5
--  Construction & Cleaning Subcontracting | Saudi Arabia
--  Run this entire file in your NeonDB SQL Editor.
--  Fully idempotent (safe to re-run).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Sequences ────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS expense_seq    START 1;
CREATE SEQUENCE IF NOT EXISTS invoice_seq   START 1;
CREATE SEQUENCE IF NOT EXISTS asset_seq     START 1;
CREATE SEQUENCE IF NOT EXISTS liability_seq START 1;
CREATE SEQUENCE IF NOT EXISTS investment_seq START 1;
CREATE SEQUENCE IF NOT EXISTS advance_seq   START 1;

-- ============================================================
--  1. USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT        UNIQUE NOT NULL,
  email         TEXT        UNIQUE NOT NULL,
  password_hash TEXT        NOT NULL,
  full_name     TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'staff'
                            CHECK (role IN ('superuser','manager','staff')),
  department    TEXT,
  phone         TEXT,
  avatar_url    TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login    TIMESTAMPTZ,
  last_login_ip TEXT
);

-- ============================================================
--  2. GRANULAR PERMISSION MATRIX
--     Levels: none | view_only | submit_only | superuser
-- ============================================================
CREATE TABLE IF NOT EXISTS user_permissions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module       TEXT        NOT NULL CHECK (module IN (
                             'finance','users','bookings','content',
                             'reports','media','settings',
                             'assets','liabilities','investments','approvals'
                           )),
  access_level TEXT        NOT NULL DEFAULT 'none'
                           CHECK (access_level IN ('none','view_only','submit_only','superuser')),
  granted_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, module)
);

-- ============================================================
--  3. EXPENSE CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS expense_categories (
  id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name      TEXT    NOT NULL,
  code      TEXT,
  is_active BOOLEAN DEFAULT true
);

-- ============================================================
--  4. EXPENSES  (immutable after submission — is_locked=true)
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  form_number       TEXT          UNIQUE NOT NULL,
  submitted_by      UUID          NOT NULL REFERENCES users(id),
  submitted_by_name TEXT          NOT NULL,
  submitted_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  project_name      TEXT,
  project_location  TEXT,
  category_id       UUID          REFERENCES expense_categories(id),
  notes             TEXT,
  total_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total         NUMERIC(14,2) NOT NULL DEFAULT 0,
  grand_total       NUMERIC(14,2) NOT NULL DEFAULT 0,
  media_urls        JSONB         DEFAULT '[]',
  is_locked         BOOLEAN       NOT NULL DEFAULT true,
  status            TEXT          NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','approved','rejected','hold')),
  approved_by       UUID          REFERENCES users(id),
  approved_at       TIMESTAMPTZ,
  rejection_comment TEXT
);

CREATE TABLE IF NOT EXISTS expense_line_items (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id  UUID          NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  description TEXT          NOT NULL,
  quantity    NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit        TEXT,
  unit_price  NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_percent NUMERIC(5,2)  NOT NULL DEFAULT 15,
  line_total  NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order  INTEGER       DEFAULT 0
);

-- ============================================================
--  5. INVOICES  (immutable after submission)
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number    TEXT          UNIQUE NOT NULL,
  submitted_by      UUID          NOT NULL REFERENCES users(id),
  submitted_by_name TEXT          NOT NULL,
  submitted_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  client_name       TEXT          NOT NULL,
  client_address    TEXT,
  client_vat_number TEXT,
  project_name      TEXT,
  po_number         TEXT,
  due_date          DATE,
  payment_terms     TEXT,
  subtotal          NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total         NUMERIC(14,2) NOT NULL DEFAULT 0,
  grand_total       NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes             TEXT,
  media_urls        JSONB         DEFAULT '[]',
  status            TEXT          NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','approved','rejected','hold')),
  approved_by       UUID          REFERENCES users(id),
  approved_at       TIMESTAMPTZ,
  rejection_comment TEXT
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT          NOT NULL,
  quantity    NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit        TEXT,
  unit_price  NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_percent NUMERIC(5,2)  NOT NULL DEFAULT 15,
  line_total  NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order  INTEGER       DEFAULT 0
);

-- ============================================================
--  6. CASH ADVANCES  (Wallet / Personal Log)
-- ============================================================
CREATE TABLE IF NOT EXISTS cash_advances (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_number  TEXT          UNIQUE NOT NULL,
  user_id     UUID          NOT NULL REFERENCES users(id),
  amount      NUMERIC(14,2) NOT NULL,
  description TEXT,
  reference   TEXT,
  approved_by UUID          REFERENCES users(id),
  status      TEXT          NOT NULL DEFAULT 'approved'
              CHECK (status IN ('approved','cancelled')),
  received_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================
--  7. ASSETS MODULE
-- ============================================================
CREATE TABLE IF NOT EXISTS assets (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_number        TEXT          UNIQUE NOT NULL,
  name                TEXT          NOT NULL,
  category            TEXT          CHECK (category IN
                                    ('vehicle','equipment','building','it','furniture','other')),
  location            TEXT,
  project_branch      TEXT,
  purchase_date       DATE,
  purchase_cost       NUMERIC(14,2) DEFAULT 0,
  useful_life_years   NUMERIC(5,1)  DEFAULT 5,
  salvage_value       NUMERIC(14,2) DEFAULT 0,
  depreciation_method TEXT          DEFAULT 'straight_line'
                                    CHECK (depreciation_method IN ('straight_line','declining_balance')),
  vendor              TEXT,
  internal_owner      UUID          REFERENCES users(id),
  warranty_expiry     DATE,
  status              TEXT          NOT NULL DEFAULT 'in_use'
                                    CHECK (status IN ('in_use','under_maintenance','disposed','lost')),
  notes               TEXT,
  media_urls          JSONB         DEFAULT '[]',
  submitted_by        UUID          REFERENCES users(id),
  submitted_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_depreciation (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id      UUID          NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  period_date   DATE          NOT NULL,
  depreciation  NUMERIC(14,2) NOT NULL,
  book_value    NUMERIC(14,2) NOT NULL,
  calculated_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_maintenance (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id         UUID          NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  maintenance_date DATE,
  type             TEXT,
  cost             NUMERIC(14,2) DEFAULT 0,
  vendor           TEXT,
  next_due         DATE,
  notes            TEXT,
  logged_by        UUID          REFERENCES users(id),
  logged_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================
--  8. LIABILITIES MODULE
-- ============================================================
CREATE TABLE IF NOT EXISTS liabilities (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  liability_number TEXT          UNIQUE NOT NULL,
  type             TEXT          CHECK (type IN ('bank_loan','supplier_credit','lease','other')),
  lender_supplier  TEXT          NOT NULL,
  project_branch   TEXT,
  principal        NUMERIC(14,2) NOT NULL DEFAULT 0,
  interest_rate    NUMERIC(7,4)  DEFAULT 0,
  start_date       DATE,
  maturity_date    DATE,
  installment_amt  NUMERIC(14,2) DEFAULT 0,
  frequency        TEXT          DEFAULT 'monthly'
                                 CHECK (frequency IN ('monthly','quarterly','yearly','one_time')),
  status           TEXT          NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active','settled','overdue','restructured')),
  notes            TEXT,
  media_urls       JSONB         DEFAULT '[]',
  submitted_by     UUID          REFERENCES users(id),
  submitted_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS liability_payments (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  liability_id UUID          NOT NULL REFERENCES liabilities(id) ON DELETE CASCADE,
  due_date     DATE          NOT NULL,
  amount       NUMERIC(14,2) NOT NULL,
  paid_date    DATE,
  paid_amount  NUMERIC(14,2) DEFAULT 0,
  status       TEXT          DEFAULT 'pending'
               CHECK (status IN ('pending','paid','overdue','partial')),
  notes        TEXT
);

-- ============================================================
--  9. INVESTMENTS MODULE
-- ============================================================
CREATE TABLE IF NOT EXISTS investments (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_number  TEXT          UNIQUE NOT NULL,
  title              TEXT          NOT NULL,
  type               TEXT          CHECK (type IN ('equity','loan','bond','real_estate','other')),
  project_branch     TEXT,
  start_date         DATE,
  end_date           DATE,
  principal          NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency           TEXT          DEFAULT 'SAR',
  expected_roi_pct   NUMERIC(7,4)  DEFAULT 0,
  payment_frequency  TEXT          DEFAULT 'yearly'
                                   CHECK (payment_frequency IN ('monthly','quarterly','yearly')),
  risk_level         TEXT          DEFAULT 'medium'
                                   CHECK (risk_level IN ('low','medium','high')),
  investor_name      TEXT,
  investor_contact   TEXT,
  internal_owner     UUID          REFERENCES users(id),
  status             TEXT          NOT NULL DEFAULT 'draft'
                                   CHECK (status IN ('draft','active','closed','on_hold','written_off')),
  notes              TEXT,
  media_urls         JSONB         DEFAULT '[]',
  submitted_by       UUID          REFERENCES users(id),
  submitted_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investment_cashflows (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id UUID          NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  period_date   DATE          NOT NULL,
  expected_amt  NUMERIC(14,2) NOT NULL DEFAULT 0,
  actual_amt    NUMERIC(14,2) DEFAULT 0,
  status        TEXT          DEFAULT 'pending'
               CHECK (status IN ('pending','received','partial','missed')),
  notes         TEXT
);

-- ============================================================
--  10. MEDIA UPLOADS
-- ============================================================
CREATE TABLE IF NOT EXISTS media_uploads (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by       UUID        NOT NULL REFERENCES users(id),
  entity_type       TEXT,
  entity_id         UUID,
  original_filename TEXT        NOT NULL,
  file_size_bytes   INTEGER,
  mime_type         TEXT,
  imgbb_url         TEXT,
  imgbb_delete_url  TEXT,
  imgbb_thumb_url   TEXT,
  status            TEXT        DEFAULT 'active'
                                CHECK (status IN ('active','archived','deleted')),
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  11. IN-APP NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  is_read     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  12. IMMUTABLE AUDIT LOG  (never UPDATE/DELETE from app)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID,
  user_name   TEXT,
  action      TEXT        NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  details     JSONB,
  ip_address  TEXT,
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  13. SYSTEM SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS system_settings (
  key        TEXT        PRIMARY KEY,
  value      JSONB,
  updated_by UUID        REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  14. VIEWS
-- ============================================================
CREATE OR REPLACE VIEW user_wallet_balance AS
SELECT
  u.id          AS user_id,
  u.full_name,
  u.email,
  u.department,
  COALESCE(SUM(ca.amount) FILTER (WHERE ca.status = 'approved'), 0)       AS total_received,
  COALESCE(SUM(e.grand_total) FILTER (WHERE e.status = 'approved'), 0)    AS total_expenses,
  COALESCE(SUM(ca.amount) FILTER (WHERE ca.status = 'approved'), 0)
  - COALESCE(SUM(e.grand_total) FILTER (WHERE e.status = 'approved'), 0)  AS current_balance
FROM users u
LEFT JOIN cash_advances ca ON ca.user_id = u.id
LEFT JOIN expenses       e  ON e.submitted_by = u.id
GROUP BY u.id, u.full_name, u.email, u.department;

CREATE OR REPLACE VIEW pending_approvals_count AS
SELECT
  (SELECT COUNT(*) FROM expenses WHERE status = 'pending')::int AS pending_expenses,
  (SELECT COUNT(*) FROM invoices WHERE status = 'pending')::int AS pending_invoices,
  (
    (SELECT COUNT(*) FROM expenses WHERE status = 'pending') +
    (SELECT COUNT(*) FROM invoices WHERE status = 'pending')
  )::int                                                         AS total_pending;

-- ============================================================
--  15. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_expenses_user     ON expenses(submitted_by);
CREATE INDEX IF NOT EXISTS idx_expenses_status   ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_date     ON expenses(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_user     ON invoices(submitted_by);
CREATE INDEX IF NOT EXISTS idx_invoices_status   ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_exp_items         ON expense_line_items(expense_id);
CREATE INDEX IF NOT EXISTS idx_inv_items         ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_perms_user        ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_user        ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_user        ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity      ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_media_entity      ON media_uploads(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_assets_status     ON assets(status);
CREATE INDEX IF NOT EXISTS idx_liabilities_status ON liabilities(status);
CREATE INDEX IF NOT EXISTS idx_investments_status ON investments(status);

-- ============================================================
--  16. SEED DATA
-- ============================================================
INSERT INTO expense_categories (name, code) VALUES
  ('Materials & Supplies',  'MAT'),
  ('Labour & Wages',        'LAB'),
  ('Equipment & Tools',     'EQP'),
  ('Transport & Fuel',      'TRN'),
  ('Utilities',             'UTL'),
  ('Office & Admin',        'OFC'),
  ('Maintenance & Repairs', 'MNT'),
  ('Safety & PPE',          'SAF'),
  ('Miscellaneous',         'MSC')
ON CONFLICT DO NOTHING;

-- Default superuser  (password: Admin@12345 — CHANGE AFTER FIRST LOGIN)
INSERT INTO users (username, email, password_hash, full_name, role)
VALUES (
  'admin',
  'admin@alpha-ultimate.com',
  encode(digest('Admin@12345', 'sha256'), 'hex'),
  'System Administrator',
  'superuser'
)
ON CONFLICT (username) DO NOTHING;

INSERT INTO user_permissions (user_id, module, access_level)
SELECT u.id, m.module, 'superuser'
FROM users u,
     (VALUES
       ('finance'),('users'),('bookings'),('content'),
       ('reports'),('media'),('settings'),
       ('assets'),('liabilities'),('investments'),('approvals')
     ) AS m(module)
WHERE u.username = 'admin'
ON CONFLICT (user_id, module) DO UPDATE SET access_level = 'superuser';

INSERT INTO system_settings (key, value) VALUES
  ('company_name',     '"Alpha Ultimate Ltd"'),
  ('company_cr',       '"1234567890"'),
  ('company_vat',      '"300XXXXXXXXXX003"'),
  ('company_address',  '"Riyadh, Saudi Arabia"'),
  ('default_currency', '"SAR"'),
  ('default_tax_pct',  '15'),
  ('vat_enabled',      'true')
ON CONFLICT (key) DO NOTHING;
