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
      input: `Search for property information for the address: ${fullAddress}

Please search Zillow, Redfin, Realtor.com and other real estate websites for this exact property address. After gathering the data, provide a comprehensive real estate investment analysis for a fix-and-flip investor.

Return your response as a JSON object with this structure:

{
  "property_address": "${fullAddress}",
  "property_details": {
    "current_estimated_value": 0,
    "square_footage": 0, 
    "bedrooms": 0,
    "bathrooms": 0,
    "year_built": 0,
    "property_type": "Single Family"
  },
  "market_analysis": {
    "comparable_sales": [
      {
        "address": "123 Example St",
        "sale_price": 250000,
        "square_footage": 1500,
        "price_per_sqft": 167
      }
    ],
    "market_trend": "Stable",
    "days_on_market_average": 30
  },
  "investment_analysis": {
    "estimated_arv": 0,
    "estimated_purchase_price": 0,
    "renovation_estimate": 0,
    "projected_profit": 0,
    "roi_percentage": 0,
    "investment_grade": "B",
    "recommendation": "PROCEED_WITH_CAUTION"
  },
  "renovation_breakdown": {
    "kitchen": 15000,
    "bathrooms": 8000,
    "flooring": 5000,
    "paint_interior": 3000,
    "landscaping": 2000,
    "miscellaneous": 5000,
    "contingency_10_percent": 3800,
    "total_estimated": 41800
  }
}`
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
    
    // Parse JSON response with improved error handling
    let analysisData
    try {
      // Clean the output text first
      let cleanText = outputText.trim()
      
      // Remove any markdown code block formatting
      const codeBlockMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (codeBlockMatch && codeBlockMatch[1]) {
        cleanText = codeBlockMatch[1].trim()
      }
      
      // Find JSON object boundaries
      const jsonStart = cleanText.indexOf('{')
      const jsonEnd = cleanText.lastIndexOf('}')
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        const jsonText = cleanText.substring(jsonStart, jsonEnd + 1)
        analysisData = JSON.parse(jsonText)
        console.log('✅ Successfully parsed JSON response')
      } else {
        throw new Error('No valid JSON object found in response')
      }
      
    } catch (parseError) {
      console.log('⚠️ JSON parsing failed:', parseError)
      
      // Create a structured fallback response
      analysisData = {
        property_address: fullAddress,
        property_details: {
          current_estimated_value: null,
          square_footage: null,
          bedrooms: null,
          bathrooms: null,
          year_built: null,
          property_type: "Unknown"
        },
        market_analysis: {
          comparable_sales: [],
          market_trend: "Data unavailable",
          days_on_market_average: null
        },
        investment_analysis: {
          estimated_arv: null,
          estimated_purchase_price: null,
          renovation_estimate: null,
          projected_profit: null,
          roi_percentage: null,
          investment_grade: "N/A",
          recommendation: "MANUAL_REVIEW_REQUIRED"
        },
        renovation_breakdown: {
          kitchen: null,
          bathrooms: null,
          flooring: null,
          paint_interior: null,
          landscaping: null,
          miscellaneous: null,
          contingency_10_percent: null,
          total_estimated: null
        },
        parsing_error: true,
        raw_response: outputText.substring(0, 500),
        error_message: "Unable to parse AI response. Manual review required."
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