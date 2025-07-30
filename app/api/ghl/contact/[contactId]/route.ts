import { NextRequest, NextResponse } from 'next/server'
import { GoHighLevelAPI } from '@/lib/ghl-api'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  try {
    const accessToken = process.env.GHL_API_KEY
    const locationId = process.env.GHL_LOCATION_ID

    if (!accessToken) {
      return NextResponse.json(
        { error: 'GHL access token not configured' },
        { status: 500 }
      )
    }

    console.log('🔍 Fetching contact details for:', params.contactId)
    console.log('🔑 Using token:', accessToken.substring(0, 10) + '...')
    console.log('📍 Location ID:', locationId)

    const ghl = new GoHighLevelAPI({
      apiKey: accessToken,
      locationId: locationId || ''
    })

    const contact = await ghl.getContact(params.contactId)
    console.log('👤 Contact details:', JSON.stringify(contact, null, 2))

    return NextResponse.json({
      success: true,
      contact
    })

  } catch (error: any) {
    console.error('Error fetching contact details:', error)
    console.error('Full error:', JSON.stringify(error, null, 2))
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch contact details',
        contactId: params.contactId,
        details: error.message,
        fullError: error.toString()
      },
      { status: 500 }
    )
  }
}