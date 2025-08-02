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

    // Get query parameter to confirm deletion
    const { searchParams } = new URL(request.url)
    const confirm = searchParams.get('confirm')
    
    if (confirm !== 'DELETE_ALL_DATA') {
      return NextResponse.json({
        error: 'Confirmation required',
        message: 'Add ?confirm=DELETE_ALL_DATA to the URL to confirm deletion',
        warning: 'This will delete ALL contact properties data'
      }, { status: 400 })
    }

    // Delete all records from contact_properties table
    const { error: deleteError, count } = await supabaseAdmin
      .from('contact_properties')
      .delete()
      .gte('created_at', '1900-01-01') // This will match all records

    if (deleteError) {
      console.error('Error deleting contact properties:', deleteError)
      return NextResponse.json({
        error: 'Failed to delete contact properties',
        details: deleteError.message
      }, { status: 500 })
    }

    // Verify deletion
    const { data: remainingRecords, error: countError } = await supabaseAdmin
      .from('contact_properties')
      .select('id')

    if (countError) {
      console.error('Error counting remaining records:', countError)
    }

    return NextResponse.json({
      success: true,
      message: 'All contact properties data has been deleted',
      deletedCount: count,
      remainingRecords: remainingRecords?.length || 0,
      note: 'Fresh data will be created when users visit contacts'
    })

  } catch (error: any) {
    console.error('Error in cleanup contact properties:', error)
    return NextResponse.json({
      error: 'Cleanup failed',
      details: error.message
    }, { status: 500 })
  }
}