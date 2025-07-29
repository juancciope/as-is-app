# Go High Level Integration Setup

## Overview
The AS-IS CRM integrates with Go High Level (GHL) to display and manage starred conversations from your SMS campaigns.

## Setup Instructions

### 1. Create OAuth App (If you haven't already)

1. Go to [GHL Marketplace](https://marketplace.gohighlevel.com/)
2. Sign up for a developer account
3. Go to "My Apps" and click "Create App"
4. Fill in the required details
5. Configure scopes: `conversations/message.readonly` and `conversations/message.write`
6. Copy your **Client ID** and **Client Secret**

### 2. Get OAuth Tokens

You need to go through the OAuth flow to get access and refresh tokens:

1. **Authorization URL**: Replace `YOUR_CLIENT_ID` and create this URL:
   ```
   https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=https://your-app.com/oauth/callback&client_id=YOUR_CLIENT_ID&scope=conversations/message.readonly conversations/message.write
   ```

2. **Get Authorization Code**: Visit the URL, select your location, get the `code` parameter

3. **Exchange for Tokens**: Use the code to get access and refresh tokens via the OAuth token endpoint

### 3. Get Your Location ID

1. In GHL, go to **Settings > Business Profile**
2. Find your Location ID (usually starts with a letter followed by numbers)
3. Copy the Location ID

### 4. Configure Environment Variables

#### For Vercel Production:
1. Go to your Vercel project dashboard
2. Navigate to **Settings > Environment Variables**
3. Add these variables:
   - `GHL_CLIENT_ID` - Your OAuth app client ID
   - `GHL_CLIENT_SECRET` - Your OAuth app client secret
   - `GHL_API_KEY` - Your OAuth access token (JWT)
   - `GHL_REFRESH_TOKEN` - Your OAuth refresh token
   - `GHL_LOCATION_ID` - Your GHL Location ID
4. Redeploy your application for changes to take effect

#### For Local Development:
Add these to your `.env.local` file:

```bash
# Go High Level Integration (OAuth 2.0)
GHL_CLIENT_ID=your_oauth_client_id_here
GHL_CLIENT_SECRET=your_oauth_client_secret_here
GHL_API_KEY=your_oauth_access_token_here
GHL_REFRESH_TOKEN=your_oauth_refresh_token_here
GHL_LOCATION_ID=your_ghl_location_id_here
```

### 4. Test the Integration

1. For production: Visit your Vercel deployment URL
2. For local: Start dev server with `npm run dev`
3. Navigate to the Leads page using the sidebar
4. You should see your starred conversations from GHL

## API Endpoints

The integration provides these endpoints:

- `GET /api/ghl/conversations` - Currently returns empty (GHL API limitation)
- `GET /api/ghl/messages/[conversationId]` - Get messages for a specific conversation
- `POST /api/ghl/messages/[conversationId]` - Send a message (requires contactId)

## Important GHL API Limitations

⚠️ **No List Conversations Endpoint**: The GHL API doesn't provide a direct way to list all conversations. To implement this feature, you would need to:

1. Get all contacts from your location (using the Contacts API)
2. For each contact, check if they have active conversations
3. Fetch individual conversations using their specific IDs

## Current Features

- **Individual Conversation Access**: Fetch specific conversations by ID
- **Message History**: Get full message history for conversations
- **Send Messages**: Send SMS, Email, or other message types
- **Proper Error Handling**: Clear error messages for API issues

## To Implement Full Conversation List

You'll need to extend the integration to:
1. Add the Contacts API endpoints
2. Create a method to discover conversation IDs
3. Cache conversation data for better performance

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