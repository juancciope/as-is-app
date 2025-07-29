import { NextRequest, NextResponse } from 'next/server'
import { GHLOAuthManager } from '@/lib/ghl-oauth'

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GHL_CLIENT_ID
    const clientSecret = process.env.GHL_CLIENT_SECRET
    const accessToken = process.env.GHL_API_KEY // This is actually the access token
    const refreshToken = process.env.GHL_REFRESH_TOKEN
    const locationId = process.env.GHL_LOCATION_ID

    // Check what we have
    const config = {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      hasLocationId: !!locationId,
      accessTokenStart: accessToken?.substring(0, 20) + '...',
      refreshTokenStart: refreshToken?.substring(0, 20) + '...'
    }

    if (!accessToken) {
      return NextResponse.json({
        error: 'No access token found',
        config,
        message: 'GHL_API_KEY (access token) is required'
      })
    }

    if (!locationId) {
      return NextResponse.json({
        error: 'No location ID found',
        config,
        message: 'GHL_LOCATION_ID is required'
      })
    }

    // Test the current access token
    console.log('Testing current access token...')
    const testResponse = await fetch(
      `https://services.leadconnectorhq.com/conversations/search?locationId=${locationId}&limit=1`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Version': '2021-04-15'
        }
      }
    )

    const testText = await testResponse.text()
    let testData
    try {
      testData = JSON.parse(testText)
    } catch {
      testData = testText
    }

    const tokenTest = {
      status: testResponse.status,
      statusText: testResponse.statusText,
      ok: testResponse.ok,
      data: testData
    }

    // If token is expired and we have refresh credentials, try to refresh
    let refreshResult = null
    if (!testResponse.ok && testResponse.status === 401 && clientId && clientSecret && refreshToken) {
      console.log('Token expired, attempting refresh...')
      
      try {
        const oauthManager = new GHLOAuthManager({
          clientId,
          clientSecret,
          accessToken,
          refreshToken,
          locationId
        })

        const newTokens = await oauthManager.refreshAccessToken()
        refreshResult = {
          success: true,
          newAccessToken: newTokens.access_token.substring(0, 20) + '...',
          newRefreshToken: newTokens.refresh_token.substring(0, 20) + '...',
          expiresIn: newTokens.expires_in,
          message: 'Token refreshed successfully! Update your environment variables with the new tokens.'
        }
      } catch (refreshError: any) {
        refreshResult = {
          success: false,
          error: refreshError.message,
          message: 'Token refresh failed. You may need to go through the OAuth flow again.'
        }
      }
    }

    return NextResponse.json({
      config,
      tokenTest,
      refreshResult,
      nextSteps: tokenTest.ok 
        ? 'Your access token is working!' 
        : refreshResult?.success 
          ? 'Update your environment variables with the new tokens from refreshResult'
          : 'You need valid OAuth credentials. Check the OAuth setup documentation.'
    })

  } catch (error: any) {
    return NextResponse.json({
      error: 'OAuth test failed',
      message: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}