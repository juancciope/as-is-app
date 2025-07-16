-- ============================================================================
-- vNext Normalized Schema Migration
-- ============================================================================
-- This migration creates the normalized database schema for vNext foreclosure
-- scraper system, supporting multiple distress event types and relational
-- contact management while maintaining backward compatibility.
--
-- Created: 2025-07-16
-- Version: vNext v1.0
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROPERTIES TABLE
-- ============================================================================
-- Central property information with enhanced geographic data
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_address TEXT NOT NULL,
    street TEXT,
    city TEXT,
    state TEXT DEFAULT 'TN',
    zip TEXT,
    county TEXT,
    parcel_apn TEXT,
    
    -- Geographic coordinates
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    
    -- Distance calculations to target hubs
    distance_nash_mi NUMERIC(8,2),
    distance_mtjuliet_mi NUMERIC(8,2),
    within_30min_nash BOOLEAN DEFAULT FALSE,
    within_30min_mtjuliet BOOLEAN DEFAULT FALSE,
    
    -- Property characteristics
    property_type TEXT, -- SFR, Condo, 2-4, etc.
    beds INTEGER,
    baths NUMERIC(3,1),
    sqft INTEGER,
    lot_sqft INTEGER,
    
    -- Data quality
    data_confidence NUMERIC(3,2) CHECK (data_confidence >= 0 AND data_confidence <= 1),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for properties table
CREATE INDEX IF NOT EXISTS idx_properties_full_address ON properties(full_address);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_county ON properties(county);
CREATE INDEX IF NOT EXISTS idx_properties_zip ON properties(zip);
CREATE INDEX IF NOT EXISTS idx_properties_parcel_apn ON properties(parcel_apn);
CREATE INDEX IF NOT EXISTS idx_properties_coordinates ON properties(lat, lon);
CREATE INDEX IF NOT EXISTS idx_properties_distance_nash ON properties(distance_nash_mi);
CREATE INDEX IF NOT EXISTS idx_properties_distance_mtjuliet ON properties(distance_mtjuliet_mi);
CREATE INDEX IF NOT EXISTS idx_properties_within_30min_nash ON properties(within_30min_nash);
CREATE INDEX IF NOT EXISTS idx_properties_within_30min_mtjuliet ON properties(within_30min_mtjuliet);
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON properties(created_at);

-- ============================================================================
-- DISTRESS EVENTS TABLE
-- ============================================================================
-- Individual distress events (foreclosure, auction, tax lien, etc.)
CREATE TABLE IF NOT EXISTS distress_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- FORECLOSURE, AUCTION, TAX_LIEN, CODE_VIOLATION, PROBATE, etc.
    source TEXT NOT NULL,
    event_date DATE,
    event_time TEXT,
    firm TEXT,
    status TEXT DEFAULT 'active', -- active, postponed, cancelled, closed
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for distress_events table
CREATE INDEX IF NOT EXISTS idx_distress_events_property_id ON distress_events(property_id);
CREATE INDEX IF NOT EXISTS idx_distress_events_event_date ON distress_events(event_date);
CREATE INDEX IF NOT EXISTS idx_distress_events_event_type ON distress_events(event_type);
CREATE INDEX IF NOT EXISTS idx_distress_events_source ON distress_events(source);
CREATE INDEX IF NOT EXISTS idx_distress_events_status ON distress_events(status);
CREATE INDEX IF NOT EXISTS idx_distress_events_type_source ON distress_events(event_type, source);
CREATE INDEX IF NOT EXISTS idx_distress_events_created_at ON distress_events(created_at);

-- ============================================================================
-- CONTACTS TABLE
-- ============================================================================
-- Contact information with JSON arrays for flexible phone/email storage
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_first TEXT,
    name_last TEXT,
    entity_name TEXT,
    contact_type TEXT, -- individual, entity, attorney, trustee, skiptrace_result
    
    -- JSON arrays for flexible contact info
    phones JSONB DEFAULT '[]'::jsonb,
    emails JSONB DEFAULT '[]'::jsonb,
    
    mailing_address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for contacts table
CREATE INDEX IF NOT EXISTS idx_contacts_name_last ON contacts(name_last);
CREATE INDEX IF NOT EXISTS idx_contacts_name_first ON contacts(name_first);
CREATE INDEX IF NOT EXISTS idx_contacts_entity_name ON contacts(entity_name);
CREATE INDEX IF NOT EXISTS idx_contacts_contact_type ON contacts(contact_type);
CREATE INDEX IF NOT EXISTS idx_contacts_phones_gin ON contacts USING gin(phones);
CREATE INDEX IF NOT EXISTS idx_contacts_emails_gin ON contacts USING gin(emails);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);

