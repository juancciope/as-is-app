-- Supabase table schema for TN Ledger foreclosure data
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS tn_ledger_foreclosures (
    id SERIAL PRIMARY KEY,
    
    -- List page data
    borrower_list TEXT,
    property_address_list TEXT,
    advertised_auction_date_list TEXT,
    date_of_first_notice_list TEXT,
    details_url TEXT UNIQUE NOT NULL,
    
    -- Detail page data
    borrower_detail TEXT,
    address_detail TEXT,
    original_trustee TEXT,
    attorney TEXT,
    instrument_no TEXT,
    substitute_trustee TEXT,
    advertised_auction_date_detail TEXT,
    date_of_first_public_notice_detail TEXT,
    trust_date TEXT,
    tdn_no TEXT,
    sale_details_text TEXT,
    
    -- Parsed auction details
    auction_time TEXT,
    auction_location TEXT,
    auction_address TEXT,
    
    -- Geolocation data
    property_lat DECIMAL(10, 8),
    property_lng DECIMAL(11, 8),
    property_formatted_address TEXT,
    auction_lat DECIMAL(10, 8),
    auction_lng DECIMAL(11, 8),
    auction_formatted_address TEXT,
    
    -- Metadata
    notice_date TEXT,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_tn_ledger_foreclosures_notice_date ON tn_ledger_foreclosures(notice_date);
CREATE INDEX idx_tn_ledger_foreclosures_auction_date ON tn_ledger_foreclosures(advertised_auction_date_detail);
CREATE INDEX idx_tn_ledger_foreclosures_borrower ON tn_ledger_foreclosures(borrower_detail);
CREATE INDEX idx_tn_ledger_foreclosures_property_location ON tn_ledger_foreclosures(property_lat, property_lng);

-- Enable Row Level Security
ALTER TABLE tn_ledger_foreclosures ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows authenticated users to read all data
CREATE POLICY "Allow authenticated read access" ON tn_ledger_foreclosures
    FOR SELECT TO authenticated USING (true);

-- Create a policy that allows service role to insert/update
CREATE POLICY "Allow service role write access" ON tn_ledger_foreclosures
    FOR ALL TO service_role USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tn_ledger_foreclosures_updated_at
    BEFORE UPDATE ON tn_ledger_foreclosures
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();