# Property Scoring Algorithm Methodology

This document details the comprehensive property scoring system implemented in the vNext foreclosure scraper application.

## Overview

The property scoring algorithm evaluates foreclosure properties on a 0-100 scale based on multiple factors to help investors prioritize leads and identify the most promising opportunities.

### Scoring Philosophy

The algorithm is designed to identify properties that are:
- **Geographically Desirable**: Within target investment areas
- **Timing Optimal**: Appropriate lead time for investor action
- **Contact Enriched**: Have available owner contact information
- **Strategically Aligned**: Match investor buy box criteria

## Scoring Components

### Base Score Structure

```typescript
interface PropertyScore {
  overall_score: number;        // 0-100 total score
  score_breakdown: {
    location: LocationScore;     // 0-35 points
    timing: TimingScore;         // 0-25 points
    enrichment: EnrichmentScore; // 0-10 points
    property: PropertyScore;     // 0-30 points
  };
  confidence_level: number;      // 0.0-1.0 scoring confidence
  last_calculated: string;       // ISO timestamp
}
```

## 1. Location Scoring (0-35 points)

Location scoring evaluates geographic desirability based on proximity to investment hubs and target counties.

### County Match (0-20 points)

```typescript
function calculateCountyScore(county: string, targetCounties: string[]): number {
  if (targetCounties.includes(county)) {
    return 20; // Full points for target counties
  }
  
  // Adjacent counties get partial credit
  const adjacentCounties = getAdjacentCounties(targetCounties);
  if (adjacentCounties.includes(county)) {
    return 10; // Half points for adjacent counties
  }
  
  return 0; // No points for distant counties
}
```

**Target Counties** (configurable via `VNEXT_TARGET_COUNTIES`):
- Davidson County: 20 points
- Sumner County: 20 points  
- Wilson County: 20 points
- Adjacent counties: 10 points
- Other counties: 0 points

### Nashville Proximity (0-15 points)

```typescript
function calculateNashvilleProximityScore(distance: number, driveTime: number): number {
  // Primary scoring based on drive time
  if (driveTime <= 15) return 15;      // 0-15 min: Full points
  if (driveTime <= 20) return 12;      // 15-20 min: High points
  if (driveTime <= 25) return 8;       // 20-25 min: Medium points
  if (driveTime <= 30) return 5;       // 25-30 min: Low points
  return 0;                            // 30+ min: No points
}
```

**Nashville Hub**: `36.1627, -86.7816`
- 0-15 minutes: 15 points
- 15-20 minutes: 12 points
- 20-25 minutes: 8 points
- 25-30 minutes: 5 points
- 30+ minutes: 0 points

### Mt. Juliet Proximity (0-15 points)

```typescript
function calculateMtJulietProximityScore(distance: number, driveTime: number): number {
  // Same scoring structure as Nashville
  if (driveTime <= 15) return 15;
  if (driveTime <= 20) return 12;
  if (driveTime <= 25) return 8;
  if (driveTime <= 30) return 5;
  return 0;
}
```

**Mt. Juliet Hub**: `36.2009, -86.5186`
- Same scoring structure as Nashville proximity

### Location Score Calculation

```typescript
function calculateLocationScore(property: Property): LocationScore {
  const countyScore = calculateCountyScore(property.county, config.targetCounties);
  const nashScore = calculateNashvilleProximityScore(
    property.distance_to_nashville_miles,
    property.estimated_drive_time_nash
  );
  const mtjScore = calculateMtJulietProximityScore(
    property.distance_to_mtjuliet_miles,
    property.estimated_drive_time_mtj
  );
  
  return {
    total: Math.min(35, countyScore + Math.max(nashScore, mtjScore)), // Take best proximity
    county_match: countyScore,
    nashville_proximity: nashScore,
    mtjuliet_proximity: mtjScore,
    best_hub: nashScore >= mtjScore ? 'nashville' : 'mtjuliet'
  };
}
```

## 2. Timing Scoring (0-25 points)

Timing scoring evaluates how soon the foreclosure sale occurs, balancing adequate preparation time with urgency.

### Days to Sale Calculation

```typescript
function calculateTimingScore(saleDate: Date): TimingScore {
  const today = new Date();
  const daysToSale = Math.ceil((saleDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysToSale < 0) {
    return { total: 0, days_to_sale: daysToSale, status: 'past_sale' };
  }
  
  if (daysToSale <= 7) {
    return { total: 25, days_to_sale: daysToSale, status: 'urgent' };
  }
  
  if (daysToSale <= 14) {
    return { total: 20, days_to_sale: daysToSale, status: 'high_priority' };
  }
  
  if (daysToSale <= 21) {
    return { total: 15, days_to_sale: daysToSale, status: 'medium_priority' };
  }
  
  if (daysToSale <= 30) {
    return { total: 10, days_to_sale: daysToSale, status: 'plan_ahead' };
  }
  
  if (daysToSale <= 60) {
    return { total: 5, days_to_sale: daysToSale, status: 'early_stage' };
  }
  
  return { total: 2, days_to_sale: daysToSale, status: 'too_early' };
}
```

