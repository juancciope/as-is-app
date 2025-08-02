import { NextRequest, NextResponse } from 'next/server'
import { GoHighLevelAPIWithRefresh } from '@/lib/ghl-api-with-refresh'
import { VercelEnvUpdater } from '@/lib/vercel-env-updater'

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

    const ghl = new GoHighLevelAPIWithRefresh({
      apiKey: accessToken,
      locationId: locationId || '',
      clientId: process.env.GHL_CLIENT_ID,
      clientSecret: process.env.GHL_CLIENT_SECRET,
      refreshToken: process.env.GHL_REFRESH_TOKEN,
      onTokenRefresh: async (newAccessToken, newRefreshToken) => {
        const vercelApiToken = process.env.VERCEL_API_TOKEN
        const vercelProjectId = process.env.VERCEL_PROJECT_ID
        const vercelTeamId = process.env.VERCEL_TEAM_ID
        
        if (vercelApiToken && vercelProjectId) {
          try {
            const vercelUpdater = new VercelEnvUpdater(vercelApiToken, vercelProjectId, vercelTeamId)
            await vercelUpdater.updateGHLTokens(newAccessToken, newRefreshToken)
            console.log('✅ Automatically updated GHL tokens in Vercel')
          } catch (error) {
            console.error('❌ Failed to update Vercel env vars:', error)
          }
        }
      }
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