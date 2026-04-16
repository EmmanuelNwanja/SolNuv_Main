-- =====================================================
-- Migration 050: SolNuv V2 Oracle Foundation
-- Chain-agnostic attestations + role-complete onboarding
-- + serial-first asset registration + escrow decision ledger.
-- =====================================================

CREATE TABLE IF NOT EXISTS v2_organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  organization_type TEXT NOT NULL,
  jurisdiction VARCHAR(8) DEFAULT 'NG',
  verification_status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS v2_org_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES v2_organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_code TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS v2_asset_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES v2_organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  equipment_type TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  lot_reference TEXT,
  model TEXT,
  brand TEXT,
  financed BOOLEAN NOT NULL DEFAULT TRUE,
  registration_source TEXT NOT NULL DEFAULT 'manual',
  registered_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (serial_number)
);

CREATE TABLE IF NOT EXISTS v2_release_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES v2_organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  escrow_account_id UUID,
  decision_type TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  failed_conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  condition_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_release_amount_ngn NUMERIC(16,2) NOT NULL DEFAULT 0,
  approved_hold_amount_ngn NUMERIC(16,2) NOT NULL DEFAULT 0,
  rationale TEXT,
  decided_by_user_id UUID REFERENCES users(id),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  chain_id TEXT,
  network_name TEXT,
  tx_hash TEXT,
  block_number BIGINT,
  contract_address TEXT,
  payload_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS v2_escrow_policy_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES v2_organizations(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  required_conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  penalty_mode TEXT NOT NULL DEFAULT 'hold',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS v2_escrow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  release_decision_id UUID NOT NULL REFERENCES v2_release_decisions(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  execution_status TEXT NOT NULL,
  external_reference TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  executed_at TIMESTAMPTZ,
  initiated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS v2_asset_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES v2_organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_unit_id UUID REFERENCES v2_asset_units(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_hash TEXT,
  actor_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_asset_units_project_id ON v2_asset_units(project_id);
CREATE INDEX IF NOT EXISTS idx_v2_asset_units_org_id ON v2_asset_units(organization_id);
CREATE INDEX IF NOT EXISTS idx_v2_release_decisions_project_id ON v2_release_decisions(project_id);
CREATE INDEX IF NOT EXISTS idx_v2_release_decisions_org_id ON v2_release_decisions(organization_id);
CREATE INDEX IF NOT EXISTS idx_v2_release_decisions_tx_hash ON v2_release_decisions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_v2_escrow_policy_templates_org_id ON v2_escrow_policy_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_v2_escrow_executions_decision_id ON v2_escrow_executions(release_decision_id);
CREATE INDEX IF NOT EXISTS idx_v2_asset_events_org_id ON v2_asset_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_v2_asset_events_project_id ON v2_asset_events(project_id);
CREATE INDEX IF NOT EXISTS idx_v2_asset_events_asset_unit_id ON v2_asset_events(asset_unit_id);

