import { NextRequest, NextResponse } from 'next/server'
import { GoHighLevelAPIWithRefresh } from '@/lib/ghl-api-with-refresh'
import { VercelEnvUpdater } from '@/lib/vercel-env-updater'


export const dynamic = 'force-dynamic';
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

    // Initialize GHL API client with refresh capability
    const ghl = new GoHighLevelAPIWithRefresh({
      apiKey,
      locationId: locationId || '',
      clientId: process.env.GHL_CLIENT_ID,
      clientSecret: process.env.GHL_CLIENT_SECRET,
      refreshToken: process.env.GHL_REFRESH_TOKEN,
      onTokenRefresh: async (newAccessToken, newRefreshToken) => {
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
        }
      }
    })

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const starred = searchParams.get('starred') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')

    // Debug API configuration
    console.log('GHL API Configuration:', {
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length,
      hasLocationId: !!locationId,
      locationId: locationId
    })

    try {
      // Use the new Search Conversations endpoint
      console.log('Attempting to fetch conversations with limit:', limit, 'starred:', starred)
      const result = await ghl.getConversations({ 
        limit,
        starred,
        sort: 'desc',
        sortBy: 'last_message_date'
      })
      
      console.log('Successfully fetched conversations:', result.total)
      return NextResponse.json(result)
      
    } catch (conversationError: any) {
      console.error('Error fetching conversations:', {
        error: conversationError.message,
        stack: conversationError.stack
      })
      
      return NextResponse.json({
        conversations: [],
        total: 0,
        error: `Failed to fetch conversations: ${conversationError.message}`,
        errorDetails: {
          hasApiKey: !!apiKey,
          hasLocationId: !!locationId,
          apiKeyStart: apiKey?.substring(0, 10) + '...',
          locationId: locationId
        },
        message: 'Could not fetch conversations from GHL API. Please check your API credentials and generate a new API key if needed.'
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