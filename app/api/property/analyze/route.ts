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
      input: `You are a specialized real estate investment analyst focused on distressed property analysis for fix-and-flip investments in the Middle Tennessee area.

STEP 1: Use web search to find comprehensive data from Zillow, Redfin, Realtor.com and other real estate websites for: ${fullAddress}

STEP 2: Provide a complete real estate investment analysis following the exact structure below.

CRITICAL: Return ONLY a valid JSON object with no additional text. Your response must be a single JSON object that starts with { and ends with }.

Required JSON structure:

{
  "property_address": "${fullAddress}",
  "analysis_summary": {
    "investment_grade": "A",
    "estimated_arv": 320000,
    "estimated_purchase_price": 180000,
    "renovation_estimate": 45000,
    "projected_profit": 75000,
    "roi_percentage": 33.3,
    "risk_level": "Medium",
    "recommendation": "PROCEED",
    "estimated_repair_cost": 45000,
    "max_offer": 180000
  },
  "property_details": {
    "current_estimated_value": 285000,
    "square_footage": 1450,
    "bedrooms": 3,
    "bathrooms": 2,
    "lot_size": "0.25 acres",
    "year_built": 1985,
    "property_type": "Single Family Home"
  },
  "market_analysis": {
    "neighborhood_grade": "B+",
    "recent_sales_comparison": "Similar properties selling for $300k-$340k",
    "market_trend": "Stable with 3% annual appreciation",
    "days_on_market_average": 25,
    "absorption_rate": "Strong buyer demand",
    "comparable_sales": [
      {
        "address": "Similar nearby property",
        "sale_price": 310000,
        "square_footage": 1500,
        "price_per_sqft": 207
      }
    ]
  },
  "renovation_breakdown": {
    "kitchen": 15000,
    "bathrooms": 8000,
    "flooring": 6000,
    "paint_interior": 3000,
    "landscaping": 4000,
    "miscellaneous": 5000,
    "contingency_10_percent": 4100,
    "total_estimated": 45100
  },
  "financial_projections": {
    "purchase_price": 180000,
    "renovation_costs": 45000,
    "holding_costs": 8000,
    "selling_costs": 22000,
    "total_investment": 255000,
    "estimated_sale_price": 320000,
    "gross_profit": 65000,
    "roi_percentage": 25.5,
    "timeline_months": 4
  },
  "risk_assessment": {
    "market_risk": "Low - Stable Nashville market",
    "renovation_risk": "Medium - Potential for cost overruns",
    "timeline_risk": "Low - Standard renovation scope",
    "resale_risk": "Low - Strong buyer demand",
    "overall_risk": "Medium"
  },
  "neighborhood_analysis": {
    "school_rating": "7/10",
    "crime_rate": "Below metro average",
    "walkability": "6/10",
    "amenities": "Close to shopping and restaurants",
    "appreciation_trend": "Steady 3-4% annually"
  },
  "action_items": [
    "Schedule professional inspection within 7 days",
    "Get 3 contractor quotes for renovation estimate",
    "Research recent comparable sales within 0.5 miles",
    "Verify property taxes and any liens"
  ],
  "investment_recommendation": {
    "decision": "PROCEED",
    "confidence_level": "85%",
    "key_reasons": [
      "Strong neighborhood fundamentals",
      "Reasonable renovation scope",
      "Excellent ARV potential"
    ],
    "concerns": [
      "Market timing considerations",
      "Potential for cost overruns"
    ]
  }
}

IMPORTANT: 
- Replace ALL example values with actual data from your web searches
- Use real numbers (not strings) for all numeric values
- Base analysis on Middle Tennessee market conditions
- Include estimated_repair_cost and max_offer in analysis_summary
- Be conservative with renovation estimates (include 10% contingency)`
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
      console.log('🔍 Raw output text:', outputText.substring(0, 200) + '...')
      
      // Clean the output text first
      let cleanText = outputText.trim()
      
      // Remove any markdown code block formatting
      const codeBlockMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (codeBlockMatch && codeBlockMatch[1]) {
        cleanText = codeBlockMatch[1].trim()
        console.log('📝 Extracted from code block')
      }
      
      // Find the first complete JSON object
      let jsonStart = cleanText.indexOf('{')
      let jsonEnd = -1
      let braceCount = 0
      
      if (jsonStart !== -1) {
        for (let i = jsonStart; i < cleanText.length; i++) {
          if (cleanText[i] === '{') {
            braceCount++
          } else if (cleanText[i] === '}') {
            braceCount--
            if (braceCount === 0) {
              jsonEnd = i
              break
            }
          }
        }
      }
      
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonText = cleanText.substring(jsonStart, jsonEnd + 1)
        console.log('🎯 Attempting to parse JSON of length:', jsonText.length)
        analysisData = JSON.parse(jsonText)
        console.log('✅ Successfully parsed JSON response')
        
        // Validate required structure
        if (!analysisData.property_address) {
          analysisData.property_address = fullAddress
        }
      } else {
        throw new Error('No valid JSON object found in response')
      }
      
    } catch (parseError: any) {
      console.log('⚠️ JSON parsing failed:', parseError?.message || parseError)
      
      // Create a structured fallback response matching the new format
      analysisData = {
        property_address: fullAddress,
        analysis_summary: {
          investment_grade: "N/A",
          estimated_arv: null,
          estimated_purchase_price: null,
          renovation_estimate: null,
          projected_profit: null,
          roi_percentage: null,
          risk_level: "Unknown",
          recommendation: "MANUAL_REVIEW_REQUIRED",
          estimated_repair_cost: null,
          max_offer: null
        },
        property_details: {
          current_estimated_value: null,
          square_footage: null,
          bedrooms: null,
          bathrooms: null,
          lot_size: null,
          year_built: null,
          property_type: "Unknown"
        },
        market_analysis: {
          neighborhood_grade: "N/A",
          recent_sales_comparison: "Data unavailable",
          market_trend: "Data unavailable",
          days_on_market_average: null,
          absorption_rate: "Unknown",
          comparable_sales: []
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
        financial_projections: {
          purchase_price: null,
          renovation_costs: null,
          holding_costs: null,
          selling_costs: null,
          total_investment: null,
          estimated_sale_price: null,
          gross_profit: null,
          roi_percentage: null,
          timeline_months: null
        },
        risk_assessment: {
          market_risk: "Unknown",
          renovation_risk: "Unknown",
          timeline_risk: "Unknown",
          resale_risk: "Unknown",
          overall_risk: "Unknown"
        },
        neighborhood_analysis: {
          school_rating: "N/A",
          crime_rate: "Unknown",
          walkability: "N/A",
          amenities: "Unknown",
          appreciation_trend: "Unknown"
        },
        action_items: ["Manual review required due to parsing error"],
        investment_recommendation: {
          decision: "MANUAL_REVIEW_REQUIRED",
          confidence_level: "0%",
          key_reasons: [],
          concerns: ["Unable to parse AI response"]
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