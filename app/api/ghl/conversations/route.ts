import { NextRequest, NextResponse } from 'next/server'
import { GoHighLevelAPIWithRefresh } from '@/lib/ghl-api-with-refresh'
import { VercelEnvUpdater } from '@/lib/vercel-env-updater'
import { supabaseAdmin } from '@/lib/supabase'


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
      // Fetch starred conversations from GHL
      console.log('Attempting to fetch starred conversations from GHL with limit:', limit)
      const ghlResult = await ghl.getConversations({ 
        limit,
        starred: true, // Always get starred conversations from GHL
        sort: 'desc',
        sortBy: 'last_message_date'
      })
      
      console.log('Successfully fetched GHL conversations:', ghlResult.total)

      // Fetch app-created conversations from our database
      let appConversations = []
      if (supabaseAdmin) {
        console.log('Fetching app-created conversations from database...')
        const { data: dbConversations, error: dbError } = await supabaseAdmin
          .from('conversations')
          .select('*')
          .order('last_message_date', { ascending: false })
          .limit(50)

        if (dbError) {
          console.error('Error fetching app conversations from database:', dbError)
        } else {
          // Transform database conversations to match GHL format
          appConversations = (dbConversations || []).map(conv => ({
            id: conv.ghl_conversation_id || `app-${conv.id}`,
            contactId: conv.ghl_contact_id,
            contactName: conv.contact_name,
            contactEmail: conv.contact_email,
            contactPhone: conv.contact_phone,
            lastMessageBody: conv.last_message_body,
            lastMessageDate: conv.last_message_date,
            lastMessageType: conv.last_message_type,
            unreadCount: conv.unread_count || 0,
            starred: conv.starred || true, // Mark app conversations as starred
            source: 'app' // Identifier to know this came from our app
          }))
          console.log('Fetched app conversations:', appConversations.length)
        }
      }

      // Combine and deduplicate conversations
      const allConversations = [...(ghlResult.conversations || []), ...appConversations]
      const uniqueConversations = allConversations.reduce((acc, conv) => {
        // Use conversation ID as the key for deduplication
        const key = conv.id
        if (!acc.find(existing => existing.id === key)) {
          acc.push(conv)
        }
        return acc
      }, [] as any[])

      // Sort by last message date and limit
      const sortedConversations = uniqueConversations
        .sort((a, b) => new Date(b.lastMessageDate || 0).getTime() - new Date(a.lastMessageDate || 0).getTime())
        .slice(0, limit)

      const result = {
        conversations: sortedConversations,
        total: sortedConversations.length,
        sources: {
          ghl: ghlResult.total,
          app: appConversations.length,
          combined: sortedConversations.length
        }
      }
      
      console.log('Combined conversation sources:', result.sources)
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