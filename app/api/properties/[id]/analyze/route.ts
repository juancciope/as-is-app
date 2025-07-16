/**
 * Property Analysis API Endpoint
 * 
 * This endpoint analyzes a specific property and returns:
 * - Calculated score (0-100)
 * - Priority level (low/medium/high/urgent)
 * - Scoring factors breakdown
 * - Actionable recommendations
 * - Warnings about potential issues
 * - Optional AI-powered analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { scoreProperty, createDefaultScorer, type ScoreResult } from '@/lib/scoring';
import { FeatureFlags, DatabaseConfig, isAIAnalysisEnabled } from '@/lib/config';
import type { Property, DistressEvent, Contact, PropertyContact, InvestorRules } from '@/lib/supabase';

interface AnalysisResponse {
  property: Property;
  score: ScoreResult;
  aiAnalysis?: {
    summary: string;
    marketInsights: string[];
    riskFactors: string[];
    investmentStrategy: string;
  };
  metadata: {
    analyzedAt: string;
    scoringVersion: string;
    aiEnabled: boolean;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const propertyId = params.id;
    
    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Determine which table to query based on feature flags
    const tableName = FeatureFlags.USE_LEGACY ? DatabaseConfig.LEGACY_TABLE_NAME : 'properties';
    
    if (FeatureFlags.USE_LEGACY) {
      // Use legacy table structure
      return await analyzeLegacyProperty(propertyId);
    } else {
      // Use new normalized schema
      return await analyzeVNextProperty(propertyId);
    }

  } catch (error) {
    console.error('Property analysis error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to analyze property',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Analyze property using legacy table structure
 */
async function analyzeLegacyProperty(propertyId: string): Promise<NextResponse> {
  // Fetch legacy property data
  const { data: legacyProperty, error: legacyError } = await supabaseAdmin!
    .from(DatabaseConfig.LEGACY_TABLE_NAME)
    .select('*')
    .eq('id', propertyId)
    .single();

  if (legacyError || !legacyProperty) {
    return NextResponse.json(
      { error: 'Property not found' },
      { status: 404 }
    );
  }

  // Convert legacy data to normalized format for scoring
  const property: Property = {
    id: legacyProperty.id.toString(),
    full_address: legacyProperty.address,
    street: legacyProperty.address.split(',')[0]?.trim(),
    city: legacyProperty.city,
    state: 'TN',
    zip: undefined,
    county: legacyProperty.county,
    parcel_apn: undefined,
    lat: undefined,
    lon: undefined,
    distance_nash_mi: legacyProperty.distance_miles, // Legacy uses Nashville distance
    distance_mtjuliet_mi: undefined,
    within_30min_nash: legacyProperty.within_30min === 'Y',
    within_30min_mtjuliet: false,
    property_type: 'SFR',
    beds: undefined,
    baths: undefined,
    sqft: undefined,
    lot_sqft: undefined,
    data_confidence: 0.8,
    created_at: legacyProperty.created_at,
    updated_at: legacyProperty.updated_at
  };

  // Create distress event from legacy data
  const distressEvents: DistressEvent[] = [{
    id: `legacy-${legacyProperty.id}`,
    property_id: legacyProperty.id.toString(),
    event_type: 'FORECLOSURE',
    source: legacyProperty.source,
    event_date: legacyProperty.date,
    event_time: legacyProperty.time,
    firm: legacyProperty.firm,
    status: 'active',
    raw_data: legacyProperty,
    created_at: legacyProperty.created_at
  }];

  // Extract contacts from legacy columns
  const contacts: Contact[] = [];
  const propertyContacts: PropertyContact[] = [];
  
  // Check if legacy property has contact info
  const hasContact = legacyProperty.owner_email_1 || legacyProperty.owner_phone_1;
  
  if (hasContact) {
    const phones = [];
    const emails = [];
    
    // Extract phones
    for (let i = 1; i <= 5; i++) {
      const phone = legacyProperty[`owner_phone_${i}`];
      if (phone) {
        phones.push({
          number: phone,
          label: i === 1 ? 'primary' : 'secondary',
          verified: false,
          source: 'legacy'
        });
      }
    }
    
    // Extract emails
    for (let i = 1; i <= 5; i++) {
      const email = legacyProperty[`owner_email_${i}`];
      if (email) {
        emails.push({
          email: email,
          label: i === 1 ? 'primary' : 'secondary',
          verified: false,
          source: 'legacy'
        });
      }
    }
    
    const contact: Contact = {
      id: `legacy-contact-${legacyProperty.id}`,
      name_first: legacyProperty.owner_1_first_name,
      name_last: legacyProperty.owner_1_last_name,
      entity_name: undefined,
      contact_type: 'skiptrace_result',
      phones,
      emails,
      mailing_address: undefined,
      notes: 'Migrated from legacy system',
      created_at: legacyProperty.created_at,
      updated_at: legacyProperty.updated_at
    };
    
    contacts.push(contact);
    
    propertyContacts.push({
      property_id: legacyProperty.id.toString(),
      contact_id: contact.id,
      role: 'skiptrace',
      confidence: 0.7,
      last_validated_at: undefined
    });
  }

  // Calculate score
  const scoreResult = scoreProperty(property, distressEvents, contacts, propertyContacts);
  
  // Generate AI analysis if enabled
  const aiAnalysis = isAIAnalysisEnabled() 
    ? await generateAIAnalysis(property, scoreResult)
    : undefined;

  const response: AnalysisResponse = {
    property,
    score: scoreResult,
    aiAnalysis,
    metadata: {
      analyzedAt: new Date().toISOString(),
      scoringVersion: 'v1.0-legacy',
      aiEnabled: isAIAnalysisEnabled()
    }
  };

  return NextResponse.json(response);
}

