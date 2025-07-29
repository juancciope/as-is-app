import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.GHL_API_KEY
    const locationId = process.env.GHL_LOCATION_ID

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GHL_API_KEY not found in environment variables' },
        { status: 500 }
      )
    }

    if (!locationId) {
      return NextResponse.json(
        { error: 'GHL_LOCATION_ID not found in environment variables' },
        { status: 500 }
      )
    }

    // Test with a simple fetch to the contacts endpoint
    const response = await fetch(
      `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&limit=1`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        }
      }
    )

    const responseText = await response.text()
    let responseData
    
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = responseText
    }

    return NextResponse.json({
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData,
      config: {
        hasApiKey: !!apiKey,
        apiKeyLength: apiKey.length,
        apiKeyStart: apiKey.substring(0, 10) + '...',
        hasLocationId: !!locationId,
        locationId: locationId
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      error: 'Test failed',
      message: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}