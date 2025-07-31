-- Create property_analysis_reports table to store AI property analysis data
CREATE TABLE IF NOT EXISTS property_analysis_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_address TEXT NOT NULL,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    analysis_data JSONB NOT NULL, -- Stores the complete analysis from OpenAI
    method TEXT NOT NULL DEFAULT 'web_search', -- Method used (web_search, assistant, etc.)
    web_searches_performed INTEGER DEFAULT 0,
    sources_found INTEGER DEFAULT 0,
    source_urls JSONB DEFAULT '[]'::jsonb, -- Array of source URLs with metadata
    confidence_score DECIMAL(3,2), -- Confidence score 0.00-1.00
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_property_analysis_reports_address ON property_analysis_reports (property_address);
CREATE INDEX IF NOT EXISTS idx_property_analysis_reports_created_at ON property_analysis_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_analysis_reports_method ON property_analysis_reports (method);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_property_analysis_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_property_analysis_reports_updated_at
    BEFORE UPDATE ON property_analysis_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_property_analysis_reports_updated_at();

-- Add RLS (Row Level Security) policies if needed
-- ALTER TABLE property_analysis_reports ENABLE ROW LEVEL SECURITY;

-- Grant permissions (adjust based on your user roles)
-- GRANT ALL ON property_analysis_reports TO authenticated;
-- GRANT SELECT ON property_analysis_reports TO anon;