/**
 * Analyze property using vNext normalized schema
 */
async function analyzeVNextProperty(propertyId: string): Promise<NextResponse> {
  // Fetch property data
  const { data: property, error: propertyError } = await supabaseAdmin!
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single();

  if (propertyError || !property) {
    return NextResponse.json(
      { error: 'Property not found' },
      { status: 404 }
    );
  }

  // Fetch distress events
  const { data: distressEvents, error: eventsError } = await supabaseAdmin!
    .from('distress_events')
    .select('*')
    .eq('property_id', propertyId)
    .order('event_date', { ascending: false });

  if (eventsError) {
    console.error('Error fetching distress events:', eventsError);
  }

  // Fetch contacts through property_contacts relationship
  const { data: propertyContacts, error: pcError } = await supabaseAdmin!
    .from('property_contacts')
    .select(`
      *,
      contacts (*)
    `)
    .eq('property_id', propertyId);

  if (pcError) {
    console.error('Error fetching property contacts:', pcError);
  }

  // Extract contacts from the relationship
  const contacts: Contact[] = propertyContacts?.map(pc => (pc as any).contacts).filter(Boolean) || [];

  // Fetch investor rules
  const { data: investorRules, error: rulesError } = await supabaseAdmin!
    .from('investor_rules')
    .select('*')
    .limit(1)
    .single();

  if (rulesError) {
    console.error('Error fetching investor rules:', rulesError);
  }

  // Calculate score
  const scorer = investorRules 
    ? new (await import('@/lib/scoring')).PropertyScorer(investorRules)
    : createDefaultScorer();

  const context = {
    property,
    events: distressEvents || [],
    contacts,
    propertyContacts: propertyContacts || [],
    investorRules: investorRules || scorer['investorRules']
  };

  const scoreResult = scorer.score(context);

  // Generate AI analysis if enabled
  const aiAnalysis = isAIAnalysisEnabled() 
    ? await generateAIAnalysis(property, scoreResult)
    : undefined;

  const response: AnalysisResponse = {
    property,
    score: scoreResult,
    aiAnalysis,
    metadata: {
      analyzedAt: new Date().toISOString(),
      scoringVersion: 'v1.0-vnext',
      aiEnabled: isAIAnalysisEnabled()
    }
  };

  return NextResponse.json(response);
}

