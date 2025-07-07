-- Foreclosure Data Table Schema
-- This table stores all foreclosure auction data from various sources

CREATE TABLE foreclosure_data (
    id BIGSERIAL PRIMARY KEY,
    source VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    time TIME,
    pl VARCHAR(10) NOT NULL,
    firm TEXT NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    within_30min VARCHAR(1) DEFAULT 'N',
    closest_city VARCHAR(100),
    distance_miles DECIMAL(10,2),
    est_drive_time VARCHAR(20),
    geocode_method VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX idx_foreclosure_source ON foreclosure_data(source);
CREATE INDEX idx_foreclosure_date ON foreclosure_data(date);
CREATE INDEX idx_foreclosure_city ON foreclosure_data(city);
CREATE INDEX idx_foreclosure_within_30min ON foreclosure_data(within_30min);
CREATE INDEX idx_foreclosure_created_at ON foreclosure_data(created_at);

-- Composite index for common queries
CREATE INDEX idx_foreclosure_date_city ON foreclosure_data(date, city);
CREATE INDEX idx_foreclosure_within_30min_date ON foreclosure_data(within_30min, date);

-- Enable Row Level Security (RLS)
ALTER TABLE foreclosure_data ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access for all users
CREATE POLICY "Allow read access for all users" ON foreclosure_data
    FOR SELECT USING (true);

-- Create policy to allow insert/update/delete for authenticated users
CREATE POLICY "Allow full access for authenticated users" ON foreclosure_data
    FOR ALL USING (auth.role() = 'authenticated');

-- Create policy to allow service role full access
CREATE POLICY "Allow full access for service role" ON foreclosure_data
    FOR ALL USING (auth.role() = 'service_role');

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on row updates
CREATE TRIGGER update_foreclosure_data_updated_at 
    BEFORE UPDATE ON foreclosure_data 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();