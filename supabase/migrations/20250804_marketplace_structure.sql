-- ============================================================================
-- Marketplace Structure Migration
-- ============================================================================
-- This migration adds support for the new application structure:
-- - Probates
-- - Auctions  
-- - Marketplace (centralized property database)
-- - Enhanced lead sources
-- ============================================================================

-- ============================================================================
-- ENHANCE DISTRESS EVENTS FOR NEW SOURCES
-- ============================================================================
-- Add new event types to support all marketplace sources
COMMENT ON COLUMN distress_events.event_type IS 'Type of distress event: FORECLOSURE, AUCTION, TAX_LIEN, PROBATE, DIVORCE, IMMIGRATION, PAWN_SHOP, CPA, BAIL, CODE_VIOLATION, BANKRUPTCY';

-- Add new status values
COMMENT ON COLUMN distress_events.status IS 'Current status: active, pending, sold, withdrawn, postponed, cancelled, closed';

-- ============================================================================
-- PROBATE EVENTS TABLE
-- ============================================================================
-- Specialized table for probate-specific data
CREATE TABLE IF NOT EXISTS probate_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    case_number TEXT,
    court_name TEXT,
    filing_date DATE,
    probate_type TEXT, -- testate, intestate, small_estate
    estate_value NUMERIC(12,2),
    executor_name TEXT,
    attorney_name TEXT,
    attorney_firm TEXT,
    hearing_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for probate_events
CREATE INDEX IF NOT EXISTS idx_probate_events_property_id ON probate_events(property_id);
CREATE INDEX IF NOT EXISTS idx_probate_events_case_number ON probate_events(case_number);
CREATE INDEX IF NOT EXISTS idx_probate_events_filing_date ON probate_events(filing_date);
CREATE INDEX IF NOT EXISTS idx_probate_events_hearing_date ON probate_events(hearing_date);

-- ============================================================================
-- AUCTION EVENTS TABLE
-- ============================================================================
-- Specialized table for auction-specific data
CREATE TABLE IF NOT EXISTS auction_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    auction_date DATE,
    auction_time TIME,
    auction_location TEXT,
    auction_type TEXT, -- foreclosure, tax_lien, estate, bankruptcy
    minimum_bid NUMERIC(12,2),
    opening_bid NUMERIC(12,2),
    final_bid NUMERIC(12,2),
    winning_bidder TEXT,
    auctioneer TEXT,
    terms TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for auction_events
CREATE INDEX IF NOT EXISTS idx_auction_events_property_id ON auction_events(property_id);
CREATE INDEX IF NOT EXISTS idx_auction_events_auction_date ON auction_events(auction_date);
CREATE INDEX IF NOT EXISTS idx_auction_events_auction_type ON auction_events(auction_type);

-- ============================================================================
-- COMPELLING EVENTS TABLE
-- ============================================================================
-- Track compelling events that create investment opportunities
CREATE TABLE IF NOT EXISTS compelling_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    event_source TEXT NOT NULL, -- probate, divorce, immigration, pawn_shop, cpa, bail, etc.
    compelling_reason TEXT NOT NULL, -- description of why this is an opportunity
    urgency_level TEXT DEFAULT 'medium', -- low, medium, high, critical
    motivation_score INTEGER CHECK (motivation_score >= 1 AND motivation_score <= 10),
    time_sensitivity_days INTEGER, -- how many days until opportunity expires
    estimated_discount_percent NUMERIC(5,2), -- expected discount from market value
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for compelling_events
CREATE INDEX IF NOT EXISTS idx_compelling_events_property_id ON compelling_events(property_id);
CREATE INDEX IF NOT EXISTS idx_compelling_events_contact_id ON compelling_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_compelling_events_event_source ON compelling_events(event_source);
CREATE INDEX IF NOT EXISTS idx_compelling_events_urgency_level ON compelling_events(urgency_level);
CREATE INDEX IF NOT EXISTS idx_compelling_events_motivation_score ON compelling_events(motivation_score);

-- ============================================================================
-- PROPERTY VALUATION TABLE
-- ============================================================================
-- Track property valuations from different sources
CREATE TABLE IF NOT EXISTS property_valuations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    valuation_source TEXT NOT NULL, -- zillow, realtor, appraisal, bpo, manual
    estimated_value NUMERIC(12,2),
    valuation_date DATE DEFAULT CURRENT_DATE,
    confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for property_valuations
CREATE INDEX IF NOT EXISTS idx_property_valuations_property_id ON property_valuations(property_id);
CREATE INDEX IF NOT EXISTS idx_property_valuations_source ON property_valuations(valuation_source);
CREATE INDEX IF NOT EXISTS idx_property_valuations_date ON property_valuations(valuation_date);

