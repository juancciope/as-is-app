import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { address, city, state, zipCode } = await request.json()

    if (!address || !city || !state) {
      return NextResponse.json(
        { error: 'Address, city, and state are required' },
        { status: 400 }
      )
    }

    const fullAddress = `${address}, ${city}, ${state}${zipCode ? ` ${zipCode}` : ''}`
    
    // First, try to get Zillow data
    console.log('🏠 Analyzing property:', fullAddress)
    console.log('🔍 Fetching Zillow data first...')
    
    let zillowData = null
    try {
      const zillowResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/zillow/zestimate?address=${encodeURIComponent(address)}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}${zipCode ? `&zipCode=${encodeURIComponent(zipCode)}` : ''}`)
      if (zillowResponse.ok) {
        const zillowResult = await zillowResponse.json()
        zillowData = zillowResult.property
        console.log('✅ Zillow data retrieved')
      } else {
        console.log('⚠️ Zillow data not available, using mock data')
      }
    } catch (error) {
      console.log('⚠️ Error fetching Zillow data:', error)
    }
    
    // Default assistant ID with environment variable override
    const assistantId = process.env.OPENAI_ASSISTANT_ID || 'asst_YOUR_ASSISTANT_ID_HERE'
    console.log('🤖 Using Assistant ID:', assistantId.substring(0, 10) + '...')

    // Create a thread
    const thread = await openai.beta.threads.create()

    // Structure the data for the assistant
    const analysisRequest = {
      property_address: fullAddress,
      investor_profile: {
        location: "Middle Tennessee area",
        strategy: "Fix and flip distressed properties",
        focus: "Investment properties for renovation and resale"
      },
      analysis_type: "comprehensive_investment_analysis",
      requested_data: [
        "property_valuation",
        "market_analysis", 
        "renovation_estimates",
        "roi_projections",
        "neighborhood_analysis",
        "investment_recommendation"
      ]
    }

    // Send structured message to assistant with Zillow data
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `Please analyze this property for investment potential:

PROPERTY TO ANALYZE:
${JSON.stringify(analysisRequest, null, 2)}

${zillowData ? `
ZILLOW PROPERTY DATA (Use this exact data - DO NOT modify):
${JSON.stringify(zillowData, null, 2)}

CRITICAL INSTRUCTIONS:
- Use the EXACT Zillow data provided above for all property details
- Square footage: ${zillowData.livingArea || 'N/A'}
- Bedrooms: ${zillowData.bedrooms || 'N/A'}  
- Bathrooms: ${zillowData.bathrooms || 'N/A'}
- Year built: ${zillowData.yearBuilt || 'N/A'}
- Zestimate: $${zillowData.zestimate?.amount || 'N/A'}
- DO NOT estimate or modify these values

Include this verification in your response:
"zillow_data_verification": {
  "data_provided": true,
  "zestimate_amount": ${zillowData.zestimate?.amount || 'null'},
  "property_details_source": "Zillow API data provided"
}
` : `
⚠️ ZILLOW DATA NOT AVAILABLE
Since accurate Zillow data could not be retrieved, please:
1. State clearly that Zillow data is not available
2. Do NOT provide estimated property details
3. Request that the user provide current Zillow data
4. Do NOT proceed with detailed analysis without accurate property data

Include this in your response:
"zillow_data_verification": {
  "data_provided": false,
  "reason": "Zillow data could not be retrieved",
  "recommendation": "User should provide current Zillow property details"
}
`}

Provide your comprehensive analysis in JSON format using the exact property data provided.`
    })

    // Run the assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId
    })

    // Poll for completion with exponential backoff
    let runStatus = await openai.beta.threads.runs.retrieve(run.id, { thread_id: thread.id })
    let attempts = 0
    const maxAttempts = 30
    
    while ((runStatus.status === 'in_progress' || runStatus.status === 'queued') && attempts < maxAttempts) {
      const delay = Math.min(1000 * Math.pow(1.5, attempts), 5000) // Exponential backoff, max 5s
      await new Promise(resolve => setTimeout(resolve, delay))
      runStatus = await openai.beta.threads.runs.retrieve(run.id, { thread_id: thread.id })
      attempts++
    }

    if (runStatus.status === 'completed') {
      // Get the assistant's response
      const messages = await openai.beta.threads.messages.list(thread.id)
      const assistantMessage = messages.data.find(msg => msg.role === 'assistant')
      
      if (assistantMessage && assistantMessage.content[0].type === 'text') {
        const responseText = assistantMessage.content[0].text.value
        
        // Try to parse JSON response, handle markdown code blocks
        let analysisData
        try {
          // First try direct parsing
          analysisData = JSON.parse(responseText)
        } catch {
          try {
            // Try to extract JSON from markdown code blocks
            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/)
            if (jsonMatch && jsonMatch[1]) {
              analysisData = JSON.parse(jsonMatch[1])
            } else {
              // Try to find any JSON-like content
              const jsonStart = responseText.indexOf('{')
              const jsonEnd = responseText.lastIndexOf('}')
              if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                const possibleJson = responseText.substring(jsonStart, jsonEnd + 1)
                analysisData = JSON.parse(possibleJson)
              } else {
                throw new Error('No JSON found')
              }
            }
          } catch {
            // If all parsing fails, treat as formatted text
            analysisData = {
              analysis_text: responseText,
              property_address: fullAddress,
              recommendation: "See detailed analysis above"
            }
          }
        }

        return NextResponse.json({
          success: true,
          data: analysisData,
          address: fullAddress,
          timestamp: new Date().toISOString(),
          method: 'assistant'
        })
      } else {
        throw new Error('No response from assistant')
      }
    } else if (runStatus.status === 'failed') {
      throw new Error(`Assistant run failed: ${runStatus.last_error?.message || 'Unknown error'}`)
    } else {
      throw new Error(`Assistant run timeout or failed with status: ${runStatus.status}`)
    }

  } catch (error: any) {
    console.error('Error analyzing property:', error)
    
    // Check if it's an OpenAI API key error
    if (error.message?.includes('API key')) {
      return NextResponse.json(
        { 
          error: 'OpenAI API key not configured',
          details: 'Please add OPENAI_API_KEY to your environment variables'
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to analyze property',
        details: error.message 
      },
      { status: 500 }
    )
  }
}