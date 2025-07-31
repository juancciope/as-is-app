import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabaseAdmin, PropertyAnalysisReport } from '../../../../lib/supabase'

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
    
    console.log('🏠 Analyzing property with web search:', fullAddress)
    
    // Use Responses API with web search instead of Assistants API
    const response = await openai.responses.create({
      model: "gpt-4.1",
      tools: [{ 
        type: "web_search_preview",
        user_location: {
          type: "approximate",
          country: "US",
          city: "Nashville",
          region: "Tennessee"
        }
      }],
      input: `I am looking to purchase distressed properties as an investment and fix them up to flip them. I am located in the middle Tennessee area. 

Give me an overview of the information you have about the following address, including all information I would need to make an investment decision:

${fullAddress}

Please search Zillow, Redfin, Realtor.com, and other real estate websites to find current, accurate data for this property. I need:

1. Current market value/Zestimate from multiple sources
2. Property details (square footage, bedrooms, bathrooms, year built, lot size)
3. Recent comparable sales in the neighborhood with actual addresses and sale prices
4. Property tax information
5. Neighborhood analysis and market trends
6. Price history if available

Based on the real data you find through web search, provide a comprehensive real estate investment analysis in JSON format:

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
    "recent_sales_comparison": "[description with actual addresses and prices]",
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
  "data_sources": {
    "web_searches_performed": true,
    "sources_found": ["list of actual URLs"],
    "data_quality": "Current market data from web search",
    "last_updated": "${new Date().toISOString()}"
  }
}

CRITICAL: You MUST perform web searches to get real, current data. Do not use estimates or general knowledge. Base your entire analysis on actual data found through web search of real estate websites.`
    })

    console.log('✅ Web search response received')
    
    // Extract the analysis from the response
    const outputText = response.output_text
    const webSearchCalls = response.output?.filter(item => item.type === 'web_search_call') || []
    const messageContent = response.output?.find(item => item.type === 'message')
    
    console.log(`🔍 Web searches performed: ${webSearchCalls.length}`)
    
    // Extract citations/sources
    const firstContent = messageContent?.content?.[0]
    const citations = (firstContent && 'annotations' in firstContent) ? firstContent.annotations || [] : []
    const sourceUrls = citations
      .filter((annotation: any) => annotation.type === 'url_citation')
      .map((citation: any) => ({
        url: citation.url,
        title: citation.title,
        text_reference: outputText.substring(citation.start_index, citation.end_index)
      }))

    console.log(`📚 Sources found: ${sourceUrls.length}`)
    
    // Try to parse JSON response from the output
    let analysisData
    try {
      // First try to extract JSON from markdown code blocks
      const jsonMatch = outputText.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonMatch && jsonMatch[1]) {
        analysisData = JSON.parse(jsonMatch[1])
      } else {
        // Try to find any JSON-like content
        const jsonStart = outputText.indexOf('{')
        const jsonEnd = outputText.lastIndexOf('}')
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          const possibleJson = outputText.substring(jsonStart, jsonEnd + 1)
          analysisData = JSON.parse(possibleJson)
        } else {
          throw new Error('No JSON found')
        }
      }
    } catch {
      // If JSON parsing fails, structure the text response
      analysisData = {
        property_address: fullAddress,
        analysis_text: outputText,
        web_search_performed: webSearchCalls.length > 0,
        sources_found: sourceUrls.length,
        recommendation: "See detailed analysis above",
        data_sources: {
          web_searches_performed: webSearchCalls.length > 0,
          sources_found: sourceUrls.map(s => s.url),
          data_quality: webSearchCalls.length > 0 ? "Current market data from web search" : "Limited data available",
          last_updated: new Date().toISOString()
        }
      }
    }

    // Add source information to the analysis
    if (analysisData && typeof analysisData === 'object') {
      analysisData.web_search_results = {
        searches_performed: webSearchCalls.length,
        sources_found: sourceUrls,
        search_quality: webSearchCalls.length > 0 ? 'high' : 'none'
      }
    }

    // Store the analysis report in the database
    let reportId: string | null = null
    if (supabaseAdmin) {
      try {
        console.log('💾 Storing property analysis report in database...')
        
        const reportData: Omit<PropertyAnalysisReport, 'id' | 'created_at' | 'updated_at'> = {
          property_address: fullAddress,
          city: city,
          state: state,
          zip_code: zipCode || null,
          analysis_data: analysisData,
          method: 'web_search',
          web_searches_performed: webSearchCalls.length,
          sources_found: sourceUrls.length,
          source_urls: sourceUrls,
          confidence_score: webSearchCalls.length > 0 ? 0.85 : 0.50 // Higher confidence with web searches
        }
        
        const { data: savedReport, error: saveError } = await supabaseAdmin
          .from('property_analysis_reports')
          .insert(reportData)
          .select('id')
          .single()
        
        if (saveError) {
          console.error('❌ Error saving property analysis report:', saveError)
        } else {
          reportId = savedReport.id
          console.log('✅ Property analysis report saved with ID:', reportId)
        }
      } catch (error) {
        console.error('❌ Error storing analysis report:', error)
      }
    }

    return NextResponse.json({
      success: true,
      data: analysisData,
      address: fullAddress,
      timestamp: new Date().toISOString(),
      method: 'web_search',
      web_searches_performed: webSearchCalls.length,
      sources_found: sourceUrls.length,
      report_id: reportId // Include the database ID for reference
    })

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