-- ============================================================================
-- LEAD SCORING TABLE
-- ============================================================================
-- Track calculated lead scores for properties
CREATE TABLE IF NOT EXISTS lead_scores (
    property_id UUID PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
    total_score INTEGER NOT NULL DEFAULT 0,
    location_score INTEGER DEFAULT 0,
    urgency_score INTEGER DEFAULT 0,
    motivation_score INTEGER DEFAULT 0,
    property_score INTEGER DEFAULT 0,
    contact_score INTEGER DEFAULT 0,
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lead_scores
CREATE INDEX IF NOT EXISTS idx_lead_scores_total_score ON lead_scores(total_score);
CREATE INDEX IF NOT EXISTS idx_lead_scores_calculated_at ON lead_scores(calculated_at);

-- ============================================================================
-- USER SETTINGS TABLE
-- ============================================================================
-- Store user preferences and settings
CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    company TEXT,
    notification_preferences JSONB DEFAULT '{
        "email_new_leads": true,
        "email_high_urgency": true,
        "email_weekly_summary": true,
        "sms_critical_alerts": false
    }'::jsonb,
    dashboard_preferences JSONB DEFAULT '{
        "default_time_range": "30d",
        "favorite_sources": ["probate", "auction"],
        "hide_low_motivation": false
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ENHANCED LEAD PIPELINE
-- ============================================================================
-- Add new pipeline stages for the marketplace structure
COMMENT ON COLUMN lead_pipeline.stage IS 'Pipeline stage: new, qualified, contacted, interested, negotiating, under_contract, closed_won, closed_lost, on_hold';

-- Add marketplace-specific columns to lead_pipeline
ALTER TABLE lead_pipeline ADD COLUMN IF NOT EXISTS lead_source TEXT;
ALTER TABLE lead_pipeline ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium'; -- low, medium, high, critical
ALTER TABLE lead_pipeline ADD COLUMN IF NOT EXISTS expected_close_date DATE;
ALTER TABLE lead_pipeline ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_lead_pipeline_lead_source ON lead_pipeline(lead_source);
CREATE INDEX IF NOT EXISTS idx_lead_pipeline_priority ON lead_pipeline(priority);
CREATE INDEX IF NOT EXISTS idx_lead_pipeline_expected_close_date ON lead_pipeline(expected_close_date);

-- ============================================================================
-- UPDATED_AT TRIGGERS FOR NEW TABLES
-- ============================================================================
-- Apply updated_at triggers to new tables
DROP TRIGGER IF EXISTS update_probate_events_updated_at ON probate_events;
CREATE TRIGGER update_probate_events_updated_at
    BEFORE UPDATE ON probate_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_auction_events_updated_at ON auction_events;
CREATE TRIGGER update_auction_events_updated_at
    BEFORE UPDATE ON auction_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_compelling_events_updated_at ON compelling_events;
CREATE TRIGGER update_compelling_events_updated_at
    BEFORE UPDATE ON compelling_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lead_scores_updated_at ON lead_scores;
CREATE TRIGGER update_lead_scores_updated_at
    BEFORE UPDATE ON lead_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR NEW TABLES
-- ============================================================================
-- Enable RLS on new tables
ALTER TABLE probate_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE compelling_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Probate events policies
DROP POLICY IF EXISTS "probate_events_read_all" ON probate_events;
CREATE POLICY "probate_events_read_all" ON probate_events
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "probate_events_full_access_auth" ON probate_events;
CREATE POLICY "probate_events_full_access_auth" ON probate_events
    FOR ALL USING (auth.role() = 'authenticated');

-- Auction events policies
DROP POLICY IF EXISTS "auction_events_read_all" ON auction_events;
CREATE POLICY "auction_events_read_all" ON auction_events
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "auction_events_full_access_auth" ON auction_events;
CREATE POLICY "auction_events_full_access_auth" ON auction_events
    FOR ALL USING (auth.role() = 'authenticated');

-- Compelling events policies
DROP POLICY IF EXISTS "compelling_events_read_all" ON compelling_events;
CREATE POLICY "compelling_events_read_all" ON compelling_events
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "compelling_events_full_access_auth" ON compelling_events;
CREATE POLICY "compelling_events_full_access_auth" ON compelling_events
    FOR ALL USING (auth.role() = 'authenticated');

-- Property valuations policies
DROP POLICY IF EXISTS "property_valuations_read_all" ON property_valuations;
CREATE POLICY "property_valuations_read_all" ON property_valuations
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "property_valuations_full_access_auth" ON property_valuations;
CREATE POLICY "property_valuations_full_access_auth" ON property_valuations
    FOR ALL USING (auth.role() = 'authenticated');

-- Lead scores policies
DROP POLICY IF EXISTS "lead_scores_read_all" ON lead_scores;
CREATE POLICY "lead_scores_read_all" ON lead_scores
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "lead_scores_full_access_auth" ON lead_scores;
CREATE POLICY "lead_scores_full_access_auth" ON lead_scores
    FOR ALL USING (auth.role() = 'authenticated');

-- User settings policies (user can only access their own settings)
DROP POLICY IF EXISTS "user_settings_own_data" ON user_settings;
CREATE POLICY "user_settings_own_data" ON user_settings
    FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- HELPFUL VIEWS