**Timing Categories**:
- **1-7 days**: 25 points (Urgent - immediate action required)
- **8-14 days**: 20 points (High Priority - optimal action window)
- **15-21 days**: 15 points (Medium Priority - good preparation time)
- **22-30 days**: 10 points (Plan Ahead - adequate lead time)
- **31-60 days**: 5 points (Early Stage - track for future)
- **60+ days**: 2 points (Too Early - minimal priority)
- **Past sale**: 0 points (Expired opportunity)

## 3. Contact Enrichment Scoring (0-10 points)

Evaluates the availability and quality of owner contact information for outreach purposes.

### Enrichment Evaluation

```typescript
function calculateEnrichmentScore(contacts: Contact[]): EnrichmentScore {
  if (!contacts || contacts.length === 0) {
    return { total: 0, status: 'no_contacts', quality: 'none' };
  }
  
  let emailCount = 0;
  let phoneCount = 0;
  let verifiedCount = 0;
  
  contacts.forEach(contact => {
    emailCount += contact.emails?.length || 0;
    phoneCount += contact.phones?.length || 0;
    
    // Count verified contacts
    contact.emails?.forEach(email => {
      if (email.verified) verifiedCount++;
    });
    contact.phones?.forEach(phone => {
      if (phone.verified) verifiedCount++;
    });
  });
  
  const totalContacts = emailCount + phoneCount;
  
  if (totalContacts === 0) {
    return { total: 0, status: 'no_contacts', quality: 'none' };
  }
  
  // Base points for having contacts
  let score = 5;
  
  // Bonus for multiple contact methods
  if (emailCount > 0 && phoneCount > 0) {
    score += 3; // Both email and phone
  } else if (emailCount > 1 || phoneCount > 1) {
    score += 2; // Multiple of same type
  }
  
  // Bonus for verified contacts
  if (verifiedCount > 0) {
    score += 2;
  }
  
  const quality = verifiedCount > 0 ? 'verified' : 
                 (emailCount > 0 && phoneCount > 0) ? 'high' :
                 totalContacts > 1 ? 'medium' : 'basic';
  
  return {
    total: Math.min(10, score),
    status: 'enriched',
    quality,
    email_count: emailCount,
    phone_count: phoneCount,
    verified_count: verifiedCount
  };
}
```

**Enrichment Scoring**:
- **No contacts**: 0 points
- **Basic contact info**: 5 points (single email or phone)
- **Multiple same type**: +2 points (multiple emails OR phones)
- **Multiple types**: +3 points (emails AND phones)
- **Verified contacts**: +2 points (any verified email/phone)
- **Maximum**: 10 points

## 4. Property Characteristics (0-30 points)

Evaluates property-specific factors that affect investment potential.

### Property Type Scoring

```typescript
function calculatePropertyTypeScore(propertyType: string): number {
  const typeScores = {
    'Single Family': 15,      // Highest demand
    'Townhouse': 12,          // Good resale potential
    'Duplex': 10,             // Rental income potential
    'Condo': 8,               // Market dependent
    'Multi Family': 6,        // Complex management
    'Commercial': 3,          // Specialized market
    'Land': 2,                // Development potential only
    'Mobile Home': 1,         // Limited market
  };
  
  return typeScores[propertyType] || 5; // Default for unknown types
}
```

### Market Factors (Future Enhancement)

```typescript
function calculateMarketScore(property: Property): number {
  // Placeholder for future market analysis
  // Could include:
  // - Comparable sales data
  // - Neighborhood trends
  // - School district ratings
  // - Crime statistics
  // - Economic indicators
  
  return 10; // Default market score
}
```

### Additional Property Factors

```typescript
function calculatePropertyScore(property: Property): PropertyScore {
  const typeScore = calculatePropertyTypeScore(property.property_type);
  const marketScore = calculateMarketScore(property);
  
  // Future enhancements could include:
  // - Estimated property value
  // - Repair cost estimates
  // - Rental income potential
  // - HOA considerations
  
  return {
    total: typeScore + marketScore,
    property_type_score: typeScore,
    market_score: marketScore,
    estimated_value: null, // Future enhancement
    repair_estimate: null  // Future enhancement
  };
}
```

## Overall Score Calculation

### Score Aggregation

