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

    // Try to create table directly using a simple insert operation to test if it exists
    let tableExists = false
    try {
      const { error: testError } = await supabaseAdmin
        .from('contact_properties')
        .select('id')
        .limit(1)
      
      if (!testError) {
        tableExists = true
      }
    } catch (error) {
      console.log('Table does not exist, will create it')
    }

    if (tableExists) {
      return NextResponse.json({
        success: true,
        message: 'Contact properties table already exists',
        tableExists: true
      })
    }

    // Create table by inserting a test record and letting Supabase auto-create schema
    // This is a workaround since we can't execute raw SQL easily
    try {
      // Try to insert a test record to trigger table creation
      const { error: insertError } = await supabaseAdmin
        .from('contact_properties')
        .insert({
          contact_id: 'test-migration',
          properties: []
        })
      
      if (insertError) {
        console.error('Table creation via insert failed:', insertError)
        
        // Table doesn't exist and we can't create it with this method
        return NextResponse.json({
          success: false,
          error: 'Cannot create table automatically',
          message: 'Please create the table manually in Supabase dashboard',
          sql: `
            CREATE TABLE contact_properties (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              contact_id VARCHAR(255) NOT NULL UNIQUE,
              properties JSONB NOT NULL DEFAULT '[]'::jsonb,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            CREATE INDEX idx_contact_properties_contact_id ON contact_properties (contact_id);
            ALTER TABLE contact_properties ENABLE ROW LEVEL SECURITY;
            CREATE POLICY "Allow all operations on contact_properties" ON contact_properties FOR ALL USING (true);
          `
        })
      }

      // Clean up test record
      await supabaseAdmin
        .from('contact_properties')
        .delete()
        .eq('contact_id', 'test-migration')

    } catch (error) {
      console.error('Table creation failed:', error)
      return NextResponse.json({
        success: false,
        error: 'Table creation failed',
        details: (error as Error).message
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