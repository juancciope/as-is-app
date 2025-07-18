import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Get the same filters as the main data endpoint
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const counties = searchParams.get('counties');
    const sources = searchParams.get('sources');
    const targetCounties = searchParams.get('targetCounties');
    const saleDateFrom = searchParams.get('saleDateFrom');
    const saleDateTo = searchParams.get('saleDateTo');
    const createdDateFrom = searchParams.get('createdDateFrom');
    const createdDateTo = searchParams.get('createdDateTo');
    const enrichmentStatus = searchParams.get('enrichmentStatus');

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Build query to get contacts from filtered properties
    // Check if contacts exist via property_contacts relationship
    let query = supabaseAdmin
      .from('properties')
      .select(`
        id,
        full_address,
        city,
        county,
        created_at,
        distress_events!inner (
          event_date,
          source,
          sale_date
        ),
        property_contacts (
          contacts (
            id,
            emails,
            phones,
            created_at,
            updated_at
          )
        )
      `);

    // Apply the same filters as the main data endpoint
    if (dateFrom || dateTo) {
      if (dateFrom) {
        query = query.filter('distress_events.event_date', 'gte', dateFrom);
      }
      if (dateTo) {
        query = query.filter('distress_events.event_date', 'lte', dateTo);
      }
    }

    if (counties && counties !== '') {
      const countyList = counties.split(',').map(c => c.trim()).filter(c => c.length > 0);
      if (countyList.length > 0) {
        query = query.in('county', countyList);
      }
    }

    if (sources && sources !== '') {
      const sourceList = sources.split(',').map(s => s.trim()).filter(s => s.length > 0);
      if (sourceList.length > 0) {
        query = query.filter('distress_events.source', 'in', `(${sourceList.join(',')})`);
      }
    }

    if (targetCounties && targetCounties !== '') {
      const countyList = targetCounties.split(',').map(c => c.trim()).filter(c => c.length > 0);
      if (countyList.length > 0) {
        query = query.in('county', countyList);
      }
    }

    if (saleDateFrom || saleDateTo) {
      if (saleDateFrom) {
        query = query.filter('distress_events.sale_date', 'gte', saleDateFrom);
      }
      if (saleDateTo) {
        query = query.filter('distress_events.sale_date', 'lte', saleDateTo);
      }
    }

    if (createdDateFrom || createdDateTo) {
      if (createdDateFrom) {
        query = query.gte('created_at', createdDateFrom);
      }
      if (createdDateTo) {
        const endOfDay = new Date(createdDateTo);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }
    }

    // Filter by enrichment status if specified
    if (enrichmentStatus === 'enriched') {
      // Only include properties that have contacts
      // This is already handled by the inner join on property_contacts
    } else if (enrichmentStatus === 'needs_enrichment') {
      // This endpoint only returns properties with contacts, so skip this filter
      return NextResponse.json({
        contacts: [],
        total: 0,
        message: 'No contacts available for properties that need enrichment'
      });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Contacts query error:', error);
      return NextResponse.json(
        { 
          error: 'Failed to fetch contacts', 
          details: error.message
        },
        { status: 500 }
      );
    }

    // Extract unique contacts from properties with contact data
    const contactsMap = new Map();

    (data || []).forEach((property: any) => {
      property.property_contacts?.forEach((pc: any) => {
        const contact = pc.contacts;
        if (contact) {
          const contactId = contact.id;
          
          // Add contact to map if not already present
          if (!contactsMap.has(contactId)) {
            contactsMap.set(contactId, {
              id: contact.id,
              first_name: 'Property',
              last_name: 'Owner',
              full_name: 'Property Owner',
              emails: contact.emails || [],
              phones: contact.phones || [],
              address: property.full_address,
              city: property.city,
              state: 'TN',
              zip: '',
              created_at: contact.created_at,
              updated_at: contact.updated_at,
              properties: []
            });
          }

          // Add property to contact's properties list
          const contactData = contactsMap.get(contactId);
          contactData.properties.push({
            id: property.id,
            address: property.full_address,
            city: property.city,
            county: property.county,
            sale_date: property.distress_events?.[0]?.sale_date,
            source: property.distress_events?.[0]?.source
          });
        }
      });
    });

    const contacts = Array.from(contactsMap.values());

    return NextResponse.json({
      contacts,
      total: contacts.length,
      totalProperties: contacts.length,
      metadata: {
        lastUpdated: new Date().toISOString(),
        filtersApplied: {
          dateFrom,
          dateTo,
          counties,
          sources,
          targetCounties,
          saleDateFrom,
          saleDateTo,
          createdDateFrom,
          createdDateTo,
          enrichmentStatus
        }
      }
    });

  } catch (error) {
    console.error('Contacts API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch contacts', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}