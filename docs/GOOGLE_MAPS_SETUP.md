# Google Maps API Setup

This guide will help you set up Google Maps API for address autocomplete functionality.

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Create Project" or select an existing project
3. Give your project a name (e.g., "CRM Address Autocomplete")

## Step 2: Enable APIs

1. In the Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for and enable these APIs:
   - **Places API**
   - **Maps JavaScript API**

## Step 3: Create API Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "API Key"
3. Copy your new API key

## Step 4: Secure Your API Key (Important!)

1. Click on your API key to edit it
2. Under "Application restrictions", select "HTTP referrers"
3. Add your allowed referrers:
   - For local development: `http://localhost:3000/*`
   - For production: `https://yourdomain.com/*`
4. Under "API restrictions", select "Restrict key"
5. Select only:
   - Places API
   - Maps JavaScript API
6. Click "Save"

## Step 5: Add API Key to Your Project

1. Create or update your `.env.local` file:

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-api-key-here
```

2. Restart your development server

## Free Tier Limits

Google Maps Platform offers $200 of free usage per month, which includes:
- **Places Autocomplete**: ~40,000 requests/month free
- **Place Details**: ~5,000 requests/month free

For most small to medium applications, this is more than sufficient.

## Testing

After setup, test the autocomplete by:
1. Going to the Leads page
2. Clicking "Add New Property"
3. Start typing an address - you should see suggestions

## Troubleshooting

- **No suggestions appearing**: Check browser console for API errors
- **"API key missing" error**: Ensure `.env.local` is properly configured
- **"This API key is not authorized" error**: Check API key restrictions

## Alternative: Using Without API Key

The component will gracefully degrade to a regular input field if no API key is provided. Users can still manually enter addresses, but won't get autocomplete suggestions.