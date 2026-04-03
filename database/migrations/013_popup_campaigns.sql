-- ============================================================
-- Migration 013: Popup Ad Campaigns
-- Groups multiple popup ads under a campaign with trigger settings
-- ============================================================

CREATE TABLE IF NOT EXISTS popup_campaigns (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title            text NOT NULL,
  is_active        boolean NOT NULL DEFAULT true,
  show_on_login    boolean NOT NULL DEFAULT true,
  show_on_interval boolean NOT NULL DEFAULT false,
  interval_minutes int,  -- ignored when show_on_interval is false
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Link existing popup ads to a campaign and set their carousel order
ALTER TABLE ads ADD COLUMN IF NOT EXISTS campaign_id   uuid REFERENCES popup_campaigns(id) ON DELETE SET NULL;
ALTER TABLE ads ADD COLUMN IF NOT EXISTS display_order smallint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ads_campaign ON ads (campaign_id, display_order);

ALTER TABLE popup_campaigns ENABLE ROW LEVEL SECURITY;
-- Only service role (backend) interacts with this table
