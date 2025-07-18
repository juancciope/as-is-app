-- Add property status tracking columns
ALTER TABLE properties ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new' CHECK (status IN ('new', 'updated', 'active'));
ALTER TABLE properties ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE properties ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_in_target_counties BOOLEAN DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS sale_date_updated_count INTEGER DEFAULT 0;

-- Add columns to track distance from counties
ALTER TABLE properties ADD COLUMN IF NOT EXISTS distance_to_davidson_mi NUMERIC(10,2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS distance_to_sumner_mi NUMERIC(10,2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS distance_to_wilson_mi NUMERIC(10,2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS nearest_target_county TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS nearest_target_distance_mi NUMERIC(10,2);

-- Create property history table to track changes
CREATE TABLE IF NOT EXISTS property_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    change_type TEXT NOT NULL CHECK (change_type IN ('created', 'sale_date_changed', 'status_changed', 'enriched')),
    old_value JSONB,
    new_value JSONB,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    changed_by TEXT,
    notes TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_first_seen ON properties(first_seen_at);
CREATE INDEX IF NOT EXISTS idx_properties_last_seen ON properties(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_properties_target_counties ON properties(is_in_target_counties);
CREATE INDEX IF NOT EXISTS idx_properties_nearest_county ON properties(nearest_target_county);
CREATE INDEX IF NOT EXISTS idx_property_history_property ON property_history(property_id);
CREATE INDEX IF NOT EXISTS idx_property_history_type ON property_history(change_type);
CREATE INDEX IF NOT EXISTS idx_property_history_changed_at ON property_history(changed_at);

-- Update existing properties to set is_in_target_counties
UPDATE properties 
SET is_in_target_counties = (county IN ('Davidson', 'Sumner', 'Wilson'))
WHERE is_in_target_counties IS NULL;

-- Update existing properties to 'active' status instead of 'new'
UPDATE properties 
SET status = 'active',
    first_seen_at = COALESCE(first_seen_at, created_at, NOW()),
    last_seen_at = COALESCE(last_seen_at, updated_at, NOW())
WHERE status = 'new' AND created_at < NOW() - INTERVAL '1 hour';

-- Create a function to track property changes
CREATE OR REPLACE FUNCTION track_property_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Track sale date changes
    IF OLD.distress_events IS DISTINCT FROM NEW.distress_events THEN
        INSERT INTO property_history (
            property_id, 
            change_type, 
            old_value, 
            new_value, 
            changed_by
        ) VALUES (
            NEW.id,
            'sale_date_changed',
            jsonb_build_object('distress_events', OLD.distress_events),
            jsonb_build_object('distress_events', NEW.distress_events),
            'scraper'
        );
        
        -- Increment sale date update counter
        NEW.sale_date_updated_count = COALESCE(OLD.sale_date_updated_count, 0) + 1;
        NEW.status = 'updated';
    END IF;
    
    -- Update last_seen_at
    NEW.last_seen_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for property changes
DROP TRIGGER IF EXISTS property_changes_trigger ON properties;
CREATE TRIGGER property_changes_trigger
BEFORE UPDATE ON properties
FOR EACH ROW
EXECUTE FUNCTION track_property_changes();

-- Add sale_date column to distress_events for easier filtering
ALTER TABLE distress_events ADD COLUMN IF NOT EXISTS sale_date DATE GENERATED ALWAYS AS (event_date::DATE) STORED;
CREATE INDEX IF NOT EXISTS idx_distress_events_sale_date ON distress_events(sale_date);