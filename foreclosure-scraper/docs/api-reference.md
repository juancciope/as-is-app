# vNext API Reference

This document provides comprehensive documentation for all API endpoints in the vNext foreclosure scraper system.

## Base URL

```
http://localhost:3000  # Development
https://your-domain.com  # Production
```

## Authentication

All API endpoints use Supabase authentication. Include the authorization header for authenticated requests:

```
Authorization: Bearer <supabase_jwt_token>
```

## Content Type

All requests should include:

```
Content-Type: application/json
```

## Error Responses

Standard error response format:

```json
{
  "error": "Error message",
  "details": "Detailed error information",
  "code": "ERROR_CODE"
}
```

HTTP Status Codes:
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error

## Properties API

### List Properties

`GET /api/properties`

Retrieve a list of properties with filtering and pagination.

#### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `county` | string | Filter by county name | `Davidson` |
| `source` | string | Filter by data source | `tnledger` |
| `enriched` | boolean | Filter by contact enrichment status | `true` |
| `min_score` | number | Minimum property score (0-100) | `70` |
| `max_distance_nash` | number | Maximum distance from Nashville (miles) | `30` |
| `max_distance_mtj` | number | Maximum distance from Mt. Juliet (miles) | `25` |
| `sale_date_start` | string | Start date (YYYY-MM-DD) | `2024-07-01` |
| `sale_date_end` | string | End date (YYYY-MM-DD) | `2024-08-31` |
| `property_type` | string | Property type filter | `Single Family` |
| `auction_type` | string | Auction type filter | `foreclosure` |
| `stage` | string | Pipeline stage filter | `enriched` |
| `limit` | number | Results per page (max 500) | `100` |
| `offset` | number | Pagination offset | `0` |
| `sort_by` | string | Sort field | `sale_date` |
| `sort_order` | string | Sort direction | `asc` or `desc` |

#### Response

```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "full_address": "123 Main St, Nashville, TN 37201",
      "normalized_address": "123 main nashville tn 37201",
      "street_address": "123 Main St",
      "city": "Nashville",
      "state": "TN",
      "zip_code": "37201",
      "county": "Davidson",
      "property_type": "Single Family",
      "latitude": 36.1627,
      "longitude": -86.7816,
      "distance_to_nashville_miles": 2.5,
      "distance_to_mtjuliet_miles": 25.3,
      "within_30min_nashville": true,
      "within_30min_mtjuliet": false,
      "latest_event": {
        "id": "456e7890-e89b-12d3-a456-426614174001",
        "event_type": "foreclosure",
        "sale_date": "2024-08-15",
        "auction_type": "foreclosure",
        "case_number": "2024-CV-001234",
        "plaintiff": "First National Bank",
        "defendant": "John Doe",
        "attorney_name": "Smith & Associates",
        "attorney_phone": "615-555-0100",
        "source": "tnledger",
        "created_at": "2024-07-16T10:00:00Z"
      },
      "contacts": [
        {
          "id": "789e0123-e89b-12d3-a456-426614174002",
          "name_first": "John",
          "name_last": "Doe",
          "contact_type": "owner",
          "phones": [
            {
              "number": "615-555-0123",
              "label": "primary",
              "verified": false,
              "source": "connected_investors"
            }
          ],
          "emails": [
            {
              "email": "john@example.com",
              "label": "primary",
              "verified": false,
              "source": "connected_investors"
            }
          ],
          "role": "owner",
          "confidence": 0.8
        }
      ],
      "pipeline": {
        "stage": "enriched",
        "priority_score": 85,
        "stage_updated_at": "2024-07-16T10:30:00Z",
        "assigned_to": null,
        "notes": null
      },
      "skip_trace_summary": {
        "last_run": "2024-07-16T10:30:00Z",
        "provider": "connected_investors",
        "status": "completed",
        "contacts_found": 2
      },
      "created_at": "2024-07-16T10:00:00Z",
      "updated_at": "2024-07-16T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 1203,
    "limit": 100,
    "offset": 0,
    "has_more": true
  },
  "filters_applied": {
    "county": "Davidson",
    "enriched": true
  }
}
```

### Get Property

`GET /api/properties/{id}`

Retrieve detailed information for a specific property.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Property ID |

#### Response