-- ============================================================================
-- PROPERTY_CONTACTS TABLE
-- ============================================================================
-- Many-to-many relationship between properties and contacts
CREATE TABLE IF NOT EXISTS property_contacts (
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- owner_of_record, skiptrace, attorney, trustee
    confidence NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),
    last_validated_at TIMESTAMPTZ,
    PRIMARY KEY (property_id, contact_id, role)
);

-- Indexes for property_contacts table
CREATE INDEX IF NOT EXISTS idx_property_contacts_property_id ON property_contacts(property_id);
CREATE INDEX IF NOT EXISTS idx_property_contacts_contact_id ON property_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_property_contacts_role ON property_contacts(role);

-- ============================================================================
-- SKIP_TRACE_RUNS TABLE
-- ============================================================================
-- Audit trail for skip trace operations
CREATE TABLE IF NOT EXISTS skip_trace_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'ConnectedInvestors',
    run_at TIMESTAMPTZ DEFAULT NOW(),
    cost_cents INTEGER,
    status TEXT NOT NULL, -- success, no_match, error
    matched_contacts JSONB DEFAULT '[]'::jsonb,
    raw_log TEXT
);

-- Indexes for skip_trace_runs table
CREATE INDEX IF NOT EXISTS idx_skip_trace_runs_property_id ON skip_trace_runs(property_id);
CREATE INDEX IF NOT EXISTS idx_skip_trace_runs_provider ON skip_trace_runs(provider);
CREATE INDEX IF NOT EXISTS idx_skip_trace_runs_run_at ON skip_trace_runs(run_at);
CREATE INDEX IF NOT EXISTS idx_skip_trace_runs_status ON skip_trace_runs(status);

-- ============================================================================
-- LEAD_PIPELINE TABLE
-- ============================================================================
-- Sales pipeline stage tracking
CREATE TABLE IF NOT EXISTS lead_pipeline (
    property_id UUID PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
    stage TEXT NOT NULL DEFAULT 'new', -- new, needs_skiptrace, enriched, contact_attempted, negotiating, under_contract, closed, dead
    last_stage_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_to TEXT
);

-- Indexes for lead_pipeline table
CREATE INDEX IF NOT EXISTS idx_lead_pipeline_stage ON lead_pipeline(stage);
CREATE INDEX IF NOT EXISTS idx_lead_pipeline_last_stage_at ON lead_pipeline(last_stage_at);
CREATE INDEX IF NOT EXISTS idx_lead_pipeline_assigned_to ON lead_pipeline(assigned_to);

-- ============================================================================
-- INVESTOR_RULES TABLE
-- ============================================================================
-- Configurable buy box rules (single row for now)
CREATE TABLE IF NOT EXISTS investor_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    config JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for investor_rules table
CREATE INDEX IF NOT EXISTS idx_investor_rules_label ON investor_rules(label);

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with updated_at columns
DROP TRIGGER IF EXISTS update_properties_updated_at ON properties;
CREATE TRIGGER update_properties_updated_at
    BEFORE UPDATE ON properties
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_investor_rules_updated_at ON investor_rules;
CREATE TRIGGER update_investor_rules_updated_at
    BEFORE UPDATE ON investor_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Enable RLS on all tables
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE distress_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE skip_trace_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_rules ENABLE ROW LEVEL SECURITY;

-- Properties table policies
DROP POLICY IF EXISTS "properties_read_all" ON properties;
CREATE POLICY "properties_read_all" ON properties
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "properties_full_access_auth" ON properties;
CREATE POLICY "properties_full_access_auth" ON properties
    FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "properties_full_access_service" ON properties;
CREATE POLICY "properties_full_access_service" ON properties
    FOR ALL USING (auth.role() = 'service_role');

-- Distress events table policies
DROP POLICY IF EXISTS "distress_events_read_all" ON distress_events;
CREATE POLICY "distress_events_read_all" ON distress_events
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "distress_events_full_access_auth" ON distress_events;
CREATE POLICY "distress_events_full_access_auth" ON distress_events
    FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "distress_events_full_access_service" ON distress_events;
CREATE POLICY "distress_events_full_access_service" ON distress_events
    FOR ALL USING (auth.role() = 'service_role');

-- Contacts table policies
DROP POLICY IF EXISTS "contacts_read_all" ON contacts;
CREATE POLICY "contacts_read_all" ON contacts
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "contacts_full_access_auth" ON contacts;
CREATE POLICY "contacts_full_access_auth" ON contacts
    FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "contacts_full_access_service" ON contacts;
CREATE POLICY "contacts_full_access_service" ON contacts
    FOR ALL USING (auth.role() = 'service_role');

