-- Create contact_properties table for storing GHL contact property data
-- This ensures data persistence across devices (mobile/desktop sync)

CREATE TABLE IF NOT EXISTS contact_properties (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contact_id VARCHAR(255) NOT NULL UNIQUE, -- GHL contact ID
    properties JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of property objects
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on contact_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_contact_properties_contact_id 
ON contact_properties (contact_id);

-- Create index on updated_at for caching and sync logic
CREATE INDEX IF NOT EXISTS idx_contact_properties_updated_at 
ON contact_properties (updated_at);

-- Add RLS (Row Level Security) policies if needed
-- For now, we'll allow all operations since this is admin-only access
ALTER TABLE contact_properties ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations (can be restricted later based on auth)
CREATE POLICY "Allow all operations on contact_properties" 
ON contact_properties 
FOR ALL 
USING (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_contact_properties_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on row updates
CREATE TRIGGER trigger_update_contact_properties_updated_at
    BEFORE UPDATE ON contact_properties
    FOR EACH ROW
    EXECUTE FUNCTION update_contact_properties_updated_at();

-- Add comments for documentation
COMMENT ON TABLE contact_properties IS 'Stores property data for GHL contacts to ensure mobile/desktop sync';
COMMENT ON COLUMN contact_properties.contact_id IS 'GoHighLevel contact ID';
COMMENT ON COLUMN contact_properties.properties IS 'Array of property objects with analysis and reports';
COMMENT ON COLUMN contact_properties.created_at IS 'When this contact property record was first created';
COMMENT ON COLUMN contact_properties.updated_at IS 'When this contact property record was last modified';