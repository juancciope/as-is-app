import { NextRequest, NextResponse } from 'next/server'
import { GoHighLevelAPIWithRefresh } from '@/lib/ghl-api-with-refresh'
import { VercelEnvUpdater } from '@/lib/vercel-env-updater'

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Starting GHL refresh token test...')
    
    // Check for required environment variables
    const apiKey = process.env.GHL_API_KEY
    const locationId = process.env.GHL_LOCATION_ID
    const clientId = process.env.GHL_CLIENT_ID
    const clientSecret = process.env.GHL_CLIENT_SECRET
    const refreshToken = process.env.GHL_REFRESH_TOKEN

    console.log('🔧 Environment check:', {
      hasApiKey: !!apiKey,
      hasLocationId: !!locationId,
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasRefreshToken: !!refreshToken,
      apiKeyLength: apiKey?.length,
      refreshTokenLength: refreshToken?.length
    })

    if (!apiKey || !locationId || !clientId || !clientSecret || !refreshToken) {
      return NextResponse.json(
        { 
          error: 'Missing required GHL configuration',
          config: {
            hasApiKey: !!apiKey,
            hasLocationId: !!locationId,
            hasClientId: !!clientId,
            hasClientSecret: !!clientSecret,
            hasRefreshToken: !!refreshToken
          }
        },
        { status: 500 }
      )
    }

    // Initialize GHL API client with refresh capability
    const ghl = new GoHighLevelAPIWithRefresh({
      apiKey,
      locationId,
      clientId,
      clientSecret,
      refreshToken,
      onTokenRefresh: async (newAccessToken, newRefreshToken) => {
        console.log('🔄 Token refresh callback triggered')
        
        // Try to automatically update Vercel env vars
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
        } else {
          console.warn('⚠️ Vercel API credentials not available for automatic token update')
        }
      }
    })

    // Test 1: Try a simple API call to trigger potential refresh
    console.log('🧪 Test 1: Making API call to trigger potential refresh...')
    try {
      const conversations = await ghl.getConversations({ limit: 1 })
      console.log('✅ Test 1 passed: API call successful')
    } catch (error) {
      console.error('❌ Test 1 failed:', error)
      return NextResponse.json(
        { 
          error: 'API call failed',
          details: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      )
    }

    // Test 2: Force token refresh by making API call with expired token
    console.log('🧪 Test 2: Testing refresh mechanism...')
    try {
      // Temporarily corrupt the token to force refresh
      const originalToken = ghl.apiConfig.apiKey
      ghl.apiConfig.apiKey = 'invalid_token_to_force_refresh'
      ghl.updateHeaders()

      // This should trigger a 401 and automatic refresh
      const conversations = await ghl.getConversations({ limit: 1 })
      console.log('✅ Test 2 passed: Refresh mechanism working')

      return NextResponse.json({
        success: true,
        message: 'All tests passed - refresh token mechanism is working',
        tests: {
          apiCall: 'passed',
          refreshMechanism: 'passed'
        }
      })

    } catch (error) {
      console.error('❌ Test 2 failed - Refresh mechanism not working:', error)
      return NextResponse.json(
        { 
          error: 'Refresh mechanism failed',
          details: error instanceof Error ? error.message : String(error),
          tests: {
            apiCall: 'passed',
            refreshMechanism: 'failed'
          }
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('❌ Test endpoint error:', error)
    return NextResponse.json(
      { 
        error: 'Test failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'GHL Refresh Token Test Endpoint',
    instructions: 'Send POST request to run refresh token tests'
  })
}