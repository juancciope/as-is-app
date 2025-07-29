import { NextRequest, NextResponse } from 'next/server'
import { GHLOAuthManager } from '@/lib/ghl-oauth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const clientId = process.env.GHL_CLIENT_ID
    const clientSecret = process.env.GHL_CLIENT_SECRET
    const accessToken = process.env.GHL_API_KEY
    const refreshToken = process.env.GHL_REFRESH_TOKEN
    const locationId = process.env.GHL_LOCATION_ID

    if (!clientId || !clientSecret || !refreshToken) {
      return NextResponse.json({
        error: 'Missing OAuth credentials',
        message: 'Need GHL_CLIENT_ID, GHL_CLIENT_SECRET, and GHL_REFRESH_TOKEN'
      }, { status: 500 })
    }

    const oauthManager = new GHLOAuthManager({
      clientId,
      clientSecret,
      accessToken: accessToken || '',
      refreshToken,
      locationId: locationId || ''
    })

    // Get a fresh token
    const newTokens = await oauthManager.refreshAccessToken()

    return NextResponse.json({
      success: true,
      newTokens: {
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_in: newTokens.expires_in
      },
      message: 'Tokens refreshed successfully. Update your environment variables with these new tokens.',
      instructions: [
        'Copy the new access_token to GHL_API_KEY',
        'Copy the new refresh_token to GHL_REFRESH_TOKEN', 
        'Redeploy your app'
      ]
    })

  } catch (error: any) {
    return NextResponse.json({
      error: 'Token refresh failed',
      message: error.message,
      suggestion: 'You may need to go through the OAuth flow again with the correct scopes'
    }, { status: 500 })
  }
}