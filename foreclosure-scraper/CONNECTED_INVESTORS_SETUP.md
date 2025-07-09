# Connected Investors Integration Setup

This document explains how to set up and deploy the Connected Investors property scraper with skip tracing functionality.

## Overview

The Connected Investors scraper is designed to:
1. Log into the Connected Investors platform securely
2. Search for properties by address
3. Extract property details and owner information
4. Perform skip tracing to find contact information (emails, phone numbers)
5. Store results in the existing database with enhanced fields for contact data

## Features

### Property Data Extraction
- Property address and details
- Price information
- Bedrooms, bathrooms, square footage
- Lot size, year built, property type
- Property links for detailed views

### Skip Tracing Capabilities
- Owner name extraction
- Email address discovery
- Phone number identification
- Mailing address information
- Contact information from property detail pages

## Setup Instructions

### 1. Deploy the Apify Actor

```bash
cd connected-investors-actor

# Set your Apify token
export APIFY_TOKEN=your_apify_token_here

# Deploy to Apify
./deploy.sh
```

### 2. Configure Environment Variables

Add to your `.env.local` file:
```env
APIFY_ACTOR_ID_CONNECTEDINVESTORS=your_actor_id_here
```

### 3. Connected Investors Credentials

When running the scraper, you'll need to provide:
- **Email**: Your Connected Investors login email
- **Password**: Your Connected Investors login password

These are passed securely through the Apify input system.

## Usage

### From the Dashboard

1. Navigate to your dashboard at https://as-is-app.vercel.app/
2. Find the "Connected Investors" scraper button
3. Click to run individual scraper or include in "Run All Scrapers"

### Direct API Usage

```json
POST /api/scrape-apify
{
  "source": "connectedinvestors"
}
```

### Manual Actor Execution

```json
{
  "email": "your_email@example.com",
  "password": "your_password",
  "addresses": [
    "522 Acorn Way, Mt Juliet",
    "123 Main Street, Nashville"
  ],
  "skipTrace": true,
  "maxProperties": 10,
  "headless": true
}
```

## Data Structure

### Input Data Structure (ConnectedInvestorsData)
```typescript
interface ConnectedInvestorsData {
  searchAddress: string;
  address?: string;
  price?: string;
  beds?: string;
  baths?: string;
  sqft?: string;
  lot_size?: string;
  year_built?: string;
  property_type?: string;
  scraped_at: string;
  skipTrace?: {
    attempted_at: string;
    method: string;
    results: {
      emails?: string[];
      phones?: string[];
      owner_info?: string;
      detail_owner_info?: any;
    };
  };
  links?: Array<{
    url: string;
    text: string;
  }>;
  extraction_method?: string;
  raw_text?: string;
}
```

### Database Storage

The data is transformed and stored in the existing foreclosure_data table with additional fields:
- `property_details`: JSON object with property specifications
- `skip_trace`: Complete skip trace data
- `owner_emails`: Comma-separated list of found emails
- `owner_phones`: Comma-separated list of found phone numbers
- `owner_info`: Primary owner information

## Actor Configuration

### Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| email | string | Yes | - | Connected Investors login email |
| password | string | Yes | - | Connected Investors login password |
| addresses | array | Yes | - | List of property addresses to search |
| skipTrace | boolean | No | true | Enable skip tracing functionality |
| maxProperties | integer | No | 10 | Max properties per address (1-100) |
| headless | boolean | No | true | Run browser in headless mode |

### Error Handling

The actor includes comprehensive error handling:
- Login failure detection with clear error messages
- Individual address failure isolation (continues with other addresses)
- Network timeout handling
- Screenshot capture for debugging
- Graceful degradation when skip tracing fails

## Security Considerations

1. **Credential Security**: Login credentials are handled securely through Apify's secret input fields
2. **Rate Limiting**: Built-in delays between requests to respect platform limits
3. **Browser Fingerprinting**: Countermeasures to avoid detection as automation
4. **Data Privacy**: Contact information is collected only from publicly available sources

## Troubleshooting

### Common Issues

1. **Login Failures**
   - Verify credentials are correct
   - Check if account is locked or requires captcha
   - Review login screenshots in actor logs

2. **No Properties Found**
   - Verify address format is correct
   - Check if address exists in Connected Investors database
   - Review search screenshots for debugging

3. **Skip Tracing Failures**
   - This is normal - not all properties have contact information
   - Check skipTrace.error field for specific error messages
   - Review detail page screenshots

### Debug Mode

Run with `headless: false` to see browser interactions in real-time during development.

## Integration with Existing System

The Connected Investors scraper integrates seamlessly with the existing foreclosure dashboard:

1. **Dashboard Button**: Accessible alongside other scrapers
2. **Data Table**: Contact information displayed in additional columns
3. **Filtering**: Can filter by Connected Investors source
4. **Export**: Contact data included in CSV exports
5. **Run All**: Included in batch scraping operations

## Performance Notes

- **Memory**: Recommended 2GB+ for optimal performance
- **Timeout**: 60 minutes default timeout for large address lists
- **Concurrency**: Processes addresses sequentially to avoid rate limiting
- **Storage**: Property details and contact data stored efficiently in JSON fields

## Compliance

This scraper is designed for legitimate real estate investment research. Users must:
- Have valid Connected Investors account
- Comply with platform terms of service
- Use contact information responsibly
- Follow applicable privacy laws (CCPA, GDPR, etc.)

## Support

For issues or questions:
1. Check Apify console logs for detailed error messages
2. Review screenshots captured during execution
3. Verify environment variables are set correctly
4. Ensure Connected Investors account is active and accessible