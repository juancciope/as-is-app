import { NextRequest, NextResponse } from 'next/server'
import { GoHighLevelAPI } from '@/lib/ghl-api'

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

    const ghl = new GoHighLevelAPI({
      apiKey,
      locationId: locationId || ''
    })

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const result = await ghl.getMessages(params.conversationId, {
      limit,
      offset
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
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

    const ghl = new GoHighLevelAPI({
      apiKey,
      locationId: locationId || ''
    })

    const body = await request.json()
    const message = await ghl.sendMessage(params.conversationId, {
      type: body.type || 'SMS',
      body: body.message,
      attachments: body.attachments
    })

    return NextResponse.json({ message })
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}