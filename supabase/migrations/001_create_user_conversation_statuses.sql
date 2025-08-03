-- Create user_conversation_statuses table for storing user-specific conversation status data
-- This replaces localStorage-based conversation status management

CREATE TABLE IF NOT EXISTS user_conversation_statuses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    statuses JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index on user_id to ensure one record per user
CREATE UNIQUE INDEX IF NOT EXISTS user_conversation_statuses_user_id_idx 
ON user_conversation_statuses(user_id);

-- Create index on updated_at for performance
CREATE INDEX IF NOT EXISTS user_conversation_statuses_updated_at_idx 
ON user_conversation_statuses(updated_at);

-- Enable RLS (Row Level Security)
ALTER TABLE user_conversation_statuses ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to manage their own conversation statuses
CREATE POLICY "Users can manage their own conversation statuses" 
ON user_conversation_statuses
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_conversation_statuses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_conversation_statuses_updated_at
    BEFORE UPDATE ON user_conversation_statuses
    FOR EACH ROW
    EXECUTE FUNCTION update_user_conversation_statuses_updated_at();

-- Add helpful comments
COMMENT ON TABLE user_conversation_statuses IS 'Stores user-specific conversation status data (pending/replied) for CRM leads';
COMMENT ON COLUMN user_conversation_statuses.user_id IS 'References the authenticated user';
COMMENT ON COLUMN user_conversation_statuses.statuses IS 'JSON object mapping contactId to status (pending|replied)';
COMMENT ON COLUMN user_conversation_statuses.created_at IS 'When the user first set conversation statuses';
COMMENT ON COLUMN user_conversation_statuses.updated_at IS 'When the conversation statuses were last modified';