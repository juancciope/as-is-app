export interface GHLOAuthConfig {
  clientId: string
  clientSecret: string
  accessToken: string
  refreshToken: string
  locationId: string
}

export interface GHLTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
  scope: string
  locationId: string
  userId: string
}

export class GHLOAuthManager {
  public config: GHLOAuthConfig
  private baseUrl = 'https://services.leadconnectorhq.com'

  constructor(config: GHLOAuthConfig) {
    this.config = config
  }

  async refreshAccessToken(): Promise<GHLTokenResponse> {
    console.log('🔄 Starting token refresh process...')
    console.log('🔧 Refresh token config:', {
      hasClientId: !!this.config.clientId,
      hasClientSecret: !!this.config.clientSecret,
      hasRefreshToken: !!this.config.refreshToken,
      refreshTokenLength: this.config.refreshToken?.length,
      locationId: this.config.locationId
    })

    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: this.config.refreshToken
    })

    console.log('📤 Refresh token request body:', body.toString())

    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body
    })

    console.log('📥 Refresh token response status:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Refresh token failed - Response:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      })
      
      // Check if refresh token is invalid/expired
      if (response.status === 401 && errorText.includes('Invalid refresh token')) {
        throw new Error(`REFRESH_TOKEN_EXPIRED: The refresh token has expired or is invalid. You need to re-authenticate through the OAuth flow to get new tokens. Current refresh token: ${this.config.refreshToken.substring(0, 10)}...`)
      }
      
      throw new Error(`Failed to refresh token: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const tokenData: GHLTokenResponse = await response.json()
    console.log('✅ Token refresh successful:', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      tokenType: tokenData.token_type,
      scope: tokenData.scope
    })
    
    // Update our stored tokens
    this.config.accessToken = tokenData.access_token
    this.config.refreshToken = tokenData.refresh_token

    return tokenData
  }

  async getValidAccessToken(): Promise<string> {
    // Try to use current token first
    try {
      // Test if current token works by making a simple API call
      const testResponse = await fetch(
        `${this.baseUrl}/conversations/search?locationId=${this.config.locationId}&limit=1`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
            'Version': '2021-04-15'
          }
        }
      )

      if (testResponse.ok) {
        // Token is still valid
        return this.config.accessToken
      }

      if (testResponse.status === 401) {
        // Token expired, refresh it
        console.log('Access token expired, refreshing...')
        const newTokens = await this.refreshAccessToken()
        return newTokens.access_token
      }

      throw new Error(`API test failed: ${testResponse.status} ${testResponse.statusText}`)
    } catch (error) {
      // If anything fails, try to refresh the token
      console.log('Error with current token, attempting refresh:', error)
      const newTokens = await this.refreshAccessToken()
      return newTokens.access_token
    }
  }

  getAuthHeaders(): { Authorization: string; 'Content-Type': string; Version: string } {
    return {
      'Authorization': `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json',
      'Version': '2021-04-15'
    }
  }
}