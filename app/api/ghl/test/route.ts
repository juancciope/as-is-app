import { NextRequest, NextResponse } from 'next/server'


export const dynamic = 'force-dynamic';
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

    // Test the new Search Conversations endpoint instead
    const testUrl = `https://services.leadconnectorhq.com/conversations/search?locationId=${locationId}&limit=1&status=starred`
    console.log('Test URL:', testUrl)

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Version': '2021-04-15'
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
    let alternativeTests = []
    if (!response.ok && response.status === 401) {
      console.log('Bearer auth failed, trying alternative formats...')
      
      // Test 1: Try without Bearer prefix
      const altResponse1 = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json',
          'Version': '2021-04-15'
        }
      })
      
      const altText1 = await altResponse1.text()
      let altData1
      try {
        altData1 = JSON.parse(altText1)
      } catch {
        altData1 = altText1
      }
      
      alternativeTests.push({
        status: altResponse1.status,
        statusText: altResponse1.statusText,
        ok: altResponse1.ok,
        data: altData1,
        method: 'Authorization: [api_key] (no Bearer)'
      })

      // Test 2: Try JWT as token directly
      const altResponse2 = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json',
          'Version': '2021-04-15'
        }
      })
      
      const altText2 = await altResponse2.text()
      let altData2
      try {
        altData2 = JSON.parse(altText2)
      } catch {
        altData2 = altText2
      }
      
      alternativeTests.push({
        status: altResponse2.status,
        statusText: altResponse2.statusText,
        ok: altResponse2.ok,
        data: altData2,
        method: 'Authorization: Token [api_key]'
      })

      // Test 3: Try with custom header
      const altResponse3 = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `JWT ${apiKey}`,
          'Content-Type': 'application/json',
          'Version': '2021-04-15'
        }
      })
      
      const altText3 = await altResponse3.text()
      let altData3
      try {
        altData3 = JSON.parse(altText3)
      } catch {
        altData3 = altText3
      }
      
      alternativeTests.push({
        status: altResponse3.status,
        statusText: altResponse3.statusText,
        ok: altResponse3.ok,
        data: altData3,
        method: 'Authorization: JWT [api_key]'
      })
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
      alternativeTests,
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