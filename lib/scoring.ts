/**
 * vNext Property Scoring System
 * 
 * This module implements a rule-based scoring algorithm to help determine
 * "Which properties matter most?" for real estate investors. The scoring
 * system evaluates properties based on configurable criteria and weights.
 * 
 * Score Range: 0-100
 * - 0-25: Low priority
 * - 26-50: Medium priority  
 * - 51-75: High priority
 * - 76-100: Urgent priority
 */

import { VNextConfig, ScoringWeights, isTargetCounty } from './config';
import type { 
  Property, 
  DistressEvent, 
  Contact, 
  PropertyContact, 
  InvestorRules,
  PropertyWithEvents 
} from './supabase';

// ======================
// Type Definitions
// ======================

export interface ScoreFactors {
  countyMatch: number;
  driveTimeNash: number;
  driveTimeMtJuliet: number;
  daysToEvent: number;
  hasContact: number;
  propertyTypeMatch: number;
  total: number;
}

export interface ScoreExplanation {
  factor: string;
  points: number;
  reason: string;
  weight: number;
}

export interface ScoreResult {
  score: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  factors: ScoreFactors;
  explanations: ScoreExplanation[];
  urgencyDays?: number;
  recommendations: string[];
  warnings: string[];
}

export interface ScoringContext {
  property: Property;
  events: DistressEvent[];
  contacts: Contact[];
  propertyContacts: PropertyContact[];
  investorRules: InvestorRules;
  currentDate?: Date;
}

// ======================
// Scoring Algorithm
// ======================

export class PropertyScorer {
  private currentDate: Date;
  private investorRules: InvestorRules;

  constructor(investorRules: InvestorRules, currentDate?: Date) {
    this.investorRules = investorRules;
    this.currentDate = currentDate || new Date();
  }

  /**
   * Calculate the overall score for a property
   */
  score(context: ScoringContext): ScoreResult {
    const factors: ScoreFactors = {
      countyMatch: this.scoreCountyMatch(context),
      driveTimeNash: this.scoreDriveTimeNash(context),
      driveTimeMtJuliet: this.scoreDriveTimeMtJuliet(context),
      daysToEvent: this.scoreDaysToEvent(context),
      hasContact: this.scoreHasContact(context),
      propertyTypeMatch: this.scorePropertyTypeMatch(context),
      total: 0
    };

    // Calculate total score
    factors.total = Math.min(100, Math.max(0, 
      factors.countyMatch + 
      factors.driveTimeNash + 
      factors.driveTimeMtJuliet + 
      factors.daysToEvent + 
      factors.hasContact + 
      factors.propertyTypeMatch
    ));

    // Generate explanations
    const explanations = this.generateExplanations(context, factors);
    
    // Determine priority level
    const priority = this.determinePriority(factors.total);
    
    // Calculate urgency
    const urgencyDays = this.calculateUrgencyDays(context);
    
    // Generate recommendations and warnings
    const recommendations = this.generateRecommendations(context, factors);
    const warnings = this.generateWarnings(context, factors);

    return {
      score: Math.round(factors.total),
      priority,
      factors,
      explanations,
      urgencyDays,
      recommendations,
      warnings
    };
  }

  /**
   * Score based on county match with target counties
   */
  private scoreCountyMatch(context: ScoringContext): number {
    const { property } = context;
    const targetCounties = this.investorRules.config.target_counties || VNextConfig.TARGET_COUNTIES;
    
    if (!property.county) return 0;
    
    const isTarget = targetCounties.includes(property.county);
    return isTarget ? ScoringWeights.COUNTY_MATCH : 0;
  }

  /**
   * Score based on drive time to Nashville
   */
  private scoreDriveTimeNash(context: ScoringContext): number {
    const { property } = context;
    const maxDriveTime = this.investorRules.config.max_drive_time_min || VNextConfig.MAX_DRIVE_TIME_MIN;
    
    if (!property.within_30min_nash) return 0;
    
    // Give higher scores for closer properties
    if (property.distance_nash_mi && property.distance_nash_mi <= 10) {
      return ScoringWeights.DRIVE_TIME_NASH;
    } else if (property.distance_nash_mi && property.distance_nash_mi <= 20) {
      return Math.round(ScoringWeights.DRIVE_TIME_NASH * 0.8);
    } else {
      return Math.round(ScoringWeights.DRIVE_TIME_NASH * 0.6);
    }
  }

