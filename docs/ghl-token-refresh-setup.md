# GHL Automatic Token Refresh Setup

This application now supports automatic GHL (GoHighLevel) token refresh to prevent authentication failures.

## Features

1. **Automatic Token Refresh**: When a GHL API call returns a 401 (unauthorized) error, the system automatically refreshes the access token using the refresh token.

2. **Vercel Environment Variable Updates**: If configured, the system can automatically update your Vercel environment variables with new tokens.

3. **Zero Downtime**: Token refresh happens transparently without interrupting the user experience.

## Required Environment Variables

### GHL OAuth Credentials (Required)
```env
GHL_CLIENT_ID=your_oauth_client_id
GHL_CLIENT_SECRET=your_oauth_client_secret
GHL_API_KEY=your_access_token
GHL_REFRESH_TOKEN=your_refresh_token
GHL_LOCATION_ID=your_location_id
```

### Vercel API Credentials (Optional - for automatic updates)
```env
VERCEL_API_TOKEN=your_vercel_api_token
VERCEL_PROJECT_ID=your_vercel_project_id
VERCEL_TEAM_ID=your_vercel_team_id  # Optional, only if using teams
```

## How to Get Vercel API Credentials

1. **Vercel API Token**:
   - Go to https://vercel.com/account/tokens
   - Create a new token with appropriate permissions
   - Copy the token value

2. **Vercel Project ID**:
   - Go to your project settings in Vercel
   - The project ID is in the URL: `https://vercel.com/{team}/{project}/settings`
   - Or find it in Project Settings > General

3. **Vercel Team ID** (if applicable):
   - Go to Team Settings
   - Find the Team ID in the URL or settings

## Manual Token Refresh

If you haven't configured automatic Vercel updates, you can manually refresh tokens:

```bash
curl -X POST https://your-app.vercel.app/api/ghl/auto-refresh
```

This will return new tokens that you need to manually update in Vercel.

## Testing Token Refresh

To test if token refresh is working:

```bash
curl -X POST https://your-app.vercel.app/api/ghl/oauth-test
```

## How It Works

1. When any GHL API call fails with a 401 error, the system automatically:
   - Uses the refresh token to get a new access token
   - Retries the failed API call with the new token
   - Updates Vercel environment variables (if configured)

2. The refresh happens transparently - users won't notice any interruption.

3. If Vercel credentials are provided, the system automatically updates the environment variables, and the new tokens will be used on the next deployment.

## Troubleshooting

### Tokens Not Refreshing
- Ensure all GHL OAuth credentials are correctly set
- Check that the refresh token hasn't expired
- Verify client ID and secret match your GHL OAuth app

### Vercel Updates Failing
- Verify your Vercel API token has write permissions
- Ensure the project ID is correct
- Check if you need to include the team ID

### Manual Recovery
If automatic refresh fails, you can:
1. Go through the OAuth flow again: `/admin/ghl-setup`
2. Manually update tokens in Vercel
3. Redeploy the application

## Security Best Practices

1. **Never commit tokens** to your repository
2. **Use encrypted environment variables** in Vercel
3. **Rotate tokens regularly** even if they haven't expired
4. **Monitor token usage** for unusual activity
5. **Set up alerts** for authentication failures

## API Endpoints

- `/api/ghl/auto-refresh` - Manually trigger token refresh
- `/api/ghl/oauth-test` - Test current token validity
- `/api/ghl/refresh-and-update` - Legacy manual refresh endpoint