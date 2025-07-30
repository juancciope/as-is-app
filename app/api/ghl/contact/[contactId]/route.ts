import { NextRequest, NextResponse } from 'next/server'
import { GoHighLevelAPI } from '@/lib/ghl-api'

export const dynamic = 'force-dynamic'

async function refreshAccessToken() {
  const clientId = process.env.GHL_CLIENT_ID
  const clientSecret = process.env.GHL_CLIENT_SECRET
  const refreshToken = process.env.GHL_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('OAuth credentials not configured')
  }

  const response = await fetch('https://services.leadconnectorhq.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  })

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${response.statusText}`)
  }

  const data = await response.json()
  return data.access_token
}

export async function GET(
  request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  try {
    let accessToken = process.env.GHL_API_KEY
    const locationId = process.env.GHL_LOCATION_ID

    if (!accessToken) {
      return NextResponse.json(
        { error: 'GHL access token not configured' },
        { status: 500 }
      )
    }

    const ghl = new GoHighLevelAPI({
      apiKey: accessToken,
      locationId: locationId || ''
    })

    console.log('🔍 Fetching contact details for:', params.contactId)

    try {
      const contact = await ghl.getContact(params.contactId)
      console.log('👤 Contact details:', JSON.stringify(contact, null, 2))

      return NextResponse.json({
        success: true,
        contact
      })
    } catch (error: any) {
      // If unauthorized, try refreshing the token
      if (error.message.includes('Unauthorized')) {
        console.log('🔄 Access token expired, refreshing...')
        
        try {
          const newAccessToken = await refreshAccessToken()
          
          const ghlWithNewToken = new GoHighLevelAPI({
            apiKey: newAccessToken,
            locationId: locationId || ''
          })

          const contact = await ghlWithNewToken.getContact(params.contactId)
          console.log('👤 Contact details (with refreshed token):', JSON.stringify(contact, null, 2))

          return NextResponse.json({
            success: true,
            contact,
            tokenRefreshed: true
          })
        } catch (refreshError: any) {
          console.error('Failed to refresh token:', refreshError)
          throw error // Throw original error
        }
      }
      throw error
    }

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