-- Property contacts table policies
DROP POLICY IF EXISTS "property_contacts_read_all" ON property_contacts;
CREATE POLICY "property_contacts_read_all" ON property_contacts
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "property_contacts_full_access_auth" ON property_contacts;
CREATE POLICY "property_contacts_full_access_auth" ON property_contacts
    FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "property_contacts_full_access_service" ON property_contacts;
CREATE POLICY "property_contacts_full_access_service" ON property_contacts
    FOR ALL USING (auth.role() = 'service_role');

-- Skip trace runs table policies
DROP POLICY IF EXISTS "skip_trace_runs_read_all" ON skip_trace_runs;
CREATE POLICY "skip_trace_runs_read_all" ON skip_trace_runs
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "skip_trace_runs_full_access_auth" ON skip_trace_runs;
CREATE POLICY "skip_trace_runs_full_access_auth" ON skip_trace_runs
    FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "skip_trace_runs_full_access_service" ON skip_trace_runs;
CREATE POLICY "skip_trace_runs_full_access_service" ON skip_trace_runs
    FOR ALL USING (auth.role() = 'service_role');

-- Lead pipeline table policies
DROP POLICY IF EXISTS "lead_pipeline_read_all" ON lead_pipeline;
CREATE POLICY "lead_pipeline_read_all" ON lead_pipeline
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "lead_pipeline_full_access_auth" ON lead_pipeline;
CREATE POLICY "lead_pipeline_full_access_auth" ON lead_pipeline
    FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "lead_pipeline_full_access_service" ON lead_pipeline;
CREATE POLICY "lead_pipeline_full_access_service" ON lead_pipeline
    FOR ALL USING (auth.role() = 'service_role');

-- Investor rules table policies
DROP POLICY IF EXISTS "investor_rules_read_all" ON investor_rules;
CREATE POLICY "investor_rules_read_all" ON investor_rules
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "investor_rules_full_access_auth" ON investor_rules;
CREATE POLICY "investor_rules_full_access_auth" ON investor_rules
    FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "investor_rules_full_access_service" ON investor_rules;
CREATE POLICY "investor_rules_full_access_service" ON investor_rules
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- COMPATIBILITY VIEW
-- ============================================================================
-- Create a view that maps the legacy foreclosure_properties table name
-- to the existing foreclosure_data table for backward compatibility
CREATE OR REPLACE VIEW foreclosure_properties AS
SELECT * FROM foreclosure_data;

-- ============================================================================
-- SEED DATA
-- ============================================================================
-- Insert default investor rules configuration
INSERT INTO investor_rules (label, config) VALUES (
    'Default Buy Box',
    '{
        "target_counties": ["Davidson", "Sumner", "Wilson"],
        "max_drive_time_min": 30,
        "max_distance_mi": 30,
        "property_types": ["SFR"],
        "price_min": 0,
        "price_max": 9999999,
        "min_beds": 2,
        "min_baths": 1,
        "max_year_built": 2025,
        "min_year_built": 1900,
        "exclude_flood_zones": true,
        "max_days_on_market": 90,
        "scoring_weights": {
            "county_match": 20,
            "drive_time_nash": 15,
            "drive_time_mtjuliet": 15,
            "days_to_event_urgent": 25,
            "days_to_event_soon": 15,
            "days_to_event_moderate": 5,
            "has_contact": 10,
            "property_type_match": 5
        }
    }'::jsonb
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- HELPFUL FUNCTIONS
-- ============================================================================