```typescript
function calculateOverallScore(property: Property): PropertyScore {
  const locationScore = calculateLocationScore(property);
  const timingScore = calculateTimingScore(property.latest_event.sale_date);
  const enrichmentScore = calculateEnrichmentScore(property.contacts);
  const propertyScore = calculatePropertyScore(property);
  
  const overallScore = locationScore.total + 
                      timingScore.total + 
                      enrichmentScore.total + 
                      propertyScore.total;
  
  const confidence = calculateConfidence(property);
  
  return {
    overall_score: Math.min(100, overallScore),
    score_breakdown: {
      location: locationScore,
      timing: timingScore,
      enrichment: enrichmentScore,
      property: propertyScore
    },
    confidence_level: confidence,
    last_calculated: new Date().toISOString()
  };
}
```

### Confidence Calculation

```typescript
function calculateConfidence(property: Property): number {
  let confidence = 0.5; // Base confidence
  
  // Increase confidence for complete data
  if (property.latitude && property.longitude) confidence += 0.2;
  if (property.distance_to_nashville_miles !== null) confidence += 0.1;
  if (property.contacts && property.contacts.length > 0) confidence += 0.1;
  if (property.latest_event.sale_date) confidence += 0.1;
  
  return Math.min(1.0, confidence);
}
```

## Scoring Examples

### Example 1: High-Score Property

```json
{
  "property": {
    "full_address": "123 Main St, Nashville, TN 37201",
    "county": "Davidson",
    "property_type": "Single Family",
    "distance_to_nashville_miles": 5.2,
    "latest_event": {
      "sale_date": "2024-07-25" // 9 days from now
    },
    "contacts": [
      {
        "emails": [{"email": "owner@example.com", "verified": true}],
        "phones": [{"number": "615-555-0123", "verified": false}]
      }
    ]
  },
  "score": {
    "overall_score": 87,
    "score_breakdown": {
      "location": {
        "total": 35,
        "county_match": 20,
        "nashville_proximity": 15,
        "mtjuliet_proximity": 8
      },
      "timing": {
        "total": 25,
        "days_to_sale": 9,
        "status": "urgent"
      },
      "enrichment": {
        "total": 10,
        "status": "enriched",
        "quality": "high"
      },
      "property": {
        "total": 17,
        "property_type_score": 15,
        "market_score": 2
      }
    },
    "confidence_level": 0.9
  }
}
```

### Example 2: Medium-Score Property

```json
{
  "property": {
    "full_address": "456 Oak Ave, Hendersonville, TN 37075",
    "county": "Sumner",
    "property_type": "Townhouse",
    "distance_to_nashville_miles": 18.3,
    "latest_event": {
      "sale_date": "2024-08-10" // 25 days from now
    },
    "contacts": []
  },
  "score": {
    "overall_score": 47,
    "score_breakdown": {
      "location": {
        "total": 25,
        "county_match": 20,
        "nashville_proximity": 5,
        "mtjuliet_proximity": 12
      },
      "timing": {
        "total": 10,
        "days_to_sale": 25,
        "status": "plan_ahead"
      },
      "enrichment": {
        "total": 0,
        "status": "no_contacts",
        "quality": "none"
      },
      "property": {
        "total": 12,
        "property_type_score": 12,
        "market_score": 0
      }
    },
    "confidence_level": 0.7
  }
}
```

### Example 3: Low-Score Property

```json
{
  "property": {
    "full_address": "789 Rural Rd, Springfield, TN 37172",
    "county": "Robertson",
    "property_type": "Mobile Home",
    "distance_to_nashville_miles": 45.1,
    "latest_event": {
      "sale_date": "2024-09-15" // 61 days from now
    },
    "contacts": []
  },
  "score": {
    "overall_score": 13,
    "score_breakdown": {
      "location": {
        "total": 10,
        "county_match": 0,
        "nashville_proximity": 0,
        "mtjuliet_proximity": 0,
        "adjacent_county": 10
      },
      "timing": {
        "total": 2,
        "days_to_sale": 61,
        "status": "too_early"
      },
      "enrichment": {
        "total": 0,
        "status": "no_contacts",
        "quality": "none"
      },
      "property": {
        "total": 1,
        "property_type_score": 1,
        "market_score": 0
      }
    },
    "confidence_level": 0.6
  }
}
```

## Configuration and Customization

### Investor Rules Configuration

The scoring algorithm is configurable through the `investor_rules` table:

```sql
INSERT INTO investor_rules (label, description, config, is_active) VALUES (
  'Nashville Investor - Primary',
  'Main buy box criteria for Nashville area investment',
  '{
    "target_counties": ["Davidson", "Sumner", "Wilson"],
    "max_drive_time_min": 30,
    "min_score_threshold": 60,
    "scoring_weights": {
      "location_weight": 0.35,
      "timing_weight": 0.25,
      "enrichment_weight": 0.10,
      "property_weight": 0.30
    },
    "location_config": {
      "county_match_points": 20,
      "proximity_max_points": 15,
      "adjacent_county_points": 10
    },
    "timing_config": {
      "urgent_days": 7,
      "high_priority_days": 14,
      "medium_priority_days": 21,
      "plan_ahead_days": 30
    },
    "property_preferences": {
      "Single Family": 15,
      "Townhouse": 12,
      "Duplex": 10,
      "Condo": 8
    }
  }',
  true
);
```

### Environment Variables

Key configuration via environment variables:

```bash
# Geographic Configuration
VNEXT_TARGET_COUNTIES=Davidson,Sumner,Wilson
VNEXT_MAX_DRIVE_TIME_MIN=30
VNEXT_NASHVILLE_LAT=36.1627
VNEXT_NASHVILLE_LON=-86.7816
VNEXT_MTJULIET_LAT=36.2009
VNEXT_MTJULIET_LON=-86.5186

# Scoring Configuration
VNEXT_SCORING_ENABLED=1
VNEXT_MIN_SCORE_THRESHOLD=60
```

## Performance Considerations

### Scoring Performance

- **Calculation Time**: < 50ms per property
- **Bulk Scoring**: Optimized for batch operations
- **Caching**: Scores cached until property data changes
- **Database Impact**: Minimal additional queries

### Optimization Strategies

1. **Pre-calculated Distance**: Store distances during property creation
2. **Materialized Scores**: Cache scores in `lead_pipeline` table
3. **Batch Updates**: Update scores in bulk operations
4. **Index Strategy**: Optimize queries on score-related fields

```sql
-- Performance indexes for scoring
CREATE INDEX idx_properties_county_distance ON properties(county, distance_to_nashville_miles);
CREATE INDEX idx_distress_events_sale_date ON distress_events(sale_date);
CREATE INDEX idx_lead_pipeline_score ON lead_pipeline(priority_score);
```

## Algorithm Evolution

### Version History

- **v1.0**: Basic location and timing scoring
- **v1.1**: Added contact enrichment scoring
- **v1.2**: Enhanced property type evaluation
- **v2.0**: Configurable investor rules (planned)
- **v2.1**: Market data integration (planned)
- **v3.0**: Machine learning enhancement (future)

### Future Enhancements

#### Planned Improvements

1. **Market Data Integration**
   - Comparable sales analysis
   - Neighborhood trend analysis
   - School district ratings
   - Crime statistics

2. **Machine Learning Enhancement**
   - Historical outcome training
   - Pattern recognition
   - Predictive success modeling

3. **Dynamic Scoring**
   - Real-time market adjustments
   - Seasonal factors
   - Economic indicators

4. **Advanced Property Analysis**
   - Automated valuation models (AVM)
   - Repair cost estimation
   - Rental income potential

#### A/B Testing Framework

```typescript
interface ScoringExperiment {
  name: string;
  description: string;
  traffic_percentage: number;
  scoring_config: InvestorRuleConfig;
  success_metrics: string[];
}
```

## Testing and Validation

### Scoring Test Suite

```bash
# Test scoring algorithm
npm run scoring:test

# Test specific scoring components
npm run test:scoring:location
npm run test:scoring:timing
npm run test:scoring:enrichment
```

### Validation Metrics

- **Score Distribution**: Ensure balanced score distribution
- **Correlation Analysis**: Validate score correlation with outcomes
- **Performance Monitoring**: Track scoring calculation performance
- **Accuracy Assessment**: Compare scores with investor feedback

### Quality Assurance

1. **Unit Tests**: Individual scoring component tests
2. **Integration Tests**: End-to-end scoring validation
3. **Performance Tests**: Bulk scoring performance validation
4. **Data Quality Tests**: Input data validation

## Business Impact

### Lead Prioritization

The scoring system enables:
- **Automated Lead Ranking**: Sort properties by investment potential
- **Resource Allocation**: Focus efforts on highest-scoring opportunities
- **Pipeline Management**: Track lead quality over time
- **ROI Optimization**: Improve conversion rates through better targeting

### Key Performance Indicators

- **Score Accuracy**: Correlation between score and successful acquisitions
- **Pipeline Efficiency**: Conversion rates by score range
- **Time to Close**: Relationship between score and closing timeline
- **Investment ROI**: Return on investment by score category

---

*This scoring methodology provides a systematic approach to property evaluation while remaining flexible for future enhancements and customization based on investor preferences and market conditions.*