```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "full_address": "123 Main St, Nashville, TN 37201",
    "normalized_address": "123 main nashville tn 37201",
    "street_address": "123 Main St",
    "city": "Nashville",
    "state": "TN",
    "zip_code": "37201",
    "county": "Davidson",
    "property_type": "Single Family",
    "latitude": 36.1627,
    "longitude": -86.7816,
    "distance_to_nashville_miles": 2.5,
    "distance_to_mtjuliet_miles": 25.3,
    "within_30min_nashville": true,
    "within_30min_mtjuliet": false,
    "events": [
      {
        "id": "456e7890-e89b-12d3-a456-426614174001",
        "event_type": "foreclosure",
        "sale_date": "2024-08-15",
        "auction_type": "foreclosure",
        "case_number": "2024-CV-001234",
        "plaintiff": "First National Bank",
        "defendant": "John Doe",
        "attorney_name": "Smith & Associates",
        "attorney_phone": "615-555-0100",
        "source": "tnledger",
        "source_url": "https://tnledger.com/notices/...",
        "raw_data": { /* original scraped data */ },
        "created_at": "2024-07-16T10:00:00Z"
      }
    ],
    "contacts": [
      {
        "id": "789e0123-e89b-12d3-a456-426614174002",
        "name_first": "John",
        "name_last": "Doe",
        "entity_name": null,
        "contact_type": "owner",
        "phones": [
          {
            "number": "615-555-0123",
            "label": "primary",
            "verified": false,
            "source": "connected_investors"
          },
          {
            "number": "615-555-0124",
            "label": "secondary",
            "verified": false,
            "source": "connected_investors"
          }
        ],
        "emails": [
          {
            "email": "john@example.com",
            "label": "primary",
            "verified": false,
            "source": "connected_investors"
          },
          {
            "email": "john.alt@example.com",
            "label": "secondary",
            "verified": false,
            "source": "connected_investors"
          }
        ],
        "mailing_address": {
          "street": "456 Oak Ave",
          "city": "Nashville",
          "state": "TN",
          "zip": "37205"
        },
        "notes": "Skip traced via Connected Investors on 2024-07-16",
        "role": "owner",
        "confidence": 0.8,
        "last_validated_at": null,
        "created_at": "2024-07-16T10:30:00Z"
      }
    ],
    "pipeline": {
      "stage": "enriched",
      "priority_score": 85,
      "stage_updated_at": "2024-07-16T10:30:00Z",
      "assigned_to": null,
      "notes": null,
      "expected_close_date": null
    },
    "skip_trace_runs": [
      {
        "id": "abc12345-e89b-12d3-a456-426614174003",
        "provider": "connected_investors",
        "status": "completed",
        "cost_credits": 1,
        "results_summary": {
          "emails_found": 2,
          "phones_found": 2,
          "owners_found": 1
        },
        "run_by": "system",
        "created_at": "2024-07-16T10:30:00Z",
        "completed_at": "2024-07-16T10:31:00Z"
      }
    ],
    "created_at": "2024-07-16T10:00:00Z",
    "updated_at": "2024-07-16T10:30:00Z"
  }
}
```

### Property Analysis

`GET /api/properties/{id}/analyze`

Get AI-powered property analysis and scoring breakdown.

**Note**: Requires `ENABLE_AI_ANALYSIS=1` and valid OpenAI API key.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Property ID |

#### Response

```json
{
  "data": {
    "property_id": "123e4567-e89b-12d3-a456-426614174000",
    "analysis": {
      "overall_score": 85,
      "score_breakdown": {
        "location": {
          "score": 20,
          "max_score": 20,
          "factors": {
            "county_match": 20,
            "nashville_proximity": 15,
            "mtjuliet_proximity": 0
          }
        },
        "timing": {
          "score": 25,
          "max_score": 25,
          "factors": {
            "days_to_sale": 15,
            "optimal_window": true
          }
        },
        "contact_enrichment": {
          "score": 10,
          "max_score": 10,
          "factors": {
            "has_contacts": true,
            "contact_quality": "high"
          }
        },
        "property_characteristics": {
          "score": 30,
          "max_score": 45,
          "factors": {
            "property_type": "Single Family",
            "estimated_value": "moderate"
          }
        }
      },
      "ai_insights": {
        "summary": "High-priority foreclosure property in target area with good contact enrichment.",
        "recommendations": [
          "Contact within 7 days of sale date",
          "Strong location in Davidson County",
          "Good contact information available for outreach"
        ],
        "risk_factors": [
          "Competitive area - act quickly",
          "Verify contact information accuracy"
        ]
      },
      "comparable_properties": [
        {
          "id": "def45678-e89b-12d3-a456-426614174004",
          "address": "456 Oak St, Nashville, TN 37201",
          "similarity_score": 0.92,
          "outcome": "purchased"
        }
      ]
    },
    "generated_at": "2024-07-16T15:00:00Z"
  }
}
```

