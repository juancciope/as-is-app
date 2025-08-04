-- Add ghl_contact_id to contacts table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS ghl_contact_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_contacts_ghl_contact_id ON contacts(ghl_contact_id);

-- Add comment
COMMENT ON COLUMN contacts.ghl_contact_id IS 'GoHighLevel contact ID for integration';