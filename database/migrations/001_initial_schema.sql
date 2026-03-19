-- =====================================================
-- SolNuv Platform - Initial Database Schema
-- Run this in Supabase SQL Editor (in order)
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for fuzzy search

-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE user_type AS ENUM ('installer', 'epc', 'developer');
CREATE TYPE business_type AS ENUM ('solo', 'registered');
CREATE TYPE subscription_plan AS ENUM ('free', 'pro', 'elite', 'enterprise');
CREATE TYPE project_status AS ENUM ('active', 'decommissioned', 'recycled', 'pending_recovery');
CREATE TYPE equipment_type AS ENUM ('panel', 'battery');
CREATE TYPE equipment_condition AS ENUM ('excellent', 'good', 'fair', 'poor', 'damaged');
CREATE TYPE member_role AS ENUM ('super_admin', 'admin', 'manager');
CREATE TYPE epr_status AS ENUM ('compliant', 'pending', 'non_compliant');
CREATE TYPE recovery_status AS ENUM ('requested', 'scheduled', 'in_transit', 'completed', 'cancelled');
CREATE TYPE notification_type AS ENUM ('decommission_alert', 'recovery_update', 'report_ready', 'team_invite', 'payment');

-- =====================================================
-- COMPANIES TABLE (for registered businesses)
-- =====================================================
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  state VARCHAR(100),
  city VARCHAR(100),
  user_type user_type NOT NULL DEFAULT 'epc',
  business_type business_type NOT NULL DEFAULT 'registered',
  subscription_plan subscription_plan NOT NULL DEFAULT 'free',
  subscription_expires_at TIMESTAMPTZ,
  paystack_customer_id VARCHAR(100),
  paystack_subscription_code VARCHAR(100),
  nesrea_registration_number VARCHAR(100),
  epr_compliance_status epr_status DEFAULT 'pending',
  max_team_members INTEGER NOT NULL DEFAULT 1,
  logo_url TEXT,
  website VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supabase_uid UUID UNIQUE, -- links to Supabase auth user
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  user_type user_type NOT NULL DEFAULT 'installer',
  business_type business_type NOT NULL DEFAULT 'solo',
  brand_name VARCHAR(255), -- for solo/unregistered
  role member_role DEFAULT 'super_admin',
  avatar_url TEXT,
  is_onboarded BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TEAM INVITATIONS
-- =====================================================
CREATE TABLE team_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(id),
  email VARCHAR(255) NOT NULL,
  role member_role NOT NULL DEFAULT 'manager',
  token VARCHAR(255) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  accepted BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- PROJECTS TABLE
-- =====================================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  client_name VARCHAR(255),
  description TEXT,
  state VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  status project_status NOT NULL DEFAULT 'active',
  installation_date DATE NOT NULL,
  estimated_decommission_date DATE, -- calculated by degradation algo
  actual_decommission_date DATE,
  recycling_date DATE,
  recycler_name VARCHAR(255),
  recycler_certificate_url TEXT,
  qr_code_url TEXT,
  qr_code_data TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  total_system_size_kw DECIMAL(10, 2),
  notes TEXT,
  is_verified BOOLEAN DEFAULT FALSE, -- verified by org admin
  verified_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- EQUIPMENT TABLE (panels + batteries per project)
-- =====================================================
CREATE TABLE equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  equipment_type equipment_type NOT NULL,
  brand VARCHAR(255) NOT NULL,
  model VARCHAR(255),
  size_watts DECIMAL(10, 2), -- watts per panel, or Wh for battery
  capacity_kwh DECIMAL(10, 2), -- for batteries
  quantity INTEGER NOT NULL DEFAULT 1,
  condition equipment_condition DEFAULT 'good',
  serial_numbers TEXT[], -- array of serial numbers
  -- Calculated fields (updated by backend)
  total_panels_wattage DECIMAL(12, 2), -- size_watts * quantity
  estimated_silver_grams DECIMAL(10, 4), -- for panels only
  estimated_silver_value_ngn DECIMAL(15, 2),
  adjusted_failure_date DATE, -- West African climate adjusted
  climate_zone VARCHAR(50), -- 'coastal_humid', 'sahel_dry', 'mixed'
  degradation_factor DECIMAL(4, 3), -- multiplier (0.6 - 0.85)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- SILVER PRICE TRACKING (updated periodically)
