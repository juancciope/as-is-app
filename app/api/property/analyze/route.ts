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

    // Send message using the same approach that worked with ChatGPT
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `I am looking to purchase distressed properties as an investment and fix them up to flip them. I am located in the middle Tennessee area. 

Give me an overview of the information you have about the following address, including all information I would need to make an investment decision:

${fullAddress}

Please provide a comprehensive real estate investment analysis in JSON format with the following structure:

{
  "property_address": "${fullAddress}",
  "analysis_summary": {
    "investment_grade": "[A-F grade]",
    "estimated_arv": [number],
    "estimated_purchase_price": [number],  
    "renovation_estimate": [number],
    "projected_profit": [number],
    "roi_percentage": [number],
    "risk_level": "[Low/Medium/High]",
    "recommendation": "[PROCEED/PROCEED_WITH_CAUTION/AVOID]"
  },
  "property_details": {
    "current_estimated_value": [number],
    "square_footage": [number],
    "bedrooms": [number],
    "bathrooms": [number],
    "lot_size": "[size]",
    "year_built": [year],
    "property_type": "[type]"
  },
  "market_analysis": {
    "neighborhood_grade": "[grade]",
    "recent_sales_comparison": "[description]",
    "market_trend": "[description]",
    "days_on_market_average": [number],
    "absorption_rate": "[description]"
  },
  "renovation_breakdown": {
    "kitchen": [number],
    "bathrooms": [number], 
    "flooring": [number],
    "paint_interior": [number],
    "landscaping": [number],
    "miscellaneous": [number],
    "contingency_10_percent": [number],
    "total_estimated": [number]
  },
  "financial_projections": {
    "purchase_price": [number],
    "renovation_costs": [number],
    "holding_costs": [number],
    "selling_costs": [number],
    "total_investment": [number],
    "estimated_sale_price": [number],
    "gross_profit": [number],
    "roi_percentage": [number],
    "timeline_months": [number]
  },
  "investment_recommendation": {
    "decision": "[PROCEED/PROCEED_WITH_CAUTION/AVOID]",
    "confidence_level": "[percentage]",
    "key_reasons": ["reason1", "reason2", "reason3"],
    "concerns": ["concern1", "concern2"]
  },
  "data_verification": {
    "source": "Web search results from Zillow/Redfin/Realtor.com",
    "search_performed": true,
    "data_quality": "Current market data from web search",
    "last_updated": "${new Date().toISOString()}",
    "primary_data_source": "[Include Zillow/Redfin URL if found]"
  }
}

IMPORTANT: You MUST perform a web search for this property address to get current, accurate data. Search on Zillow, Redfin, or Realtor.com to find the actual property details, current value estimates, and recent comparable sales. Base your analysis on the real data you find through web search, not on estimates or general knowledge.`
    })

    // Run the assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId
    })

    // Poll for completion with exponential backoff
    let runStatus = await openai.beta.threads.runs.retrieve(run.id, { thread_id: thread.id })
    let attempts = 0
    const maxAttempts = 30
    
    while ((runStatus.status === 'in_progress' || runStatus.status === 'queued' || runStatus.status === 'requires_action') && attempts < maxAttempts) {
      // Handle function calls
      if (runStatus.status === 'requires_action' && runStatus.required_action?.type === 'submit_tool_outputs') {
        console.log('🔧 Assistant requires function call handling')
        
        const toolOutputs = []
        
        for (const toolCall of runStatus.required_action.submit_tool_outputs.tool_calls) {
          console.log(`📞 Function call: ${toolCall.function.name}`)
          console.log(`📋 Arguments: ${toolCall.function.arguments}`)
          
          // Handle search_property_data function
          console.log(`🔍 Handling function: ${toolCall.function.name}`)
          if (toolCall.function.name === 'search_property_data') {
            const args = JSON.parse(toolCall.function.arguments)
            
            // For now, return mock data. In production, you'd implement actual search
            const propertyData = {
              source: "Zillow",
              url: `https://www.zillow.com/homedetails/${args.property_address.replace(/\s+/g, '-')}`,
              data: {
                address: args.property_address,
                zestimate: 485000,
                square_footage: 2456,
                bedrooms: 4,
                bathrooms: 2.5,
                year_built: 1998,
                lot_size: "0.25 acres",
                property_type: "Single Family Home",
                last_sold: {
                  date: "March 2019",
                  price: 385000
                },
                property_tax: 3850,
                monthly_hoa: 0,
                price_per_sqft: 197,
                neighborhood: "Fieldstone Farms",
                walk_score: 15,
                school_ratings: {
                  elementary: 8,
                  middle: 7,
                  high: 8
                },
                recent_comps: [
                  {
                    address: "245 Halberton Dr",
                    sold_date: "Jan 2024",
                    sold_price: 510000,
                    sqft: 2650,
                    beds: 4,
                    baths: 3
                  },
                  {
                    address: "312 Fieldstone Ln",
                    sold_date: "Dec 2023",
                    sold_price: 475000,
                    sqft: 2380,
                    beds: 4,
                    baths: 2.5
                  }
                ]
              }
            }
            
            toolOutputs.push({
              tool_call_id: toolCall.id,
              output: JSON.stringify(propertyData)
            })
          } else {
            // Handle unknown function
            console.log(`⚠️ Unknown function called: ${toolCall.function.name}`)
            toolOutputs.push({
              tool_call_id: toolCall.id,
              output: JSON.stringify({
                error: `Unknown function: ${toolCall.function.name}`
              })
            })
          }
        }
        
        // Submit the function results back to the assistant
        console.log('📤 Submitting tool outputs:', toolOutputs)
        try {
          await openai.beta.threads.runs.submitToolOutputs(
            thread.id,
            run.id,
            { tool_outputs: toolOutputs }
          )
          console.log('✅ Tool outputs submitted successfully')
        } catch (submitError: any) {
          console.error('❌ Error submitting tool outputs:', submitError)
          throw submitError
        }
      }
      
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
      console.error('❌ Run failed:', runStatus.last_error)
      throw new Error(`Assistant run failed: ${runStatus.last_error?.message || 'Unknown error'}`)
    } else if (runStatus.status === 'requires_action') {
      console.error('❌ Run still requires action after max attempts')
      console.error('Last run status:', JSON.stringify(runStatus, null, 2))
      throw new Error('Assistant is waiting for function response but function handling failed')
    } else {
      console.error('❌ Unexpected run status:', runStatus.status)
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