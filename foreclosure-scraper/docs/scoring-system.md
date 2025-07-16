# vNext Property Scoring System

The scoring system helps answer the critical question: **"Which properties matter most?"** by evaluating properties based on configurable investment criteria and providing actionable insights.

## Overview

The scoring algorithm evaluates properties on a **0-100 scale** across multiple factors:

- **0-25**: Low priority
- **26-50**: Medium priority  
- **51-75**: High priority
- **76-100**: Urgent priority

## Scoring Factors

### 1. County Match (20 points)
- **Full Points**: Property is in a target county (Davidson, Sumner, Wilson)
- **Zero Points**: Property is outside target counties

### 2. Nashville Proximity (15 points)
- **Full Points**: Within 30 minutes drive time and ≤10 miles
- **80% Points**: Within 30 minutes drive time and ≤20 miles  
- **60% Points**: Within 30 minutes drive time and >20 miles
- **Zero Points**: Outside 30 minute drive time

### 3. Mt. Juliet Proximity (15 points)
- **Full Points**: Within 30 minutes drive time and ≤10 miles
- **80% Points**: Within 30 minutes drive time and ≤20 miles
- **60% Points**: Within 30 minutes drive time and >20 miles
- **Zero Points**: Outside 30 minute drive time

### 4. Time to Event (25 points)
- **25 Points**: ≤7 days until foreclosure (urgent)
- **15 Points**: 8-14 days until foreclosure (soon)
- **5 Points**: 15-30 days until foreclosure (moderate)
- **2.5 Points**: 31+ days until foreclosure (low urgency)
- **0 Points**: No upcoming events

### 5. Contact Information (10 points)
- **10 Points**: Has owner contact information (phone or email)
- **0 Points**: No contact information available

### 6. Property Type Match (5 points)
- **5 Points**: Property type matches investment criteria (e.g., SFR)
- **0 Points**: Property type doesn't match criteria

## Usage

### Basic Scoring

```typescript
import { scoreProperty } from '@/lib/scoring';

const result = scoreProperty(property, events, contacts, propertyContacts);

console.log(`Score: ${result.score}/100`);
console.log(`Priority: ${result.priority}`);
console.log(`Recommendations:`, result.recommendations);
```

### Advanced Scoring with Custom Rules

```typescript
import { PropertyScorer } from '@/lib/scoring';

const customRules = {
  id: 'custom',
  label: 'Custom Buy Box',
  config: {
    target_counties: ['Davidson', 'Williamson'],
    max_drive_time_min: 45,
    property_types: ['SFR', 'Condo']
  }
};

const scorer = new PropertyScorer(customRules);
const result = scorer.score(context);
```

### Batch Scoring

```typescript
import { scoreProperties } from '@/lib/scoring';

const scoredProperties = scoreProperties(properties, investorRules);
// Returns properties sorted by score (highest first)
```

## API Integration

### Analyze Single Property

```bash
GET /api/properties/{id}/analyze
```

**Response:**
```json
{
  "property": { ... },
  "score": {
    "score": 85,
    "priority": "urgent",
    "factors": {
      "countyMatch": 20,
      "driveTimeNash": 15,
      "driveTimeMtJuliet": 12,
      "daysToEvent": 25,
      "hasContact": 10,
      "propertyTypeMatch": 5,
      "total": 87
    },
    "explanations": [
      {
        "factor": "County Match",
        "points": 20,
        "reason": "Property is in Davidson county (target area)",
        "weight": 20
      }
    ],
    "urgencyDays": 5,
    "recommendations": [
      "🚨 URGENT: Contact property owner immediately - foreclosure in 7 days or less",
      "📞 Contact information available - ready for outreach"
    ],
    "warnings": []
  },
  "aiAnalysis": {
    "summary": "URGENT OPPORTUNITY - This SFR is in a prime location with 5 days until the foreclosure event. Score: 85/100.",
    "marketInsights": [
      "Davidson County has strong rental demand and appreciation potential"
    ],
    "riskFactors": [
      "Very short timeline may limit due diligence opportunities"
    ],
    "investmentStrategy": "IMMEDIATE ACTION: Contact owner immediately, prepare for quick due diligence, and have financing ready."
  }
}
```

## Factor Explanations

### County Match
- **Purpose**: Focuses on target markets with known opportunities
- **Logic**: Investors typically specialize in specific counties
- **Weight**: Highest individual factor (20 points)

### Proximity Scoring
- **Purpose**: Prioritizes properties within reasonable management distance
- **Logic**: Closer properties are easier to manage and typically have better resale/rental markets
- **Weight**: Combined 30 points for both hubs

### Time to Event
- **Purpose**: Creates urgency scoring based on foreclosure timeline
- **Logic**: Properties with sooner foreclosure dates require immediate action
- **Weight**: Highest possible factor (25 points for urgent events)

