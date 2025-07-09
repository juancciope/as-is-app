-- Update foreclosure_data table to use 'county' instead of 'pl'
-- This migration updates the existing table structure

-- Step 1: Add the new county column
ALTER TABLE foreclosure_data ADD COLUMN county TEXT;

-- Step 2: Copy data from pl to county (if any data exists)
UPDATE foreclosure_data SET county = pl WHERE pl IS NOT NULL;

-- Step 3: Drop the old pl column
ALTER TABLE foreclosure_data DROP COLUMN pl;

-- Step 4: Add any constraints or indexes as needed
-- (You can add these based on your requirements)

-- Optional: Add index on county for faster queries
CREATE INDEX IF NOT EXISTS idx_foreclosure_data_county ON foreclosure_data(county);