/**
 * Generate AI-powered analysis (optional)
 */
async function generateAIAnalysis(
  property: Property, 
  scoreResult: ScoreResult
): Promise<AnalysisResponse['aiAnalysis']> {
  if (!isAIAnalysisEnabled()) {
    return undefined;
  }

  try {
    // This would integrate with OpenAI API or similar
    // For now, return a template-based analysis
    return {
      summary: generateTemplateSummary(property, scoreResult),
      marketInsights: generateMarketInsights(property, scoreResult),
      riskFactors: generateRiskFactors(property, scoreResult),
      investmentStrategy: generateInvestmentStrategy(property, scoreResult)
    };
  } catch (error) {
    console.error('AI analysis failed:', error);
    return undefined;
  }
}

/**
 * Generate template-based summary
 */
function generateTemplateSummary(property: Property, scoreResult: ScoreResult): string {
  const priorityText = {
    urgent: 'URGENT OPPORTUNITY',
    high: 'High-Value Opportunity',
    medium: 'Moderate Opportunity',
    low: 'Low-Priority Opportunity'
  };

  const locationText = property.within_30min_nash || property.within_30min_mtjuliet 
    ? 'in a prime location' 
    : 'outside the primary target area';

  const urgencyText = scoreResult.urgencyDays 
    ? `with ${scoreResult.urgencyDays} days until the foreclosure event`
    : 'with no immediate time pressure';

  return `${priorityText[scoreResult.priority]} - This ${property.property_type || 'property'} is ${locationText} ${urgencyText}. Score: ${scoreResult.score}/100.`;
}

/**
 * Generate market insights
 */
function generateMarketInsights(property: Property, scoreResult: ScoreResult): string[] {
  const insights: string[] = [];

  if (property.county === 'Davidson') {
    insights.push('Davidson County has strong rental demand and appreciation potential');
  }

  if (property.within_30min_nash) {
    insights.push('Close proximity to Nashville provides good rental income potential');
  }

  if (property.within_30min_mtjuliet) {
    insights.push('Mt. Juliet area is experiencing significant growth and development');
  }

  if (scoreResult.urgencyDays && scoreResult.urgencyDays <= 14) {
    insights.push('Limited time creates potential for below-market acquisition');
  }

  return insights;
}

/**
 * Generate risk factors
 */
function generateRiskFactors(property: Property, scoreResult: ScoreResult): string[] {
  const risks: string[] = [];

  if (!property.within_30min_nash && !property.within_30min_mtjuliet) {
    risks.push('Property location may limit rental demand and resale value');
  }

  if (scoreResult.factors.hasContact === 0) {
    risks.push('No owner contact information available - may require additional research');
  }

  if (scoreResult.urgencyDays && scoreResult.urgencyDays <= 7) {
    risks.push('Very short timeline may limit due diligence opportunities');
  }

  if (!property.lat || !property.lon) {
    risks.push('Property location not verified - requires additional research');
  }

  return risks;
}

/**
 * Generate investment strategy
 */
function generateInvestmentStrategy(property: Property, scoreResult: ScoreResult): string {
  if (scoreResult.priority === 'urgent') {
    return 'IMMEDIATE ACTION: Contact owner immediately, prepare for quick due diligence, and have financing ready. Consider competitive offer above minimum bid.';
  }

  if (scoreResult.priority === 'high') {
    return 'HIGH PRIORITY: Schedule property inspection within 2-3 days, contact owner if possible, and prepare financing. Good candidate for rental or flip strategy.';
  }

  if (scoreResult.priority === 'medium') {
    return 'MODERATE PRIORITY: Research property thoroughly, consider market conditions, and evaluate against other opportunities. May be good for buy-and-hold strategy.';
  }

  return 'LOW PRIORITY: Monitor for changes in status or pricing. Consider only if no higher-priority opportunities are available.';
}

// Exports are handled automatically by Next.js for named exports