### Contact Information
- **Purpose**: Prioritizes actionable opportunities
- **Logic**: Properties with owner contact info can be approached directly
- **Weight**: Moderate factor (10 points)

### Property Type
- **Purpose**: Matches investment strategy preferences
- **Logic**: Different investors focus on different property types
- **Weight**: Tie-breaker factor (5 points)

## Recommendations Engine

The system generates actionable recommendations based on scoring results:

### Time-Based Recommendations
- **≤7 days**: "🚨 URGENT: Contact immediately"
- **8-14 days**: "⚡ HIGH PRIORITY: Contact within 2-3 days"
- **15-30 days**: "📅 MODERATE: Schedule within 1 week"

### Contact-Based Recommendations
- **Has contact**: "📞 Contact information available"
- **No contact**: "🔍 Run skip trace to find owner"

### Score-Based Recommendations
- **76-100**: "⭐ TOP PRIORITY: This property scores in the top tier"
- **51-75**: "✅ HIGH VALUE: Strong investment opportunity"
- **26-50**: "📊 MODERATE: Review property details carefully"
- **0-25**: "📋 LOW PRIORITY: Consider if other opportunities are limited"

## Warning System

The system identifies potential issues:

- **Location warnings**: Property outside target areas
- **Contact warnings**: No owner information available
- **Time warnings**: Critical timelines (≤3 days)
- **Data warnings**: Missing location data or events

## Configuration

### Investor Rules
Rules are stored in the `investor_rules` table and can be customized:

```json
{
  "target_counties": ["Davidson", "Sumner", "Wilson"],
  "max_drive_time_min": 30,
  "max_distance_mi": 30,
  "property_types": ["SFR"],
  "price_min": 0,
  "price_max": 500000,
  "scoring_weights": {
    "county_match": 20,
    "drive_time_nash": 15,
    "drive_time_mtjuliet": 15,
    "days_to_event_urgent": 25,
    "days_to_event_soon": 15,
    "days_to_event_moderate": 5,
    "has_contact": 10,
    "property_type_match": 5
  }
}
```

### Environment Variables
```bash
VNEXT_SCORING_ENABLED=1
VNEXT_TARGET_COUNTIES=Davidson,Sumner,Wilson
VNEXT_MAX_DRIVE_TIME_MIN=30
ENABLE_AI_ANALYSIS=1
```

## Testing

### Run Scoring Tests
```bash
npm run scoring:test
```

This tests:
- Score calculations across various scenarios
- Factor weighting correctness
- Priority level assignments
- Edge case handling
- Configuration validation

### Test Scenarios
1. **Perfect Property**: Urgent, enriched, target county → 75-100 points
2. **Good Property**: Soon, enriched, target county → 50-75 points
3. **Moderate Property**: Distant event, enriched → 40-65 points
4. **No Contact**: Same as above minus 10 points
5. **Non-Target County**: Significant point reduction
6. **Worst Case**: All factors missing → 0-25 points

## Performance Considerations

### Caching
- Score results can be cached for properties
- Invalidate cache when property data changes
- Consider caching for 1-4 hours depending on urgency

### Batch Processing
- Use `scoreProperties()` for multiple properties
- More efficient than individual scoring
- Automatically sorts by score

### Database Optimization
- Ensure indexes on `event_date`, `county`, `within_30min_*` columns
- Consider materialized views for frequently scored properties

## Future Enhancements

### Planned Features
1. **Machine Learning**: Historical success rates
2. **Market Data**: Comparable sales integration
3. **Risk Assessment**: Property condition factors
4. **Portfolio Management**: Diversification scoring
5. **Predictive Analytics**: Foreclosure probability

### Weight Optimization
- A/B test different weight combinations
- Track conversion rates by score ranges
- Adjust weights based on investment outcomes

## Troubleshooting

### Common Issues

**Scores seem too low/high**
- Review scoring weights configuration
- Check if target counties are properly set
- Verify distance calculations are accurate

**No recommendations generated**
- Ensure events have valid dates
- Check that property has required fields
- Verify contact information format

**AI analysis not working**
- Check `ENABLE_AI_ANALYSIS` environment variable
- Verify OpenAI API key is configured
- Review API rate limits

### Debug Mode
```bash
VNEXT_DEBUG=1 npm run scoring:test
```

Shows detailed scoring breakdown and factor calculations.

## Best Practices

1. **Regular Testing**: Run scoring tests after configuration changes
2. **Weight Tuning**: Adjust weights based on investment results
3. **Data Quality**: Ensure accurate property and event data
4. **Monitoring**: Track score distribution and outcomes
5. **Documentation**: Keep scoring logic documented for team

The scoring system provides a systematic, data-driven approach to property prioritization while remaining flexible and configurable for different investment strategies.