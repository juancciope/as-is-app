import { NextRequest, NextResponse } from 'next/server'
import { GoHighLevelAPI } from '@/lib/ghl-api'

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.GHL_API_KEY
    const locationId = process.env.GHL_LOCATION_ID

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GHL API key not configured' },
        { status: 500 }
      )
    }

    const ghl = new GoHighLevelAPI({
      apiKey,
      locationId: locationId || ''
    })

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const query = searchParams.get('query') || undefined

    const result = await ghl.getContacts({
      limit,
      query
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching GHL contacts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500 }
    )
  }
}