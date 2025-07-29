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

    try {
      // First, let's just get contacts to see if the API works
      const contactsResult = await ghl.getContacts({ limit })
      
      // For now, return contacts info so we can see what we're working with
      return NextResponse.json({
        conversations: [],
        total: 0,
        contacts: contactsResult.contacts,
        contactsCount: contactsResult.count,
        message: `Found ${contactsResult.count} contacts. To get conversations, we need to determine which contacts have conversation IDs.`
      })
    } catch (contactError) {
      console.error('Error fetching contacts:', contactError)
      return NextResponse.json({
        conversations: [],
        total: 0,
        error: `Failed to fetch contacts: ${contactError}`,
        message: 'Could not fetch contacts from GHL API. Please check your API credentials and permissions.'
      })
    }
  } catch (error) {
    console.error('Error with GHL API:', error)
    return NextResponse.json(
      { error: 'Failed to access GHL API' },
      { status: 500 }
    )
  }
}