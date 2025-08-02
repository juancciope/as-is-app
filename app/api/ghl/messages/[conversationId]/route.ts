import { NextRequest, NextResponse } from 'next/server'
import { GoHighLevelAPIWithRefresh } from '@/lib/ghl-api-with-refresh'
import { VercelEnvUpdater } from '@/lib/vercel-env-updater'

export async function GET(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const apiKey = process.env.GHL_API_KEY
    const locationId = process.env.GHL_LOCATION_ID

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GHL API key not configured' },
        { status: 500 }
      )
    }

    const ghl = new GoHighLevelAPIWithRefresh({
      apiKey,
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

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')
    const lastMessageId = searchParams.get('lastMessageId') || undefined
    const type = searchParams.get('type') || undefined

    console.log('🔍 Fetching messages for conversation:', params.conversationId)
    console.log('📋 Parameters:', { limit, lastMessageId, type })

    const result = await ghl.getMessages(params.conversationId, {
      limit,
      lastMessageId,
      type
    })

    console.log('🏠 GHL API raw response:', JSON.stringify(result, null, 2))
    console.log('📊 Messages count from GHL:', result?.messages?.length || 0)

    // Ensure we always return a consistent structure
    const messages = Array.isArray(result?.messages) ? result.messages : []
    return NextResponse.json({
      messages,
      total: messages.length, // Calculate total from messages array
      lastMessageId: result?.lastMessageId,
      nextPage: result?.nextPage || false
    })
  } catch (error: any) {
    console.error('Error fetching messages for conversation', params.conversationId, ':', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch messages',
        conversationId: params.conversationId,
        details: error.message,
        messages: [] // Return empty array to prevent crashes
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const apiKey = process.env.GHL_API_KEY
    const locationId = process.env.GHL_LOCATION_ID

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GHL API key not configured' },
        { status: 500 }
      )
    }

    const ghl = new GoHighLevelAPIWithRefresh({
      apiKey,
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

    const body = await request.json()
    
    // Note: GHL send message requires contactId, not conversationId
    // You'll need to get the contactId from the conversation first
    if (!body.contactId) {
      return NextResponse.json(
        { error: 'contactId is required to send messages via GHL API' },
        { status: 400 }
      )
    }

    const result = await ghl.sendMessage({
      type: body.type || 'SMS',
      contactId: body.contactId,
      message: body.message,
      attachments: body.attachments,
      fromNumber: body.fromNumber,
      toNumber: body.toNumber
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}