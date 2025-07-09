-- Add contact information fields to foreclosure_data table
-- Run this SQL in your Supabase SQL editor if these fields don't exist

-- Add owner contact fields
ALTER TABLE foreclosure_data 
ADD COLUMN IF NOT EXISTS owner_emails TEXT,
ADD COLUMN IF NOT EXISTS owner_phones TEXT,
ADD COLUMN IF NOT EXISTS owner_info TEXT,
ADD COLUMN IF NOT EXISTS skip_trace JSONB;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_foreclosure_data_owner_emails ON foreclosure_data(owner_emails);
CREATE INDEX IF NOT EXISTS idx_foreclosure_data_owner_phones ON foreclosure_data(owner_phones);
CREATE INDEX IF NOT EXISTS idx_foreclosure_data_skip_trace ON foreclosure_data USING GIN(skip_trace);

-- Add index for enrichment queries (properties without contact info)
CREATE INDEX IF NOT EXISTS idx_foreclosure_data_needs_enrichment 
ON foreclosure_data(created_at) 
WHERE owner_emails IS NULL AND owner_phones IS NULL;

-- Create a view for enriched properties
CREATE OR REPLACE VIEW enriched_foreclosure_data AS
SELECT 
    *,
    CASE 
        WHEN owner_emails IS NOT NULL OR owner_phones IS NOT NULL THEN true
        ELSE false
    END as is_enriched,
    CASE 
        WHEN owner_emails IS NOT NULL THEN string_to_array(owner_emails, ',')
        ELSE ARRAY[]::text[]
    END as emails_array,
    CASE 
        WHEN owner_phones IS NOT NULL THEN string_to_array(owner_phones, ',')
        ELSE ARRAY[]::text[]
    END as phones_array,
    CASE 
        WHEN owner_info IS NOT NULL THEN string_to_array(owner_info, ' | ')
        ELSE ARRAY[]::text[]
    END as owners_array
FROM foreclosure_data;

-- Create a function to get enrichment statistics
CREATE OR REPLACE FUNCTION get_enrichment_stats()
RETURNS TABLE(
    total_properties BIGINT,
    enriched_properties BIGINT,
    enrichment_percentage NUMERIC,
    properties_with_emails BIGINT,
    properties_with_phones BIGINT,
    recent_enrichments BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_properties,
        COUNT(*) FILTER (WHERE owner_emails IS NOT NULL OR owner_phones IS NOT NULL) as enriched_properties,
        ROUND(
            (COUNT(*) FILTER (WHERE owner_emails IS NOT NULL OR owner_phones IS NOT NULL) * 100.0) / 
            NULLIF(COUNT(*), 0), 2
        ) as enrichment_percentage,
        COUNT(*) FILTER (WHERE owner_emails IS NOT NULL AND owner_emails != '') as properties_with_emails,
        COUNT(*) FILTER (WHERE owner_phones IS NOT NULL AND owner_phones != '') as properties_with_phones,
        COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '24 hours' AND 
                              (owner_emails IS NOT NULL OR owner_phones IS NOT NULL)) as recent_enrichments
    FROM foreclosure_data;
END;
$$ LANGUAGE plpgsql;

-- Example usage:
-- SELECT * FROM get_enrichment_stats();