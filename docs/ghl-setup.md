# Go High Level Integration Setup

## Overview
The AS-IS CRM integrates with Go High Level (GHL) to display and manage starred conversations from your SMS campaigns.

## Setup Instructions

### 1. Get Your GHL API Credentials

1. Log into your Go High Level account
2. Navigate to **Settings > Integrations > API**
3. Create a new API key or use an existing one
4. Copy the API key

### 2. Get Your Location ID

1. In GHL, go to **Settings > Business Profile**
2. Find your Location ID (usually starts with a letter followed by numbers)
3. Copy the Location ID

### 3. Configure Environment Variables

#### For Vercel Production:
1. Go to your Vercel project dashboard
2. Navigate to **Settings > Environment Variables**
3. Add these variables:
   - `GHL_API_KEY` - Your GHL API key
   - `GHL_LOCATION_ID` - Your GHL Location ID
4. Redeploy your application for changes to take effect

#### For Local Development:
Add these to your `.env.local` file:

```bash
# Go High Level Integration
GHL_API_KEY=your_actual_api_key_here
GHL_LOCATION_ID=your_actual_location_id_here
```

### 4. Test the Integration

1. For production: Visit your Vercel deployment URL
2. For local: Start dev server with `npm run dev`
3. Navigate to the Leads page using the sidebar
4. You should see your starred conversations from GHL

## API Endpoints

The integration provides these endpoints:

- `GET /api/ghl/conversations` - Fetch conversations (filters: starred, limit, offset)
- `GET /api/ghl/messages/[conversationId]` - Get messages for a conversation
- `POST /api/ghl/messages/[conversationId]` - Send a message

## Features

- **Starred Conversations**: Only shows conversations marked with a star in GHL
- **Real-time Messaging**: Send and receive messages directly from the CRM
- **Unread Count**: Shows unread message count for each conversation
- **Contact Details**: Displays contact name, phone, and email

## Troubleshooting

### No conversations showing up?
- Verify your API key and Location ID are correct
- Make sure you have starred conversations in GHL
- Check the browser console for error messages

### Authentication errors?
- Ensure your API key has the necessary permissions
- The API key should have access to conversations and messages

### Rate limiting?
- GHL has rate limits on API calls
- If you hit limits, implement caching or reduce request frequency