import { NextRequest, NextResponse } from 'next/server'
import { GoHighLevelAPIWithRefresh } from '@/lib/ghl-api-with-refresh'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking GHL authentication status...')
    
    // Check for required environment variables
    const apiKey = process.env.GHL_API_KEY
    const locationId = process.env.GHL_LOCATION_ID
    const clientId = process.env.GHL_CLIENT_ID
    const clientSecret = process.env.GHL_CLIENT_SECRET
    const refreshToken = process.env.GHL_REFRESH_TOKEN

    const config = {
      hasApiKey: !!apiKey,
      hasLocationId: !!locationId,
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasRefreshToken: !!refreshToken,
      apiKeyLength: apiKey?.length,
      refreshTokenLength: refreshToken?.length
    }

    console.log('🔧 Environment check:', config)

    if (!apiKey || !locationId) {
      return NextResponse.json({
        status: 'missing_config',
        message: 'GHL API key or location ID not configured',
        config,
        action: 'Configure GHL_API_KEY and GHL_LOCATION_ID environment variables'
      })
    }

    // Test current access token
    try {
      const ghl = new GoHighLevelAPIWithRefresh({
        apiKey,
        locationId,
        clientId,
        clientSecret,
        refreshToken
      })

      console.log('🧪 Testing current access token...')
      const conversations = await ghl.getConversations({ limit: 1 })
      
      return NextResponse.json({
        status: 'authenticated',
        message: 'GHL authentication is working correctly',
        config,
        testResult: 'API call successful'
      })

    } catch (error: any) {
      console.error('❌ Authentication test failed:', error.message)

      // Check if it's a refresh token expired error
      if (error.message?.includes('REFRESH_TOKEN_EXPIRED')) {
        return NextResponse.json({
          status: 'refresh_token_expired',
          message: 'Refresh token has expired - re-authentication required',
          config,
          action: 'Go to /admin/ghl-setup to re-authenticate with GHL',
          error: error.message
        })
      }

      // Check if it's missing refresh config
      if (!clientId || !clientSecret || !refreshToken) {
        return NextResponse.json({
          status: 'missing_refresh_config',
          message: 'OAuth refresh configuration incomplete',
          config,
          action: 'Configure GHL_CLIENT_ID, GHL_CLIENT_SECRET, and GHL_REFRESH_TOKEN',
          error: error.message
        })
      }

      return NextResponse.json({
        status: 'authentication_failed',
        message: 'GHL authentication failed',
        config,
        action: 'Check your GHL credentials or re-authenticate',
        error: error.message
      })
    }

  } catch (error: any) {
    console.error('❌ Auth status check error:', error)
    return NextResponse.json({
      status: 'error',
      message: 'Failed to check authentication status',
      error: error.message
    }, { status: 500 })
  }
}