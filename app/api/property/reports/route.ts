import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, PropertyAnalysisReport } from '../../../../lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabaseAdmin
      .from('property_analysis_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by address if provided
    if (address) {
      query = query.ilike('property_address', `%${address}%`)
    }

    const { data: reports, error } = await query

    if (error) {
      console.error('Error fetching property analysis reports:', error)
      return NextResponse.json(
        { error: 'Failed to fetch reports' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      reports: reports || [],
      count: reports?.length || 0,
      offset,
      limit
    })

  } catch (error: any) {
    console.error('Error in property reports API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get a specific report by ID
export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { reportId } = await request.json()

    if (!reportId) {
      return NextResponse.json(
        { error: 'Report ID is required' },
        { status: 400 }
      )
    }

    const { data: report, error } = await supabaseAdmin
      .from('property_analysis_reports')
      .select('*')
      .eq('id', reportId)
      .single()

    if (error) {
      console.error('Error fetching property analysis report:', error)
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      report
    })

  } catch (error: any) {
    console.error('Error fetching specific report:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}