-- Function to normalize addresses for deduplication
CREATE OR REPLACE FUNCTION normalize_address(address_text TEXT)
RETURNS TEXT AS $$
BEGIN
    IF address_text IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Convert to lowercase, remove extra spaces, and basic punctuation
    RETURN LOWER(
        TRIM(
            REGEXP_REPLACE(
                REGEXP_REPLACE(address_text, '[^\w\s]', '', 'g'), 
                '\s+', ' ', 'g'
            )
        )
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate distance between two points (Haversine formula)
CREATE OR REPLACE FUNCTION calculate_distance_miles(
    lat1 DOUBLE PRECISION, 
    lon1 DOUBLE PRECISION, 
    lat2 DOUBLE PRECISION, 
    lon2 DOUBLE PRECISION
)
RETURNS NUMERIC AS $$
DECLARE
    r CONSTANT DOUBLE PRECISION := 3959; -- Earth's radius in miles
    dlat DOUBLE PRECISION;
    dlon DOUBLE PRECISION;
    a DOUBLE PRECISION;
    c DOUBLE PRECISION;
BEGIN
    IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
        RETURN NULL;
    END IF;
    
    dlat := RADIANS(lat2 - lat1);
    dlon := RADIANS(lon2 - lon1);
    
    a := SIN(dlat/2) * SIN(dlat/2) + COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * SIN(dlon/2) * SIN(dlon/2);
    c := 2 * ATAN2(SQRT(a), SQRT(1-a));
    
    RETURN ROUND((r * c)::NUMERIC, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to estimate drive time from distance
CREATE OR REPLACE FUNCTION estimate_drive_time_minutes(distance_miles NUMERIC)
RETURNS INTEGER AS $$
BEGIN
    IF distance_miles IS NULL OR distance_miles < 0 THEN
        RETURN NULL;
    END IF;
    
    -- Estimate based on distance ranges
    CASE 
        WHEN distance_miles <= 5 THEN
            RETURN ROUND((distance_miles / 25.0) * 60); -- City driving ~25 mph
        WHEN distance_miles <= 15 THEN
            RETURN ROUND((distance_miles / 35.0) * 60); -- Suburban ~35 mph
        WHEN distance_miles <= 30 THEN
            RETURN ROUND((distance_miles / 45.0) * 60); -- Mixed ~45 mph
        ELSE
            RETURN ROUND((distance_miles / 55.0) * 60); -- Highway ~55 mph
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE properties IS 'Central property information with enhanced geographic data';
COMMENT ON TABLE distress_events IS 'Individual distress events (foreclosure, auction, tax lien, etc.)';
COMMENT ON TABLE contacts IS 'Contact information with JSON arrays for flexible phone/email storage';
COMMENT ON TABLE property_contacts IS 'Many-to-many relationship between properties and contacts';
COMMENT ON TABLE skip_trace_runs IS 'Audit trail for skip trace operations';
COMMENT ON TABLE lead_pipeline IS 'Sales pipeline stage tracking';
COMMENT ON TABLE investor_rules IS 'Configurable buy box rules';

COMMENT ON COLUMN properties.full_address IS 'Complete address string for display and matching';
COMMENT ON COLUMN properties.distance_nash_mi IS 'Distance in miles to Nashville hub';
COMMENT ON COLUMN properties.distance_mtjuliet_mi IS 'Distance in miles to Mt. Juliet hub';
COMMENT ON COLUMN properties.within_30min_nash IS 'Property is within 30 minutes drive time of Nashville';
COMMENT ON COLUMN properties.within_30min_mtjuliet IS 'Property is within 30 minutes drive time of Mt. Juliet';
COMMENT ON COLUMN properties.data_confidence IS 'Confidence score for property data quality (0-1)';

COMMENT ON COLUMN distress_events.event_type IS 'Type of distress event (FORECLOSURE, AUCTION, TAX_LIEN, etc.)';
COMMENT ON COLUMN distress_events.status IS 'Current status: active, postponed, cancelled, closed';
COMMENT ON COLUMN distress_events.raw_data IS 'Original data from source in JSON format';

COMMENT ON COLUMN contacts.phones IS 'Array of phone numbers with metadata: [{"number":"555-1234","label":"home","verified":false,"source":"ci"}]';
COMMENT ON COLUMN contacts.emails IS 'Array of email addresses with metadata: [{"email":"test@example.com","label":"primary","verified":false,"source":"ci"}]';
COMMENT ON COLUMN contacts.contact_type IS 'Type of contact: individual, entity, attorney, trustee, skiptrace_result';

COMMENT ON COLUMN property_contacts.role IS 'Relationship role: owner_of_record, skiptrace, attorney, trustee';
COMMENT ON COLUMN property_contacts.confidence IS 'Confidence score for this contact relationship (0-1)';

COMMENT ON COLUMN skip_trace_runs.provider IS 'Skip trace service provider (ConnectedInvestors, etc.)';
COMMENT ON COLUMN skip_trace_runs.status IS 'Run status: success, no_match, error';
COMMENT ON COLUMN skip_trace_runs.matched_contacts IS 'Array of matched contact IDs with confidence scores';

COMMENT ON COLUMN lead_pipeline.stage IS 'Pipeline stage: new, needs_skiptrace, enriched, contact_attempted, negotiating, under_contract, closed, dead';

COMMENT ON COLUMN investor_rules.config IS 'JSON configuration for buy box rules and scoring weights';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- This migration creates the complete vNext normalized schema with:
-- ✓ Properties table with enhanced geographic data
-- ✓ Distress events table (future-proofed for multiple event types)
-- ✓ Contacts table with JSON arrays for flexible contact storage
-- ✓ Property-contacts relationship table
-- ✓ Skip trace audit trail
-- ✓ Lead pipeline tracking
-- ✓ Configurable investor rules
-- ✓ All necessary indexes for performance
-- ✓ RLS policies mirroring legacy table
-- ✓ Updated_at triggers
-- ✓ Helper functions for address normalization and distance calculation
-- ✓ Comprehensive documentation
-- ✓ Backward compatibility view
-- ✓ Default configuration seed data
-- ============================================================================