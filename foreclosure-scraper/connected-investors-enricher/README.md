# Connected Investors Skip Trace Service

This actor performs on-demand skip tracing for individual properties through Connected Investors via Apify's API.

## How it works

1. Each run logs into Connected Investors fresh
2. Searches for the specific property by address
3. Performs skip tracing and extracts contact information
4. Returns results via Apify dataset

## Input

### Service Mode (no property specified)
```json
{
  "username": "your_connected_investors_username",
  "password": "your_connected_investors_password"
}
```

### Skip Trace Mode (specific property)
```json
{
  "username": "your_connected_investors_username", 
  "password": "your_connected_investors_password",
  "propertyId": "unique_property_id",
  "address": "123 Main St, Nashville, TN"
}
```

## Output

Results are saved to the actor's dataset:

```json
{
  "success": true,
  "propertyId": "unique_property_id",
  "address": "123 Main St, Nashville, TN",
  "data": {
    "emails": ["email1@example.com", "email2@example.com"],
    "phones": ["615-555-1234", "615-555-5678"],
    "owners": ["John Doe", "Jane Doe"]
  },
  "processedAt": "2024-01-01T12:00:00.000Z"
}
```

## Features

- OAuth authentication support
- Address matching with autocomplete
- Contact extraction (emails, phones, owners)
- Automatic property saving to lists
- Comprehensive error handling
- Fresh login for each request

## API Integration

The actor is designed to be called via Apify's API:

```javascript
const run = await apifyClient.actor('your-actor-id').call({
  username: 'your_username',
  password: 'your_password', 
  propertyId: 'property123',
  address: '123 Main St, Nashville, TN'
});

const result = await apifyClient.run(run.id).waitForFinish();
const { items } = await apifyClient.dataset(result.defaultDatasetId).listItems();
```

## Environment Variables Needed

For your Next.js app, configure:
- `APIFY_API_TOKEN`: Your Apify API token
- `CONNECTED_INVESTORS_USERNAME`: CI username
- `CONNECTED_INVESTORS_PASSWORD`: CI password
- `APIFY_ACTOR_ID_SKIP_TRACE`: This actor's ID (optional)

## Notes

- Each run takes approximately 30-60 seconds including login
- Properties are automatically saved to the "Foreclousure Scraping" list
- The actor handles OAuth redirects automatically
- Results are cached in Apify datasets for later retrieval