  /**
   * Score based on drive time to Mt. Juliet
   */
  private scoreDriveTimeMtJuliet(context: ScoringContext): number {
    const { property } = context;
    const maxDriveTime = this.investorRules.config.max_drive_time_min || VNextConfig.MAX_DRIVE_TIME_MIN;
    
    if (!property.within_30min_mtjuliet) return 0;
    
    // Give higher scores for closer properties
    if (property.distance_mtjuliet_mi && property.distance_mtjuliet_mi <= 10) {
      return ScoringWeights.DRIVE_TIME_MTJULIET;
    } else if (property.distance_mtjuliet_mi && property.distance_mtjuliet_mi <= 20) {
      return Math.round(ScoringWeights.DRIVE_TIME_MTJULIET * 0.8);
    } else {
      return Math.round(ScoringWeights.DRIVE_TIME_MTJULIET * 0.6);
    }
  }

  /**
   * Score based on days until next event
   */
  private scoreDaysToEvent(context: ScoringContext): number {
    const { events } = context;
    
    if (!events || events.length === 0) return 0;
    
    // Find the next upcoming event
    const upcomingEvents = events
      .filter(event => event.event_date && event.status === 'active')
      .map(event => ({
        ...event,
        daysUntil: this.calculateDaysUntil(event.event_date!)
      }))
      .filter(event => event.daysUntil >= 0)
      .sort((a, b) => a.daysUntil - b.daysUntil);
    
    if (upcomingEvents.length === 0) return 0;
    
    const nextEvent = upcomingEvents[0];
    const daysUntil = nextEvent.daysUntil;
    
    // Score based on urgency
    if (daysUntil <= 7) {
      return ScoringWeights.DAYS_TO_EVENT_URGENT;
    } else if (daysUntil <= 14) {
      return ScoringWeights.DAYS_TO_EVENT_SOON;
    } else if (daysUntil <= 30) {
      return ScoringWeights.DAYS_TO_EVENT_MODERATE;
    } else {
      return Math.round(ScoringWeights.DAYS_TO_EVENT_MODERATE * 0.5);
    }
  }

  /**
   * Score based on whether property has contact information
   */
  private scoreHasContact(context: ScoringContext): number {
    const { contacts, propertyContacts } = context;
    
    if (!contacts || !propertyContacts || contacts.length === 0) return 0;
    
    // Check if any contacts have phone numbers or emails
    const hasValidContact = contacts.some(contact => {
      const hasPhone = contact.phones && Array.isArray(contact.phones) && contact.phones.length > 0;
      const hasEmail = contact.emails && Array.isArray(contact.emails) && contact.emails.length > 0;
      return hasPhone || hasEmail;
    });
    
    return hasValidContact ? ScoringWeights.HAS_CONTACT : 0;
  }

  /**
   * Score based on property type match
   */
  private scorePropertyTypeMatch(context: ScoringContext): number {
    const { property } = context;
    const targetTypes = this.investorRules.config.property_types || ['SFR'];
    
    if (!property.property_type) return 0;
    
    const isTargetType = targetTypes.includes(property.property_type);
    return isTargetType ? ScoringWeights.PROPERTY_TYPE_MATCH : 0;
  }

