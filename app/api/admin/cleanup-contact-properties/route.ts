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

    // First get all record IDs
    const { data: allRecords, error: fetchError } = await supabaseAdmin
      .from('contact_properties')
      .select('id')
    
    if (fetchError) {
      return NextResponse.json({
        error: 'Failed to fetch records for deletion',
        details: fetchError.message
      }, { status: 500 })
    }

    if (!allRecords || allRecords.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No records to delete',
        deletedCount: 0,
        remainingRecords: 0
      })
    }

    // Delete each record individually
    let deletedCount = 0
    for (const record of allRecords) {
      const { error: deleteError } = await supabaseAdmin
        .from('contact_properties')
        .delete()
        .eq('id', record.id)
      
      if (!deleteError) {
        deletedCount++
      }
    }

    // deleteError variable no longer exists in this context, remove this check

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
      deletedCount: deletedCount,
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