-- =====================================================
CREATE TABLE silver_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  price_per_gram_usd DECIMAL(10, 4) NOT NULL,
  usd_to_ngn_rate DECIMAL(10, 2) NOT NULL,
  price_per_gram_ngn DECIMAL(15, 2) GENERATED ALWAYS AS (price_per_gram_usd * usd_to_ngn_rate) STORED,
  source VARCHAR(100) DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed current silver price
INSERT INTO silver_prices (price_per_gram_usd, usd_to_ngn_rate, source)
VALUES (0.96, 1620.00, 'seed');

-- =====================================================
-- RECOVERY REQUESTS
-- =====================================================
CREATE TABLE recovery_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  status recovery_status NOT NULL DEFAULT 'requested',
  preferred_date DATE,
  pickup_address TEXT,
  notes TEXT,
  assigned_recycler VARCHAR(255),
  assigned_recycler_contact VARCHAR(100),
  estimated_value_ngn DECIMAL(15, 2),
  actual_value_ngn DECIMAL(15, 2),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- NESREA REPORTS
-- =====================================================
CREATE TABLE nesrea_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  generated_by UUID NOT NULL REFERENCES users(id),
  report_period_start DATE NOT NULL,
  report_period_end DATE NOT NULL,
  total_panels INTEGER DEFAULT 0,
  total_batteries INTEGER DEFAULT 0,
  total_silver_grams DECIMAL(12, 4) DEFAULT 0,
  total_recovered_value_ngn DECIMAL(15, 2) DEFAULT 0,
  pdf_url TEXT,
  sent_to_nesrea BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  nesrea_acknowledgement_ref VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- LEADERBOARD CACHE (refreshed daily via cron)
-- =====================================================
CREATE TABLE leaderboard_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL, -- user_id or company_id
  entity_name VARCHAR(255) NOT NULL,
  entity_type VARCHAR(20) NOT NULL DEFAULT 'user', -- 'user' or 'company'
  active_projects_count INTEGER DEFAULT 0,
  decommissioned_count INTEGER DEFAULT 0,
  recycled_count INTEGER DEFAULT 0,
  total_panels INTEGER DEFAULT 0,
  total_batteries INTEGER DEFAULT 0,
  total_silver_grams DECIMAL(12, 4) DEFAULT 0,
  expected_silver_grams DECIMAL(12, 4) DEFAULT 0,
  impact_score DECIMAL(10, 2) DEFAULT 0,
  rank_active INTEGER,
  rank_recycled INTEGER,
  rank_impact INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- AUDIT LOG
-- =====================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_supabase_uid ON users(supabase_uid);
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_company_id ON projects(company_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_state ON projects(state);
CREATE INDEX idx_equipment_project_id ON equipment(project_id);
CREATE INDEX idx_equipment_type ON equipment(equipment_type);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_leaderboard_impact_score ON leaderboard_cache(impact_score DESC);

-- =====================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON equipment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recovery_requests_updated_at BEFORE UPDATE ON recovery_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) - Supabase
-- =====================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (supabase_uid = auth.uid()::uuid);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (supabase_uid = auth.uid()::uuid);

-- Projects: users see their own + company projects
CREATE POLICY "Users see own projects" ON projects FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE supabase_uid = auth.uid()::uuid)
  OR company_id IN (SELECT company_id FROM users WHERE supabase_uid = auth.uid()::uuid AND company_id IS NOT NULL)
);

-- Notifications: users see only their own
CREATE POLICY "Users see own notifications" ON notifications FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE supabase_uid = auth.uid()::uuid)
);

-- Allow service role to bypass RLS (backend)
-- The backend uses the service role key, which bypasses RLS by default in Supabase

COMMENT ON TABLE projects IS 'Core project tracking table for solar installations';
COMMENT ON TABLE equipment IS 'Individual panels and batteries within each project';
COMMENT ON TABLE silver_prices IS 'Silver spot price history for value calculations';
