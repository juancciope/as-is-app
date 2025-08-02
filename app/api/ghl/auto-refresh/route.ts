import { NextRequest, NextResponse } from 'next/server'
import { GHLOAuthManager } from '@/lib/ghl-oauth'
import { VercelEnvUpdater } from '@/lib/vercel-env-updater'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const clientId = process.env.GHL_CLIENT_ID
    const clientSecret = process.env.GHL_CLIENT_SECRET
    const accessToken = process.env.GHL_API_KEY
    const refreshToken = process.env.GHL_REFRESH_TOKEN
    const locationId = process.env.GHL_LOCATION_ID

    // Vercel API configuration
    const vercelApiToken = process.env.VERCEL_API_TOKEN
    const vercelProjectId = process.env.VERCEL_PROJECT_ID
    const vercelTeamId = process.env.VERCEL_TEAM_ID

    if (!clientId || !clientSecret || !refreshToken) {
      return NextResponse.json({
        error: 'Missing OAuth credentials',
        message: 'Need GHL_CLIENT_ID, GHL_CLIENT_SECRET, and GHL_REFRESH_TOKEN'
      }, { status: 500 })
    }

    const oauthManager = new GHLOAuthManager({
      clientId,
      clientSecret,
      accessToken: accessToken || '',
      refreshToken,
      locationId: locationId || ''
    })

    // Get a fresh token
    const newTokens = await oauthManager.refreshAccessToken()

    // If Vercel API credentials are provided, automatically update the environment variables
    if (vercelApiToken && vercelProjectId) {
      try {
        const vercelUpdater = new VercelEnvUpdater(vercelApiToken, vercelProjectId, vercelTeamId)
        await vercelUpdater.updateGHLTokens(newTokens.access_token, newTokens.refresh_token)
        
        return NextResponse.json({
          success: true,
          message: 'Tokens refreshed and automatically updated in Vercel',
          expiresIn: newTokens.expires_in,
          automated: true
        })
      } catch (vercelError: any) {
        console.error('Failed to update Vercel env vars:', vercelError)
        
        // Still return the tokens even if Vercel update failed
        return NextResponse.json({
          success: true,
          newTokens: {
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token,
            expires_in: newTokens.expires_in
          },
          message: 'Tokens refreshed successfully but failed to update Vercel automatically',
          vercelError: vercelError.message,
          automated: false
        })
      }
    } else {
      // Manual update required
      return NextResponse.json({
        success: true,
        newTokens: {
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          expires_in: newTokens.expires_in
        },
        message: 'Tokens refreshed successfully. Manual update required.',
        instructions: [
          'To enable automatic updates, add these environment variables:',
          '- VERCEL_API_TOKEN: Your Vercel API token',
          '- VERCEL_PROJECT_ID: Your Vercel project ID',
          '- VERCEL_TEAM_ID: Your Vercel team ID (optional)'
        ],
        automated: false
      })
    }

  } catch (error: any) {
    return NextResponse.json({
      error: 'Token refresh failed',
      message: error.message,
      suggestion: 'You may need to go through the OAuth flow again'
    }, { status: 500 })
  }
}