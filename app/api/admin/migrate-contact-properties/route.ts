import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    // Execute the migration SQL
    const migrationSQL = `
      -- Create contact_properties table for storing GHL contact property data
      CREATE TABLE IF NOT EXISTS contact_properties (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          contact_id VARCHAR(255) NOT NULL UNIQUE,
          properties JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Create index on contact_id for faster lookups
      CREATE INDEX IF NOT EXISTS idx_contact_properties_contact_id 
      ON contact_properties (contact_id);

      -- Create index on updated_at for caching and sync logic
      CREATE INDEX IF NOT EXISTS idx_contact_properties_updated_at 
      ON contact_properties (updated_at);

      -- Add RLS (Row Level Security) policies
      ALTER TABLE contact_properties ENABLE ROW LEVEL SECURITY;

      -- Policy to allow all operations
      DROP POLICY IF EXISTS "Allow all operations on contact_properties" ON contact_properties;
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
      DROP TRIGGER IF EXISTS trigger_update_contact_properties_updated_at ON contact_properties;
      CREATE TRIGGER trigger_update_contact_properties_updated_at
          BEFORE UPDATE ON contact_properties
          FOR EACH ROW
          EXECUTE FUNCTION update_contact_properties_updated_at();
    `

    const { error } = await supabaseAdmin.rpc('exec_sql', { sql: migrationSQL })

    if (error) {
      console.error('Migration error:', error)
      
      // Try alternative approach using individual statements
      const statements = [
        `CREATE TABLE IF NOT EXISTS contact_properties (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          contact_id VARCHAR(255) NOT NULL UNIQUE,
          properties JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS idx_contact_properties_contact_id ON contact_properties (contact_id)`,
        `CREATE INDEX IF NOT EXISTS idx_contact_properties_updated_at ON contact_properties (updated_at)`,
        `ALTER TABLE contact_properties ENABLE ROW LEVEL SECURITY`,
        `DROP POLICY IF EXISTS "Allow all operations on contact_properties" ON contact_properties`,
        `CREATE POLICY "Allow all operations on contact_properties" ON contact_properties FOR ALL USING (true)`
      ]

      const results = []
      for (const statement of statements) {
        try {
          const { error: stmtError } = await supabaseAdmin.rpc('exec_sql', { sql: statement })
          results.push({ statement, success: !stmtError, error: stmtError?.message })
        } catch (err) {
          results.push({ statement, success: false, error: (err as Error).message })
        }
      }

      return NextResponse.json({
        success: false,
        message: 'Migration partially failed, tried individual statements',
        results
      })
    }

    // Test if table was created by attempting to query it
    const { data: testQuery, error: testError } = await supabaseAdmin
      .from('contact_properties')
      .select('id')
      .limit(1)

    if (testError) {
      return NextResponse.json({
        success: false,
        error: 'Table creation verification failed',
        details: testError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Contact properties table created successfully',
      tableExists: true
    })

  } catch (error: any) {
    console.error('Migration execution error:', error)
    return NextResponse.json({
      error: 'Migration failed',
      details: error.message
    }, { status: 500 })
  }
}