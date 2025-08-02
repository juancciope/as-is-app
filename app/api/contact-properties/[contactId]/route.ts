import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, ContactProperties, ContactProperty } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { data: contactProperties, error } = await supabaseAdmin
      .from('contact_properties')
      .select('*')
      .eq('contact_id', params.contactId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error fetching contact properties:', error)
      return NextResponse.json(
        { error: 'Failed to fetch contact properties' },
        { status: 500 }
      )
    }

    // If no record found, return empty properties array
    if (!contactProperties) {
      return NextResponse.json({
        success: true,
        properties: [],
        message: 'No properties found for this contact'
      })
    }

    return NextResponse.json({
      success: true,
      properties: contactProperties.properties || [],
      lastUpdated: contactProperties.updated_at
    })

  } catch (error: any) {
    console.error('Error in contact properties GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { properties } = await request.json()

    if (!Array.isArray(properties)) {
      return NextResponse.json(
        { error: 'Properties must be an array' },
        { status: 400 }
      )
    }

    // Upsert (insert or update) the contact properties
    const { data, error } = await supabaseAdmin
      .from('contact_properties')
      .upsert({
        contact_id: params.contactId,
        properties: properties,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'contact_id'
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving contact properties:', error)
      return NextResponse.json(
        { error: 'Failed to save contact properties' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Contact properties saved successfully',
      properties: data.properties,
      lastUpdated: data.updated_at
    })

  } catch (error: any) {
    console.error('Error in contact properties POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}