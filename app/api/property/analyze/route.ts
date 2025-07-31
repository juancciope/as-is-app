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

    const prompt = `I am looking to purchase distressed properties as an investment and fix them up to flip them. I am located in the middle Tennessee area. 

Please search the web and give me a comprehensive overview of the property at: ${fullAddress}

Include all information I would need to make an investment decision, such as:
- Current estimated value and recent sales history
- Property details (square footage, bedrooms, bathrooms, lot size, year built)
- Neighborhood analysis and comparable sales
- Local market trends and appreciation rates
- Potential renovation costs and ARV (After Repair Value)
- Investment potential and ROI analysis
- Any liens, tax information, or property issues
- School ratings and neighborhood amenities
- Crime rates and safety information
- Rental income potential if applicable

Format the response in clear sections with headers. Be specific with numbers and data when available.`

    console.log('🏠 Analyzing property:', fullAddress)

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are a real estate investment analyst. Search the web for property information and provide detailed investment analysis. Use current market data and be specific with numbers when available."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })

    const analysis = completion.choices[0].message.content

    return NextResponse.json({
      success: true,
      analysis,
      address: fullAddress,
      timestamp: new Date().toISOString()
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