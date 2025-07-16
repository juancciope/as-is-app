# Developer Onboarding Guide - vNext Foreclosure Scraper

Welcome to the vNext foreclosure scraper development team! This guide will help you get up to speed with the normalized database architecture and development workflows.

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture Overview](#architecture-overview)
- [Development Environment Setup](#development-environment-setup)
- [Database Schema Understanding](#database-schema-understanding)
- [Feature Flag System](#feature-flag-system)
- [Development Workflows](#development-workflows)
- [Testing Guidelines](#testing-guidelines)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)
- [Resources](#resources)

## Project Overview

### What is the vNext System?

The vNext system is a complete modernization of the foreclosure scraper application that migrated from a single flat table (`foreclosure_data`) to a normalized relational database structure with enhanced features.

### Key Improvements

- **Normalized Data Model**: Separate tables for properties, events, contacts, and relationships
- **Property Deduplication**: Single property record per unique address (22% reduction in duplicate data)
- **Enhanced Contact Storage**: JSON arrays for flexible phone/email management
- **Property Scoring**: Automated lead prioritization algorithm
- **Dual-Hub Geography**: Nashville and Mt. Juliet proximity calculations
- **Skip Trace Audit Trail**: Complete history of skip trace operations
- **Lead Pipeline**: Sales stage tracking and management
- **Feature Flags**: Safe deployment and rollback capabilities

### Business Context

The system helps real estate investors:
1. **Discover** foreclosure opportunities from multiple sources
2. **Prioritize** leads using automated scoring
3. **Enrich** properties with owner contact information
4. **Track** leads through the sales pipeline
5. **Analyze** investment potential with AI-powered insights

## Architecture Overview

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Scrapers  │    │  Next.js App    │    │   Supabase DB   │
│                 │    │                 │    │                 │
│ • TN Ledger     │───▶│ • Dashboard UI  │───▶│ • Properties    │
│ • Clear Recon   │    │ • API Routes    │    │ • Events        │
│ • Phillips Law  │    │ • Skip Trace    │    │ • Contacts      │
│ • Wilson County │    │ • Scoring       │    │ • Pipeline      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │  External APIs  │
                       │                 │
                       │ • Connected     │
                       │   Investors     │
                       │ • OpenAI        │
                       │ • Apify         │
                       └─────────────────┘
```

### Technology Stack

**Frontend**:
- Next.js 14 (React framework)
- TypeScript for type safety
- Tailwind CSS for styling
- Radix UI for components

**Backend**:
- Next.js API routes
- Supabase (PostgreSQL database)
- TypeScript for all server code

**External Services**:
- Apify for scraper orchestration
- Connected Investors for skip trace
- OpenAI for property analysis
- Supabase for database and auth

**Development Tools**:
- tsx for TypeScript execution
- ESLint for code quality
- Git for version control

## Development Environment Setup

### Prerequisites

1. **Node.js 18+** and npm
2. **Git** for version control
3. **Supabase Account** for database access
4. **Code Editor** (VS Code recommended)

### Quick Start

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd foreclosure-scraper
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment configuration**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your credentials
   ```

4. **Validate configuration**:
   ```bash
   npm run vnext:config
   ```

5. **Verify database migration**:
   ```bash
   npm run migration:verify
   ```

6. **Start development server**:
   ```bash
   npm run dev
   ```

### Required Environment Variables

```bash
# Database (Required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Feature Flags (Required)
USE_LEGACY=1                    # Start in legacy mode for safety
USE_VNEXT_FILTERS=0            # Disable new filters initially
ENABLE_AI_ANALYSIS=0           # Disable AI features initially

# vNext Configuration
VNEXT_TARGET_COUNTIES=Davidson,Sumner,Wilson
VNEXT_MAX_DRIVE_TIME_MIN=30
VNEXT_SCORING_ENABLED=1

# Skip Trace (Required for skip trace functionality)
APIFY_API_TOKEN=your_apify_api_token
CONNECTED_INVESTORS_USERNAME=your_ci_username
CONNECTED_INVESTORS_PASSWORD=your_ci_password

# AI Analysis (Optional)
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
```

### Development Setup Validation

Run these commands to ensure everything is configured correctly:

```bash
# Check configuration
npm run vnext:config

# Verify database schema
npm run migration:verify

# Test API endpoints
npm run api:test

# Test scoring system
npm run scoring:test

# Run a single health check
npm run monitor:check
```

## Database Schema Understanding

### Core Entity Relationships

```
properties (1) ←──→ (many) distress_events
    │
    └─→ (many) property_contacts (many) ←──→ (1) contacts
    │
    └─→ (1) lead_pipeline
    │
    └─→ (many) skip_trace_runs
```

### Key Tables to Understand

#### 1. `properties` - The Central Entity

```sql
-- Core property information
SELECT 
  id,
  full_address,
  normalized_address,        -- For deduplication
  county,
  distance_to_nashville_miles,
  distance_to_mtjuliet_miles,
  within_30min_nashville,
  within_30min_mtjuliet
FROM properties 
LIMIT 5;
```

**Key Fields**:
- `normalized_address`: Used for deduplication ("123 main nashville tn 37201")
- `distance_to_*_miles`: Pre-calculated distances for performance
- `within_30min_*`: Boolean flags for quick filtering

#### 2. `distress_events` - Foreclosure Events

```sql
-- Events linked to properties
SELECT 
  p.full_address,
  de.event_type,
  de.sale_date,
  de.source,
  de.case_number
FROM properties p
JOIN distress_events de ON p.id = de.property_id
ORDER BY de.sale_date DESC
LIMIT 5;
```

**Key Concepts**:
- One property can have multiple events over time
- Events are future-proofed for other distress types
- `raw_data` JSONB field preserves original scraper data

#### 3. `contacts` - Flexible Contact Storage

```sql
-- Contact information with JSON arrays
SELECT 
  id,
  name_first,
  name_last,
  contact_type,
  phones,  -- JSON array: [{"number": "615-555-0123", "label": "primary", "verified": false}]
  emails   -- JSON array: [{"email": "test@example.com", "label": "primary", "verified": false}]
FROM contacts 
WHERE contact_type = 'owner'
LIMIT 3;
```

**JSON Structure**:
```typescript
// Phone array structure
phones: Array<{
  number: string;
  label: 'primary' | 'secondary' | 'work' | 'mobile';
  verified: boolean;
  source: 'connected_investors' | 'manual' | 'ci_legacy';
}>

// Email array structure  
emails: Array<{
  email: string;
  label: 'primary' | 'secondary' | 'work';
  verified: boolean;
  source: 'connected_investors' | 'manual' | 'ci_legacy';
}>
```

#### 4. `lead_pipeline` - Sales Tracking

```sql
-- Pipeline stages for properties
SELECT 
  p.full_address,
  lp.stage,
  lp.priority_score,
  lp.stage_updated_at,
  lp.assigned_to
FROM properties p
JOIN lead_pipeline lp ON p.id = lp.property_id
WHERE lp.stage != 'dead'
ORDER BY lp.priority_score DESC
LIMIT 5;
```

**Pipeline Stages**:
- `new`: Recently discovered
- `enriched`: Contact info obtained
- `contacted`: Outreach completed
- `qualified`: Interested lead
- `under_contract`: Purchase agreement
- `closed`: Transaction complete
- `dead`: No longer viable

### Common Query Patterns

#### Get Properties with Contacts
```sql
SELECT 
  p.id,
  p.full_address,
  p.county,
  p.distance_to_nashville_miles,
  de.sale_date,
  de.source,
  c.name_first,
  c.name_last,
  c.phones,
  c.emails,
  lp.stage,
  lp.priority_score
FROM properties p
LEFT JOIN distress_events de ON p.id = de.property_id
LEFT JOIN property_contacts pc ON p.id = pc.property_id
LEFT JOIN contacts c ON pc.contact_id = c.id
LEFT JOIN lead_pipeline lp ON p.id = lp.property_id
WHERE p.county = 'Davidson'
  AND de.sale_date >= CURRENT_DATE
ORDER BY lp.priority_score DESC, de.sale_date ASC;
```

#### Properties Within 30 Minutes of Nashville
```sql
SELECT 
  full_address,
  distance_to_nashville_miles,
  within_30min_nashville
FROM properties 
WHERE within_30min_nashville = true
ORDER BY distance_to_nashville_miles ASC;
```

## Feature Flag System

### Understanding Feature Flags

The system uses feature flags to safely deploy new functionality:

| Flag | Purpose | Values |
|------|---------|--------|
| `USE_LEGACY` | Data source selection | `1` = Legacy table, `0` = vNext tables |
| `USE_VNEXT_FILTERS` | Dashboard filters | `1` = Dual-hub filters, `0` = Single filter |
| `ENABLE_AI_ANALYSIS` | AI features | `1` = Enabled, `0` = Disabled |

### Feature Flag Behavior in Code

```typescript
// lib/config.ts
export const FeatureFlags = {
  USE_LEGACY: process.env.USE_LEGACY === '1',
  USE_VNEXT_FILTERS: process.env.USE_VNEXT_FILTERS === '1',
  ENABLE_AI_ANALYSIS: process.env.ENABLE_AI_ANALYSIS === '1'
};

// Usage in API routes
if (FeatureFlags.USE_LEGACY) {
  // Use foreclosure_data table
  return await legacyDataHandler(request);
} else {
  // Use vNext normalized tables
  return await vnextDataHandler(request);
}
```

### Current State Check

```bash
# Check current feature flag configuration
npm run vnext:config
```

## Development Workflows

### Adding New Features

1. **Check Feature Flags**: Understand current system state
2. **Update Both Paths**: Ensure legacy compatibility if needed
3. **Test Dual Mode**: Verify functionality in both legacy and vNext modes
4. **Add Tests**: Include both unit and integration tests
5. **Update Documentation**: Keep docs current

### Making Database Changes

1. **Create Migration**: Add new migration file
2. **Test Migration**: Use dry-run capabilities
3. **Update Types**: Ensure TypeScript types match
4. **Update API**: Modify endpoints as needed
5. **Test Compatibility**: Verify legacy compatibility if needed

### Working with Skip Trace

```typescript
// Example: Adding a new skip trace provider
export async function runNewProviderSkipTrace(propertyId: string): Promise<SkipTraceResult> {
  // 1. Create skip trace run record
  const runRecord = await createSkipTraceRun(propertyId, 'new_provider');
  
  // 2. Execute skip trace
  const results = await newProviderAPI.skipTrace(propertyId);
  
  // 3. Create contacts with JSON arrays
  const contacts = results.contacts.map(contact => ({
    name_first: contact.firstName,
    name_last: contact.lastName,
    contact_type: 'skiptrace_result',
    phones: contact.phones.map(phone => ({
      number: phone,
      label: 'primary',
      verified: false,
      source: 'new_provider'
    })),
    emails: contact.emails.map(email => ({
      email: email,
      label: 'primary', 
      verified: false,
      source: 'new_provider'
    }))
  }));
  
  // 4. Link to property and update pipeline
  await linkContactsToProperty(propertyId, contacts);
  await updatePipelineStage(propertyId, 'enriched');
  
  return results;
}
```

### Working with Property Scoring

```typescript
// Example: Customizing scoring algorithm
export function calculateCustomScore(property: Property): PropertyScore {
  const baseScore = calculateLocationScore(property) +
                   calculateTimingScore(property.latest_event.sale_date) +
                   calculateEnrichmentScore(property.contacts);
  
  // Add custom business logic
  let customBonus = 0;
  if (property.property_type === 'Single Family') {
    customBonus += 5;
  }
  if (property.county === 'Davidson') {
    customBonus += 3;
  }
  
  return {
    overall_score: Math.min(100, baseScore + customBonus),
    custom_factors: {
      property_type_bonus: property.property_type === 'Single Family' ? 5 : 0,
      county_bonus: property.county === 'Davidson' ? 3 : 0
    }
  };
}
```

## Testing Guidelines

### Test Categories

1. **Unit Tests**: Individual function testing
2. **Integration Tests**: API endpoint testing  
3. **Migration Tests**: Database schema testing
4. **End-to-End Tests**: Complete workflow testing

### Running Tests

```bash
# Run all built-in tests
npm run backfill:test      # Test data migration logic
npm run scoring:test       # Test scoring algorithm
npm run api:test          # Test API endpoints
npm run skip-trace:test   # Test skip trace flow
npm run migration:verify  # Test database schema

# Monitor system health
npm run monitor:check     # Single health check
npm run monitor:start     # Continuous monitoring
```

### Writing Tests

```typescript
// Example test structure
describe('Property Scoring', () => {
  it('should calculate location score correctly', () => {
    const property = {
      county: 'Davidson',
      distance_to_nashville_miles: 5.0,
      distance_to_mtjuliet_miles: 25.0
    };
    
    const score = calculateLocationScore(property);
    
    expect(score.county_match).toBe(20);
    expect(score.nashville_proximity).toBe(15);
    expect(score.total).toBe(35);
  });
});
```

### Testing Checklist

- [ ] Unit tests pass for new functionality
- [ ] Integration tests cover API changes
- [ ] Both legacy and vNext paths tested (if applicable)
- [ ] Feature flag behavior tested
- [ ] Database migrations tested
- [ ] Performance impact assessed

## Common Tasks

### 1. Adding a New Data Source

```typescript
// 1. Update ingest API to handle new source
export async function ingestNewSource(data: NewSourceData[]): Promise<IngestResult> {
  const results = [];
  
  for (const item of data) {
    // Normalize address for deduplication
    const normalizedAddress = normalizeAddress(item.address);
    
    // Upsert property
    const property = await upsertProperty({
      full_address: item.address,
      normalized_address: normalizedAddress,
      county: item.county,
      // ... other fields
    });
    
    // Create distress event
    const event = await createDistressEvent({
      property_id: property.id,
      event_type: 'foreclosure',
      sale_date: item.saleDate,
      source: 'new_source',
      raw_data: item
    });
    
    results.push({ property_id: property.id, event_id: event.id });
  }
  
  return { success: true, results };
}
```

### 2. Adding a New Filter

```typescript
// 1. Update API endpoint
export async function getPropertiesWithNewFilter(filters: PropertyFilters): Promise<Property[]> {
  let query = supabaseAdmin!
    .from('properties')
    .select(`
      *,
      latest_event:distress_events(*),
      contacts:property_contacts(contacts(*)),
      pipeline:lead_pipeline(*)
    `);
  
  // Add new filter
  if (filters.newFilterValue) {
    query = query.eq('new_field', filters.newFilterValue);
  }
  
  const { data, error } = await query;
  return data || [];
}

// 2. Update dashboard component
export function NewFilter({ onFilterChange }: FilterProps) {
  return (
    <select onChange={(e) => onFilterChange('newFilter', e.target.value)}>
      <option value="">All</option>
      <option value="value1">Option 1</option>
      <option value="value2">Option 2</option>
    </select>
  );
}
```

### 3. Customizing the Scoring Algorithm

```typescript
// 1. Modify scoring logic
export function calculateCustomLocationScore(property: Property): LocationScore {
  const baseScore = calculateLocationScore(property);
  
  // Add custom business rules
  if (property.county === 'Williamson') {
    baseScore.total += 5; // Bonus for high-value county
  }
  
  if (property.distance_to_custom_hub_miles <= 10) {
    baseScore.total += 10; // Bonus for proximity to custom hub
  }
  
  return baseScore;
}

// 2. Update investor rules configuration
const customRules = {
  target_counties: ['Davidson', 'Sumner', 'Wilson', 'Williamson'],
  custom_hub_coordinates: { lat: 36.0000, lon: -86.0000 },
  scoring_bonuses: {
    williamson_county: 5,
    custom_hub_proximity: 10
  }
};
```

## Troubleshooting

### Common Issues

#### 1. Feature Flag Confusion

**Problem**: Unexpected behavior due to feature flag state

**Solution**:
```bash
# Check current flags
npm run vnext:config

# Verify expected behavior for current flags
npm run monitor:check
```

#### 2. Database Connection Issues

**Problem**: Cannot connect to Supabase

**Solution**:
```bash
# Verify environment variables
npm run vnext:config

# Test database connectivity
npm run migration:verify
```

#### 3. Data Inconsistency

**Problem**: Legacy and vNext data don't match

**Solution**:
```bash
# Check data consistency
npm run migration:verify

# Re-run migration if needed
npm run backfill:dry-run
npm run backfill:apply
```

#### 4. API Endpoint Not Found

**Problem**: 404 errors on new endpoints

**Solution**:
- Ensure development server is running: `npm run dev`
- Check feature flags: new endpoints may be disabled
- Verify API route file structure

#### 5. Slow Query Performance

**Problem**: Database queries taking too long

**Solution**:
- Check database indexes
- Review query structure
- Monitor with: `npm run monitor:check`
- Consider query optimization

### Getting Help

1. **Check Documentation**: Review README_VNEXT.md and API reference
2. **Run Diagnostics**: Use built-in health checks and tests
3. **Review Logs**: Application and database logs for errors
4. **Team Resources**: Slack channels, team documentation
5. **Escalation Path**: Senior developers, tech lead, product owner

### Debug Tools

```bash
# Enable debug logging
VNEXT_DEBUG=1 npm run dev

# Monitor system health
npm run monitor:start

# Test specific components
npm run api:test
npm run scoring:test
npm run skip-trace:test
```

## Resources

### Documentation

- [README_VNEXT.md](../README_VNEXT.md) - Complete system overview
- [API Reference](./api-reference.md) - Detailed API documentation
- [Scoring Algorithm](./scoring-algorithm-methodology.md) - Scoring methodology
- [Feature Flag Rollout](./feature-flag-rollout-guide.md) - Deployment guide
- [Migration Instructions](./migration-instructions.md) - Database migration
- [Environment Setup](./vnext-environment-setup.md) - Configuration guide

### Key Files to Understand

```
foreclosure-scraper/
├── app/api/                 # API endpoints
│   ├── properties/         # vNext properties API
│   ├── data/              # Legacy data API
│   ├── skip-trace/        # Skip trace functionality
│   └── ingest/            # Data ingestion
├── lib/
│   ├── config.ts          # Feature flags and configuration
│   ├── supabase.ts        # Database client and types
│   └── scoring.ts         # Property scoring algorithm
├── components/dashboard/   # Dashboard UI components
├── scripts/               # Utility and migration scripts
├── supabase/migrations/   # Database schema files
└── docs/                  # Comprehensive documentation
```

### Development Commands Reference

```bash
# Environment and Configuration
npm run vnext:config           # Show configuration
npm run migration:verify       # Verify database schema

# Data Operations
npm run backfill:dry-run      # Test data migration
npm run backfill:apply        # Apply data migration

# Testing
npm run api:test              # Test API endpoints
npm run scoring:test          # Test scoring system
npm run skip-trace:test       # Test skip trace

# Monitoring
npm run monitor:start         # Continuous monitoring
npm run monitor:check         # Single health check

# Feature Flag Rollout
npm run rollout:guide         # Rollout strategy
npm run rollout:phase1        # Execute specific phase

# Legacy System
npm run legacy:audit          # Audit legacy usage
npm run legacy:backup         # Backup legacy data
```

### Team Communication

- **Daily Standups**: Development progress and blockers
- **Code Reviews**: All changes require peer review
- **Documentation**: Keep docs updated with changes
- **Testing**: Write tests for new functionality
- **Monitoring**: Watch system health after deployments

### Next Steps for New Developers

1. **Complete Environment Setup**: Ensure all tests pass
2. **Review Codebase**: Study key files and patterns
3. **Run Through Workflows**: Try common development tasks
4. **Pick Up First Task**: Start with documentation or bug fixes
5. **Ask Questions**: Team is here to help!

Welcome to the team! The vNext system provides a solid foundation for building advanced real estate investment tools. Don't hesitate to ask questions as you get familiar with the architecture and workflows.

---

*This onboarding guide covers the essentials for productive development on the vNext foreclosure scraper system. Refer to the comprehensive documentation for detailed technical information.*