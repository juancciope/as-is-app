import { NextRequest, NextResponse } from 'next/server'
import { GoHighLevelAPI } from '@/lib/ghl-api'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  try {
    // Use OAuth access token instead of API key
    const accessToken = process.env.GHL_ACCESS_TOKEN
    const locationId = process.env.GHL_LOCATION_ID

    if (!accessToken) {
      return NextResponse.json(
        { error: 'GHL access token not configured' },
        { status: 500 }
      )
    }

    const ghl = new GoHighLevelAPI({
      apiKey: accessToken, // The GoHighLevelAPI class treats this as the bearer token
      locationId: locationId || ''
    })

    console.log('🔍 Fetching contact details for:', params.contactId)

    const contact = await ghl.getContact(params.contactId)

    console.log('👤 Contact details:', JSON.stringify(contact, null, 2))

    return NextResponse.json({
      success: true,
      contact
    })

  } catch (error: any) {
    console.error('Error fetching contact details:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch contact details',
        contactId: params.contactId,
        details: error.message
      },
      { status: 500 }
    )
  }
}