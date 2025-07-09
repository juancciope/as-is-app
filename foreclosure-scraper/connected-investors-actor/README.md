# Connected Investors Property Scraper

This Apify actor scrapes property data from Connected Investors platform and performs skip tracing to find owner contact information.

## Features

- **Automated Login**: Securely logs into Connected Investors platform
- **Property Search**: Searches for properties by address
- **Data Extraction**: Extracts comprehensive property information including:
  - Property address
  - Price information
  - Bedrooms/bathrooms
  - Square footage
  - Lot size
  - Year built
  - Property type
- **Skip Tracing**: Attempts to find owner contact information including:
  - Owner names
  - Email addresses
  - Phone numbers
  - Mailing addresses
- **Multiple Address Support**: Can process multiple addresses in a single run

## Input Parameters

- **username** (required): Your Connected Investors username or email
- **password** (required): Your Connected Investors login password
- **addresses** (required): Array of property addresses to search for
- **skipTrace** (optional): Enable/disable skip tracing (default: true)
- **maxProperties** (optional): Maximum properties to process per address (default: 10)
- **headless** (optional): Run browser in headless mode (default: true)

## Example Input

```json
{
  "username": "your_username_or_email",
  "password": "your_password",
  "addresses": [
    "522 Acorn Way, Mt Juliet",
    "123 Main Street, Nashville",
    "456 Oak Avenue, Franklin"
  ],
  "skipTrace": true,
  "maxProperties": 5,
  "headless": true
}
```

## Output Format

The actor outputs an array of property objects with the following structure:

```json
{
  "searchAddress": "522 Acorn Way, Mt Juliet",
  "address": "522 Acorn Way, Mt Juliet, TN 37122",
  "price": "$450,000",
  "beds": "3",
  "baths": "2",
  "sqft": "1,850",
  "lot_size": "0.25 acres",
  "year_built": "2005",
  "property_type": "Single Family",
  "scraped_at": "2024-07-09T12:00:00.000Z",
  "skipTrace": {
    "attempted_at": "2024-07-09T12:00:00.000Z",
    "method": "connected_investors_platform",
    "results": {
      "emails": ["owner@example.com"],
      "phones": ["(615) 555-0123"],
      "owner_info": "John Smith"
    }
  },
  "links": [
    {
      "url": "/property/details/123456",
      "text": "View Details"
    }
  ],
  "extraction_method": "structured"
}
```

## Error Handling

The actor includes comprehensive error handling:
- Login failures are clearly reported
- Individual address failures don't stop the entire run
- Network timeouts are handled gracefully
- Screenshots are captured for debugging

## Security

- Credentials are handled securely using Apify's secret input fields
- No sensitive information is logged
- Browser fingerprinting countermeasures are implemented

## Requirements

- Valid Connected Investors account
- Sufficient memory allocation (recommended: 2GB+)
- Network access to connectedinvestors.platlabs.com

## Notes

- The actor respects rate limits and includes delays between requests
- Skip tracing results depend on the availability of contact information on the platform
- Some properties may not have complete information available
- The actor is designed to be robust and continue processing even if individual properties fail

## Support

For issues or questions, please check the Apify console logs for detailed error messages and screenshots.