import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    // Get ALL contact properties records to see what's in the database
    const { data: allRecords, error } = await supabaseAdmin
      .from('contact_properties')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching all contact properties:', error)
      return NextResponse.json(
        { error: 'Failed to fetch all contact properties', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      totalRecords: allRecords?.length || 0,
      records: allRecords || [],
      message: 'All contact properties records'
    })

  } catch (error: any) {
    console.error('Error in debug contact properties:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}