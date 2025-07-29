import { NextRequest, NextResponse } from 'next/server'
import { GoHighLevelAPI } from '@/lib/ghl-api'

export async function GET(request: NextRequest) {
  try {
    // Check for API key in environment variables
    const apiKey = process.env.GHL_API_KEY
    const locationId = process.env.GHL_LOCATION_ID

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GHL API key not configured' },
        { status: 500 }
      )
    }

    // Initialize GHL API client
    const ghl = new GoHighLevelAPI({
      apiKey,
      locationId: locationId || ''
    })

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const starred = searchParams.get('starred') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Fetch conversations
    const result = await ghl.getConversations({
      starred,
      limit,
      offset
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching GHL conversations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}