## Skip Trace API

### Execute Skip Trace

`POST /api/skip-trace`

Execute skip trace for a property using Connected Investors.

#### Request Body

```json
{
  "propertyId": "123e4567-e89b-12d3-a456-426614174000"
}
```

#### Response

```json
{
  "success": true,
  "message": "Skip trace completed successfully",
  "data": {
    "emails": [
      "john@example.com",
      "john.alt@example.com"
    ],
    "phones": [
      "615-555-0123",
      "615-555-0124"
    ],
    "owners": [
      "John Doe"
    ],
    "parsedOwners": [
      {
        "firstName": "John",
        "lastName": "Doe",
        "fullName": "John Doe"
      }
    ]
  },
  "skip_trace_run_id": "abc12345-e89b-12d3-a456-426614174003",
  "cost_credits": 1,
  "contacts_created": 1,
  "pipeline_updated": true
}
```

#### Error Response

```json
{
  "success": false,
  "error": "Skip trace failed",
  "details": "Connected Investors API returned error: Invalid credentials",
  "status": "failed"
}
```

## Data Ingestion API

### Ingest Properties

`POST /api/ingest`

Ingest new foreclosure data into the normalized schema.

#### Request Body

```json
{
  "source": "tnledger",
  "properties": [
    {
      "address": "123 Main St, Nashville, TN 37201",
      "city": "Nashville",
      "state": "TN",
      "zip_code": "37201",
      "county": "Davidson",
      "property_type": "Single Family",
      "sale_date": "2024-08-15",
      "auction_type": "foreclosure",
      "case_number": "2024-CV-001234",
      "plaintiff": "First National Bank",
      "defendant": "John Doe",
      "attorney_name": "Smith & Associates",
      "attorney_phone": "615-555-0100",
      "source_url": "https://tnledger.com/notices/...",
      "raw_data": {
        "original_html": "<div>...</div>",
        "scrape_timestamp": "2024-07-16T09:00:00Z"
      }
    }
  ]
}
```

#### Response

```json
{
  "success": true,
  "results": {
    "total_processed": 1,
    "properties_created": 0,
    "properties_updated": 1,
    "events_created": 1,
    "errors": []
  },
  "details": [
    {
      "address": "123 Main St, Nashville, TN 37201",
      "property_id": "123e4567-e89b-12d3-a456-426614174000",
      "action": "updated",
      "event_id": "456e7890-e89b-12d3-a456-426614174001",
      "event_action": "created"
    }
  ]
}
```

## Legacy Data API

### Get Legacy Data

`GET /api/data`

Legacy endpoint that maintains backward compatibility using the foreclosure_properties view.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `county` | string | Filter by county |
| `source` | string | Filter by source |
| `limit` | number | Results limit |
| `offset` | number | Pagination offset |

#### Response

```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "address": "123 Main St, Nashville, TN 37201",
      "city": "Nashville",
      "state": "TN",
      "zip_code": "37201",
      "county": "Davidson",
      "property_type": "Single Family",
      "latitude": 36.1627,
      "longitude": -86.7816,
      "sale_date": "2024-08-15",
      "auction_type": "foreclosure",
      "case_number": "2024-CV-001234",
      "plaintiff": "First National Bank",
      "defendant": "John Doe",
      "attorney_name": "Smith & Associates",
      "attorney_phone": "615-555-0100",
      "source": "tnledger",
      "owner_email_1": "john@example.com",
      "owner_email_2": "john.alt@example.com",
      "owner_phone_1": "615-555-0123",
      "owner_phone_2": "615-555-0124",
      "created_at": "2024-07-16T10:00:00Z",
      "updated_at": "2024-07-16T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 1203,
    "limit": 100,
    "offset": 0
  }
}
```

## Pipeline Management API

### Update Pipeline Stage

`PUT /api/properties/{id}/pipeline`

Update the pipeline stage for a property.

#### Request Body

```json
{
  "stage": "contacted",
  "assigned_to": "john.smith@company.com",
  "notes": "Initial contact made, interested in cash offer",
  "expected_close_date": "2024-08-30"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "property_id": "123e4567-e89b-12d3-a456-426614174000",
    "stage": "contacted",
    "previous_stage": "enriched",
    "stage_updated_at": "2024-07-16T16:00:00Z",
    "assigned_to": "john.smith@company.com",
    "notes": "Initial contact made, interested in cash offer",
    "expected_close_date": "2024-08-30"
  }
}
```

