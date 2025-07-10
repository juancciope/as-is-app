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

-- Create indexes for the new columns to improve search performance
CREATE INDEX IF NOT EXISTS idx_owner_email_1 ON foreclosure_data(owner_email_1);
CREATE INDEX IF NOT EXISTS idx_owner_phone_1 ON foreclosure_data(owner_phone_1);

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