-- ============================================================================
-- Create views for easy data access in the new application structure

-- Probate properties view
CREATE OR REPLACE VIEW probate_properties_view AS
SELECT 
    p.*,
    pe.case_number,
    pe.filing_date,
    pe.probate_type,
    pe.estate_value,
    pe.executor_name,
    pe.hearing_date,
    c.name_first || ' ' || c.name_last as owner_name,
    c.phones,
    c.emails,
    ce.compelling_reason,
    ce.urgency_level,
    ce.motivation_score,
    ls.total_score
FROM properties p
JOIN probate_events pe ON p.id = pe.property_id
LEFT JOIN property_contacts pc ON p.id = pc.property_id AND pc.role = 'owner_of_record'
LEFT JOIN contacts c ON pc.contact_id = c.id
LEFT JOIN compelling_events ce ON p.id = ce.property_id
LEFT JOIN lead_scores ls ON p.id = ls.property_id;

-- Auction properties view
CREATE OR REPLACE VIEW auction_properties_view AS
SELECT 
    p.*,
    ae.auction_date,
    ae.auction_time,
    ae.auction_type,
    ae.minimum_bid,
    ae.opening_bid,
    ae.final_bid,
    ae.auctioneer,
    c.name_first || ' ' || c.name_last as owner_name,
    c.phones,
    c.emails,
    ce.compelling_reason,
    ce.urgency_level,
    ce.motivation_score,
    ls.total_score
FROM properties p
JOIN auction_events ae ON p.id = ae.property_id
LEFT JOIN property_contacts pc ON p.id = pc.property_id AND pc.role = 'owner_of_record'
LEFT JOIN contacts c ON pc.contact_id = c.id
LEFT JOIN compelling_events ce ON p.id = ce.property_id
LEFT JOIN lead_scores ls ON p.id = ls.property_id;

-- Marketplace view (all properties with latest valuation)
CREATE OR REPLACE VIEW marketplace_properties_view AS
WITH latest_valuations AS (
    SELECT DISTINCT ON (property_id) 
        property_id,
        estimated_value,
        valuation_source,
        valuation_date
    FROM property_valuations 
    ORDER BY property_id, valuation_date DESC
)
SELECT 
    p.*,
    lv.estimated_value,
    lv.valuation_source,
    lv.valuation_date,
    c.name_first || ' ' || c.name_last as owner_name,
    c.phones,
    c.emails,
    ce.event_source,
    ce.compelling_reason,
    ce.urgency_level,
    ce.motivation_score,
    ce.time_sensitivity_days,
    ls.total_score,
    lp.stage as pipeline_stage,
    lp.priority
FROM properties p
LEFT JOIN latest_valuations lv ON p.id = lv.property_id
LEFT JOIN property_contacts pc ON p.id = pc.property_id AND pc.role = 'owner_of_record'
LEFT JOIN contacts c ON pc.contact_id = c.id
LEFT JOIN compelling_events ce ON p.id = ce.property_id
LEFT JOIN lead_scores ls ON p.id = ls.property_id
LEFT JOIN lead_pipeline lp ON p.id = lp.property_id;

-- ============================================================================
-- SEED DATA FOR NEW STRUCTURE
-- ============================================================================
-- Insert sample compelling event sources
INSERT INTO investor_rules (label, config) VALUES (
    'Marketplace Sources',
    '{
        "compelling_event_sources": [
            {"source": "probate", "weight": 25, "avg_motivation": 7},
            {"source": "divorce", "weight": 20, "avg_motivation": 8},
            {"source": "immigration", "weight": 22, "avg_motivation": 9},
            {"source": "pawn_shop", "weight": 15, "avg_motivation": 6},
            {"source": "cpa", "weight": 10, "avg_motivation": 5},
            {"source": "bail", "weight": 18, "avg_motivation": 8},
            {"source": "auction", "weight": 20, "avg_motivation": 6}
        ],
        "urgency_multipliers": {
            "critical": 2.0,
            "high": 1.5,
            "medium": 1.0,
            "low": 0.7
        }
    }'::jsonb
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMMENTS FOR NEW TABLES
-- ============================================================================
COMMENT ON TABLE probate_events IS 'Specialized data for probate proceedings';
COMMENT ON TABLE auction_events IS 'Specialized data for property auctions';
COMMENT ON TABLE compelling_events IS 'Events that create investment opportunities';
COMMENT ON TABLE property_valuations IS 'Property value estimates from multiple sources';
COMMENT ON TABLE lead_scores IS 'Calculated lead scores for prioritization';  
COMMENT ON TABLE user_settings IS 'User preferences and configuration';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- This migration adds support for:
-- ✓ Probate-specific tracking
-- ✓ Auction-specific tracking
-- ✓ Compelling events system
-- ✓ Property valuations
-- ✓ Lead scoring system
-- ✓ User settings
-- ✓ Enhanced lead pipeline
-- ✓ Convenient views for each section
-- ✓ Proper RLS policies
-- ✓ Seed data for configuration
-- ============================================================================