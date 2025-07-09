# Connected Investors Property Enricher

This Apify actor enriches foreclosure data from your Supabase database with contact information from Connected Investors.

## Features

- **Database Integration**: Reads properties from Supabase foreclosure_data table
- **Smart Filtering**: Only processes properties that need enrichment
- **Skip Already Enriched**: Avoids re-processing properties that already have contact info
- **Batch Processing**: Processes properties in configurable batches
- **Retry Logic**: Handles failures with configurable retry attempts
- **Multiple Contacts**: Handles multiple emails, phones, and owners per property
- **Database Updates**: Updates Supabase with enriched contact information

## Workflow

1. **Login**: Authenticates with Connected Investors using OAuth
2. **Fetch Properties**: Retrieves properties from Supabase that need enrichment
3. **Search Properties**: Searches for each property on Connected Investors
4. **Save & Skip Trace**: Saves properties to "Foreclousure Scraping" list and performs skip trace
5. **Extract Contacts**: Extracts emails, phone numbers, and owner information
6. **Update Database**: Updates Supabase with enriched contact data

## Database Schema

The actor expects the following fields in the `foreclosure_data` table:

### Input Fields
- `id`: Primary key
- `address`: Property address for matching
- `created_at`: Date filter for recent properties

### Output Fields (Updated)
- `owner_emails`: Comma-separated list of emails
- `owner_phones`: Comma-separated list of phone numbers  
- `owner_info`: Pipe-separated list of owner names
- `skip_trace`: JSON object with enrichment details
- `updated_at`: Timestamp of last update

## Configuration

### Required Environment Variables

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
```

### Input Parameters

- **username**: Connected Investors login email
- **password**: Connected Investors login password
- **batchSize**: Number of properties to process per batch (default: 10)
- **maxRetries**: Maximum retries for failed properties (default: 3)
- **skipAlreadyEnriched**: Skip properties with existing contact data (default: true)

## Usage

### 1. Manual Run
Run the actor manually from Apify Console with your credentials.

### 2. Scheduled Run
Set up a scheduled run to enrich properties daily after all scrapers complete.

### 3. API Integration
Call the actor via API after your scraping pipeline completes:

```javascript
const apifyClient = new ApifyClient({
    token: 'your_apify_token',
});

const run = await apifyClient.actor('your_enricher_actor_id').call({
    username: 'your_username',
    password: 'your_password',
    batchSize: 20,
    skipAlreadyEnriched: true
});
```

## Error Handling

- **Login Failures**: Stops execution and reports credential issues
- **Network Errors**: Retries individual properties up to maxRetries
- **Database Errors**: Logs errors but continues processing other properties
- **Missing Properties**: Skips properties that can't be found on Connected Investors

## Performance

- **Memory**: 2GB recommended for optimal performance
- **Timeout**: 2 hours default for large datasets
- **Batch Size**: Start with 10, increase if stable
- **Rate Limiting**: Built-in delays to respect Connected Investors limits

## Monitoring

The actor provides detailed logging for:
- Properties fetched from database
- Successful enrichments
- Failed enrichments with retry attempts
- Database update confirmations
- Skip trace results summary

## Integration with Existing Pipeline

This enricher is designed to run after your existing scrapers:

1. **Scrapers Run**: Phillips Jones Law, ClearRecon, TN Ledger, WABI PowerBI, Wilson Associates
2. **Data Stored**: Properties stored in Supabase
3. **Enricher Runs**: This actor enriches the stored data
4. **Updated Data**: Properties now have contact information for lead generation

## Support

For issues or questions:
1. Check Apify console logs for detailed error messages
2. Verify Supabase connection and permissions
3. Ensure Connected Investors credentials are valid
4. Review database schema matches expected format