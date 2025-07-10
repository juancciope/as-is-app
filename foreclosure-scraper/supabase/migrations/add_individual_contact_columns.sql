-- Add individual email columns (up to 5)
ALTER TABLE foreclosure_data
ADD COLUMN IF NOT EXISTS owner_email_1 TEXT,
ADD COLUMN IF NOT EXISTS owner_email_2 TEXT,
ADD COLUMN IF NOT EXISTS owner_email_3 TEXT,
ADD COLUMN IF NOT EXISTS owner_email_4 TEXT,
ADD COLUMN IF NOT EXISTS owner_email_5 TEXT;

-- Add individual phone columns (up to 5)
ALTER TABLE foreclosure_data
ADD COLUMN IF NOT EXISTS owner_phone_1 TEXT,
ADD COLUMN IF NOT EXISTS owner_phone_2 TEXT,
ADD COLUMN IF NOT EXISTS owner_phone_3 TEXT,
ADD COLUMN IF NOT EXISTS owner_phone_4 TEXT,
ADD COLUMN IF NOT EXISTS owner_phone_5 TEXT;

-- Add owner name columns (up to 2 owners)
ALTER TABLE foreclosure_data
ADD COLUMN IF NOT EXISTS owner_1_first_name TEXT,
ADD COLUMN IF NOT EXISTS owner_1_last_name TEXT,
ADD COLUMN IF NOT EXISTS owner_2_first_name TEXT,
ADD COLUMN IF NOT EXISTS owner_2_last_name TEXT;

-- Create indexes for the new columns to improve search performance
CREATE INDEX IF NOT EXISTS idx_owner_email_1 ON foreclosure_data(owner_email_1);
CREATE INDEX IF NOT EXISTS idx_owner_phone_1 ON foreclosure_data(owner_phone_1);
CREATE INDEX IF NOT EXISTS idx_owner_1_last_name ON foreclosure_data(owner_1_last_name);
CREATE INDEX IF NOT EXISTS idx_owner_2_last_name ON foreclosure_data(owner_2_last_name);

-- Add comments to document the columns
COMMENT ON COLUMN foreclosure_data.owner_email_1 IS 'Primary owner email address';
COMMENT ON COLUMN foreclosure_data.owner_email_2 IS 'Secondary owner email address';
COMMENT ON COLUMN foreclosure_data.owner_email_3 IS 'Third owner email address';
COMMENT ON COLUMN foreclosure_data.owner_email_4 IS 'Fourth owner email address';
COMMENT ON COLUMN foreclosure_data.owner_email_5 IS 'Fifth owner email address';

COMMENT ON COLUMN foreclosure_data.owner_phone_1 IS 'Primary owner phone number';
COMMENT ON COLUMN foreclosure_data.owner_phone_2 IS 'Secondary owner phone number';
COMMENT ON COLUMN foreclosure_data.owner_phone_3 IS 'Third owner phone number';
COMMENT ON COLUMN foreclosure_data.owner_phone_4 IS 'Fourth owner phone number';
COMMENT ON COLUMN foreclosure_data.owner_phone_5 IS 'Fifth owner phone number';

COMMENT ON COLUMN foreclosure_data.owner_1_first_name IS 'First owner first name';
COMMENT ON COLUMN foreclosure_data.owner_1_last_name IS 'First owner last name';
COMMENT ON COLUMN foreclosure_data.owner_2_first_name IS 'Second owner first name';
COMMENT ON COLUMN foreclosure_data.owner_2_last_name IS 'Second owner last name';