  /**
   * Calculate days until a given date
   */
  private calculateDaysUntil(dateString: string): number {
    const targetDate = new Date(dateString);
    const diffTime = targetDate.getTime() - this.currentDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate urgency in days (days until next event)
   */
  private calculateUrgencyDays(context: ScoringContext): number | undefined {
    const { events } = context;
    
    if (!events || events.length === 0) return undefined;
    
    const upcomingEvents = events
      .filter(event => event.event_date && event.status === 'active')
      .map(event => this.calculateDaysUntil(event.event_date!))
      .filter(days => days >= 0)
      .sort((a, b) => a - b);
    
    return upcomingEvents.length > 0 ? upcomingEvents[0] : undefined;
  }

  /**
   * Determine priority level based on total score
   */
  private determinePriority(totalScore: number): 'low' | 'medium' | 'high' | 'urgent' {
    if (totalScore >= 76) return 'urgent';
    if (totalScore >= 51) return 'high';
    if (totalScore >= 26) return 'medium';
    return 'low';
  }

  /**
   * Generate human-readable explanations for the score
   */
  private generateExplanations(context: ScoringContext, factors: ScoreFactors): ScoreExplanation[] {
    const explanations: ScoreExplanation[] = [];
    
    // County match explanation
    if (factors.countyMatch > 0) {
      explanations.push({
        factor: 'County Match',
        points: factors.countyMatch,
        reason: `Property is in ${context.property.county} county (target area)`,
        weight: ScoringWeights.COUNTY_MATCH
      });
    } else if (context.property.county) {
      explanations.push({
        factor: 'County Match',
        points: 0,
        reason: `Property is in ${context.property.county} county (not a target area)`,
        weight: ScoringWeights.COUNTY_MATCH
      });
    }
    
    // Drive time explanations
    if (factors.driveTimeNash > 0) {
      const distance = context.property.distance_nash_mi;
      explanations.push({
        factor: 'Nashville Proximity',
        points: factors.driveTimeNash,
        reason: `Within 30 minutes of Nashville${distance ? ` (${distance} miles)` : ''}`,
        weight: ScoringWeights.DRIVE_TIME_NASH
      });
    }
    
    if (factors.driveTimeMtJuliet > 0) {
      const distance = context.property.distance_mtjuliet_mi;
      explanations.push({
        factor: 'Mt. Juliet Proximity',
        points: factors.driveTimeMtJuliet,
        reason: `Within 30 minutes of Mt. Juliet${distance ? ` (${distance} miles)` : ''}`,
        weight: ScoringWeights.DRIVE_TIME_MTJULIET
      });
    }
    
    // Days to event explanation
    if (factors.daysToEvent > 0) {
      const urgencyDays = this.calculateUrgencyDays(context);
      if (urgencyDays !== undefined) {
        let urgencyText = '';
        if (urgencyDays <= 7) urgencyText = 'Very urgent';
        else if (urgencyDays <= 14) urgencyText = 'Urgent';
        else if (urgencyDays <= 30) urgencyText = 'Moderate urgency';
        else urgencyText = 'Low urgency';
        
        explanations.push({
          factor: 'Time to Event',
          points: factors.daysToEvent,
          reason: `${urgencyText} - ${urgencyDays} days until next foreclosure event`,
          weight: ScoringWeights.DAYS_TO_EVENT_URGENT
        });
      }
    }
    
    // Contact availability explanation
    if (factors.hasContact > 0) {
      explanations.push({
        factor: 'Contact Information',
        points: factors.hasContact,
        reason: 'Has owner contact information available',
        weight: ScoringWeights.HAS_CONTACT
      });
    } else {
      explanations.push({
        factor: 'Contact Information',
        points: 0,
        reason: 'No owner contact information available',
        weight: ScoringWeights.HAS_CONTACT
      });
    }
    
    // Property type explanation
    if (factors.propertyTypeMatch > 0) {
      explanations.push({
        factor: 'Property Type',
        points: factors.propertyTypeMatch,
        reason: `Property type (${context.property.property_type}) matches investment criteria`,
        weight: ScoringWeights.PROPERTY_TYPE_MATCH
      });
    }
    
    return explanations;
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(context: ScoringContext, factors: ScoreFactors): string[] {
    const recommendations: string[] = [];
    const urgencyDays = this.calculateUrgencyDays(context);
    
    // Time-based recommendations
    if (urgencyDays !== undefined) {
      if (urgencyDays <= 7) {
        recommendations.push('🚨 URGENT: Contact property owner immediately - foreclosure in 7 days or less');
      } else if (urgencyDays <= 14) {
        recommendations.push('⚡ HIGH PRIORITY: Contact property owner within 2-3 days');
      } else if (urgencyDays <= 30) {
        recommendations.push('📅 MODERATE: Schedule property evaluation and owner contact within 1 week');
      }
    }
    
    // Contact-based recommendations
    if (factors.hasContact === 0) {
      recommendations.push('🔍 Run skip trace to find owner contact information');
    } else {
      recommendations.push('📞 Contact information available - ready for outreach');
    }
    
    // Location-based recommendations
    if (factors.driveTimeNash > 0 || factors.driveTimeMtJuliet > 0) {
      recommendations.push('🏠 Good location for rental or flip investment');
    }
    
    // County-based recommendations
    if (factors.countyMatch > 0) {
      recommendations.push('🎯 Property in target county - fits investment criteria');
    }
    
    // Score-based recommendations
    if (factors.total >= 76) {
      recommendations.push('⭐ TOP PRIORITY: This property scores in the top tier');
    } else if (factors.total >= 51) {
      recommendations.push('✅ HIGH VALUE: Strong investment opportunity');
    } else if (factors.total >= 26) {
      recommendations.push('📊 MODERATE: Review property details carefully');
    } else {
      recommendations.push('📋 LOW PRIORITY: Consider if other opportunities are limited');
    }
    
    return recommendations;
  }

  /**
   * Generate warnings about potential issues
   */
  private generateWarnings(context: ScoringContext, factors: ScoreFactors): string[] {
    const warnings: string[] = [];
    
    // Location warnings
    if (factors.driveTimeNash === 0 && factors.driveTimeMtJuliet === 0) {
      warnings.push('⚠️ Property is outside 30-minute drive time from target areas');
    }
    
    // County warnings
    if (factors.countyMatch === 0) {
      warnings.push('⚠️ Property is not in a target county');
    }
    
    // Contact warnings
    if (factors.hasContact === 0) {
      warnings.push('⚠️ No owner contact information available - will need skip trace');
    }
    
    // Time warnings
    const urgencyDays = this.calculateUrgencyDays(context);
    if (urgencyDays !== undefined && urgencyDays <= 3) {
      warnings.push('🚨 CRITICAL: Foreclosure event in 3 days or less');
    }
    
    // Data quality warnings
    if (!context.property.lat || !context.property.lon) {
      warnings.push('📍 Property location not geocoded - distance calculations may be inaccurate');
    }
    
    if (!context.events || context.events.length === 0) {
      warnings.push('📅 No upcoming events found for this property');
    }
    
    return warnings;
  }
}

// ======================
// Utility Functions
// ======================

/**
 * Create a scorer instance with default investor rules
 */
export function createDefaultScorer(currentDate?: Date): PropertyScorer {
  const defaultRules: InvestorRules = {
    id: 'default',
    label: 'Default Buy Box',
    config: {
      target_counties: VNextConfig.TARGET_COUNTIES,
      max_drive_time_min: VNextConfig.MAX_DRIVE_TIME_MIN,
      max_distance_mi: 30,
      property_types: ['SFR'],
      price_min: 0,
      price_max: 9999999
    },
    updated_at: new Date().toISOString()
  };
  
  return new PropertyScorer(defaultRules, currentDate);
}

/**
 * Score a property with default rules
 */
export function scoreProperty(
  property: Property,
  events: DistressEvent[] = [],
  contacts: Contact[] = [],
  propertyContacts: PropertyContact[] = [],
  currentDate?: Date
): ScoreResult {
  const scorer = createDefaultScorer(currentDate);
  const defaultRules = scorer['investorRules']; // Access private property for default rules
  
  const context: ScoringContext = {
    property,
    events,
    contacts,
    propertyContacts,
    investorRules: defaultRules,
    currentDate
  };
  
  return scorer.score(context);
}

/**
 * Score multiple properties and return sorted by score
 */
export function scoreProperties(
  properties: PropertyWithEvents[],
  investorRules?: InvestorRules,
  currentDate?: Date
): Array<PropertyWithEvents & { scoreResult: ScoreResult }> {
  const scorer = investorRules 
    ? new PropertyScorer(investorRules, currentDate)
    : createDefaultScorer(currentDate);
  
  return properties
    .map(property => {
      const context: ScoringContext = {
        property,
        events: property.events || [],
        contacts: property.contacts || [],
        propertyContacts: [], // Would need to be provided separately
        investorRules: investorRules || scorer['investorRules'],
        currentDate
      };
      
      return {
        ...property,
        scoreResult: scorer.score(context)
      };
    })
    .sort((a, b) => b.scoreResult.score - a.scoreResult.score);
}

/**
 * Get scoring weight configuration for debugging
 */
export function getScoringWeights(): typeof ScoringWeights {
  return ScoringWeights;
}

/**
 * Validate scoring configuration
 */
export function validateScoringConfig(investorRules: InvestorRules): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!investorRules.config.target_counties || investorRules.config.target_counties.length === 0) {
    errors.push('target_counties must be specified');
  }
  
  if (!investorRules.config.max_drive_time_min || investorRules.config.max_drive_time_min <= 0) {
    errors.push('max_drive_time_min must be a positive number');
  }
  
  if (!investorRules.config.property_types || investorRules.config.property_types.length === 0) {
    errors.push('property_types must be specified');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  PropertyScorer,
  createDefaultScorer,
  scoreProperty,
  scoreProperties,
  getScoringWeights,
  validateScoringConfig
};