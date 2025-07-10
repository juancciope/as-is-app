# Connected Investors Skip Trace Service

This actor provides a long-running service that performs on-demand skip tracing for individual properties through Connected Investors.

## How it works

1. The actor starts up and logs into Connected Investors
2. It runs an Express server that listens for skip trace requests
3. When a request is received, it searches for the property and performs skip tracing
4. Returns contact information (emails, phones, owner names) immediately

## Input

```json
{
  "username": "your_connected_investors_username",
  "password": "your_connected_investors_password"
}
```

## API Endpoints

- `GET /health` - Health check endpoint
- `POST /skip-trace` - Submit a property for skip tracing

### Skip Trace Request Format

```json
{
  "propertyId": "unique_property_id",
  "address": "123 Main St, Nashville, TN"
}
```

### Response Format

```json
{
  "success": true,
  "propertyId": "unique_property_id",
  "data": {
    "emails": ["email1@example.com", "email2@example.com"],
    "phones": ["615-555-1234", "615-555-5678"],
    "owners": ["John Doe", "Jane Doe"]
  }
}
```

## Features

- Persistent login session
- Real-time skip tracing
- Automatic retry on failures
- Concurrent request handling
- OAuth authentication support

## Usage

1. Deploy this actor to Apify
2. Run the actor with your Connected Investors credentials
3. Get the webhook URL from the running actor
4. Send POST requests to `{webhook_url}/skip-trace` with property details
5. Receive contact information immediately

## Notes

- The actor stays running continuously to maintain the login session
- Each skip trace request takes approximately 10-20 seconds
- Properties are automatically saved to the "Foreclousure Scraping" list
- The service includes automatic error handling and retries