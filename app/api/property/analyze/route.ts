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
    
    console.log('🏠 Analyzing property:', fullAddress)
    console.log('🔍 First, scraping Zillow data using Apify...')
    
    // Step 1: Scrape Zillow data using Apify maxcopell/zillow-scraper
    let zillowData = null
    try {
      const apifyToken = process.env.APIFY_API_TOKEN
      if (!apifyToken) {
        throw new Error('APIFY_API_TOKEN not configured')
      }

      // Run the Zillow scraper actor
      const runResponse = await fetch(
        `https://api.apify.com/v2/acts/maxcopell~zillow-scraper/runs?token=${apifyToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: {
              searchQuery: fullAddress,
              maxResults: 1
            }
          })
        }
      )

      if (!runResponse.ok) {
        throw new Error(`Apify run failed: ${runResponse.statusText}`)
      }

      const runData = await runResponse.json()
      const runId = runData.data.id
      const datasetId = runData.data.defaultDatasetId
      
      console.log(`🤖 Apify run started: ${runId}`)
      
      // Wait for completion and get results
      let attempts = 0
      const maxAttempts = 24 // 2 minutes max (5 second intervals)
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000))
        attempts++
        
        const datasetResponse = await fetch(
          `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&clean=true&format=json`
        )

        if (datasetResponse.ok) {
          const data = await datasetResponse.json()
          if (data.length > 0) {
            zillowData = data[0] // Get first result
            console.log('✅ Zillow data scraped successfully')
            break
          }
        }
        
        console.log(`⏳ Waiting for Zillow data... attempt ${attempts}/${maxAttempts}`)
      }

      if (!zillowData) {
        console.log('⚠️ No Zillow data found after waiting')
      }
    } catch (error) {
      console.error('❌ Apify Zillow scraping error:', error)
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
REAL ZILLOW DATA (scraped via Apify - use this EXACT data):
${JSON.stringify(zillowData, null, 2)}

CRITICAL INSTRUCTIONS:
- Use the EXACT Zillow data provided above for all property details
- Do NOT modify, estimate, or approximate the scraped Zillow values
- Square footage: ${zillowData.livingArea || zillowData.sqft || 'N/A'}
- Bedrooms: ${zillowData.bedrooms || 'N/A'}  
- Bathrooms: ${zillowData.bathrooms || 'N/A'}
- Year built: ${zillowData.yearBuilt || 'N/A'}
- Zestimate: $${zillowData.zestimate || zillowData.price || 'N/A'}
- Lot size: ${zillowData.lotSize || 'N/A'}

Include this verification in your JSON response:
"zillow_data_verification": {
  "data_source": "Apify scraper (maxcopell/zillow-scraper)",
  "scraped_successfully": true,
  "zestimate_amount": ${zillowData.zestimate || zillowData.price || 'null'},
  "property_details_verified": true
}
` : `
⚠️ ZILLOW DATA NOT AVAILABLE
The Apify Zillow scraper did not return data for this property.
Please:
1. Generate realistic estimates based on Middle Tennessee market knowledge
2. Clearly indicate that estimates are used (not Zillow data)
3. Include this in your response:

"zillow_data_verification": {
  "data_source": "Market estimates (Zillow scraping failed)",
  "scraped_successfully": false,
  "reason": "Property not found or scraping timeout",
  "using_estimates": true
}
`}

Please provide your comprehensive analysis in the expected JSON format.`
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