### Pipeline Stages

| Stage | Description |
|-------|-------------|
| `new` | Recently discovered property |
| `enriched` | Contact information obtained |
| `contacted` | Initial outreach completed |
| `qualified` | Interested and qualified lead |
| `under_contract` | Purchase agreement signed |
| `closed` | Transaction completed |
| `dead` | No longer viable |

## Scoring API

### Get Scoring Rules

`GET /api/scoring/rules`

Retrieve current property scoring configuration.

#### Response

```json
{
  "data": [
    {
      "id": "rule-001",
      "label": "Nashville Investor",
      "description": "Primary buy box criteria for Nashville area",
      "config": {
        "target_counties": ["Davidson", "Sumner", "Wilson"],
        "max_drive_time_min": 30,
        "min_score_threshold": 60,
        "scoring_weights": {
          "county_match": 20,
          "nashville_proximity": 15,
          "mtjuliet_proximity": 15,
          "days_to_sale": 25,
          "contact_enrichment": 10,
          "property_type": 15
        }
      },
      "is_active": true,
      "created_at": "2024-07-16T10:00:00Z"
    }
  ]
}
```

## Webhook Endpoints

### Apify Webhook

`POST /api/webhooks/apify`

Webhook endpoint for Apify actor completions.

#### Request Body

```json
{
  "actorId": "connected-investors-skip-trace",
  "runId": "abc123...",
  "status": "SUCCEEDED",
  "data": {
    "propertyId": "123e4567-e89b-12d3-a456-426614174000",
    "results": {
      "emails": ["john@example.com"],
      "phones": ["615-555-0123"],
      "owners": ["John Doe"]
    }
  }
}
```

## Rate Limiting

API endpoints have the following rate limits:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/properties` | 100 requests | 1 minute |
| `/api/skip-trace` | 10 requests | 1 minute |
| `/api/ingest` | 50 requests | 1 minute |
| `/api/data` (legacy) | 200 requests | 1 minute |

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642694400
```

## Feature Flag Behavior

API behavior changes based on feature flag configuration:

### USE_LEGACY=1 (Legacy Mode)
- `/api/data` uses `foreclosure_data` table
- `/api/skip-trace` updates individual columns
- `/api/properties` may return 404 or limited data

### USE_LEGACY=0 (vNext Mode)
- `/api/data` uses `foreclosure_properties` view
- `/api/skip-trace` uses normalized schema with dual-write
- `/api/properties` fully functional with vNext features

### ENABLE_AI_ANALYSIS=1
- `/api/properties/{id}/analyze` endpoint available
- Property scoring includes AI insights
- Requires valid OpenAI API key

## Error Codes

| Code | Description |
|------|-------------|
| `PROPERTY_NOT_FOUND` | Property ID does not exist |
| `INVALID_PARAMETERS` | Request parameters are invalid |
| `SKIP_TRACE_FAILED` | Skip trace operation failed |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `FEATURE_DISABLED` | Feature not enabled via flags |
| `AI_ANALYSIS_UNAVAILABLE` | AI analysis not configured |
| `DATABASE_ERROR` | Database operation failed |
| `AUTHENTICATION_REQUIRED` | Valid token required |

## Development and Testing

### API Testing Commands

```bash
# Test properties API
npm run api:test

# Test skip trace functionality
npm run skip-trace:test

# Test scoring system
npm run scoring:test
```

### Example Requests

#### cURL Examples

```bash
# Get properties with filters
curl -X GET "http://localhost:3000/api/properties?county=Davidson&enriched=true&limit=10" \
  -H "Content-Type: application/json"

# Execute skip trace
curl -X POST "http://localhost:3000/api/skip-trace" \
  -H "Content-Type: application/json" \
  -d '{"propertyId": "123e4567-e89b-12d3-a456-426614174000"}'

# Ingest new property data
curl -X POST "http://localhost:3000/api/ingest" \
  -H "Content-Type: application/json" \
  -d '{"source": "test", "properties": [{"address": "123 Test St", "sale_date": "2024-08-15"}]}'
```

## Support

For API support and questions:

1. **Documentation**: Check this reference and README_VNEXT.md
2. **Testing**: Use built-in test scripts for validation
3. **Monitoring**: Use health check endpoints for system status
4. **Development Team**: [Configure team contact information]

---

*This API reference covers the vNext foreclosure scraper system. For legacy API documentation, refer to the original system documentation.*