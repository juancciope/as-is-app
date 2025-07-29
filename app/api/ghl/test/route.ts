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
    console.log('Testing GHL API with these headers:', {
      'Authorization': `Bearer ${apiKey.substring(0, 10)}...`,
      'Content-Type': 'application/json',
      'Version': '2021-07-28'
    })

    const testUrl = `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&limit=1`
    console.log('Test URL:', testUrl)

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      }
    })

    const responseText = await response.text()
    let responseData
    
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = responseText
    }

    // If first test fails, try alternative auth formats
    let alternativeTest = null
    if (!response.ok && response.status === 401) {
      console.log('Bearer auth failed, trying alternative formats...')
      
      // Try without Bearer prefix
      const altResponse = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        }
      })
      
      const altText = await altResponse.text()
      let altData
      try {
        altData = JSON.parse(altText)
      } catch {
        altData = altText
      }
      
      alternativeTest = {
        status: altResponse.status,
        statusText: altResponse.statusText,
        ok: altResponse.ok,
        data: altData,
        method: 'Authorization: [api_key] (no Bearer)'
      }
    }

    return NextResponse.json({
      primaryTest: {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        data: responseData,
        method: 'Authorization: Bearer [api_key]'
      },
      alternativeTest,
      config: {
        hasApiKey: !!apiKey,
        apiKeyLength: apiKey.length,
        apiKeyStart: apiKey.substring(0, 10) + '...',
        hasLocationId: !!locationId,
        locationId: locationId,
        testUrl: testUrl
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