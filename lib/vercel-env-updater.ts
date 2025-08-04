// Service to update Vercel environment variables
export class VercelEnvUpdater {
  private apiToken: string
  private projectId: string
  private teamId?: string

  constructor(apiToken: string, projectId: string, teamId?: string) {
    this.apiToken = apiToken
    this.projectId = projectId
    this.teamId = teamId
  }

  async updateEnvironmentVariable(key: string, value: string, target: string[] = ['production', 'preview', 'development']) {
    const url = this.teamId 
      ? `https://api.vercel.com/v10/projects/${this.projectId}/env?teamId=${this.teamId}`
      : `https://api.vercel.com/v10/projects/${this.projectId}/env`

    try {
      // First, try to get existing env var to check if it exists
      const existingVar = await this.getEnvironmentVariable(key)
      
      if (existingVar) {
        // Update existing variable
        const updateUrl = this.teamId
          ? `https://api.vercel.com/v10/projects/${this.projectId}/env/${existingVar.id}?teamId=${this.teamId}`
          : `https://api.vercel.com/v10/projects/${this.projectId}/env/${existingVar.id}`
          
        const response = await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            value,
            target
          })
        })

        if (!response.ok) {
          const error = await response.text()
          throw new Error(`Failed to update env var: ${response.status} - ${error}`)
        }

        console.log(`✅ Updated environment variable: ${key}`)
        return await response.json()
      } else {
        // Create new variable
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            key,
            value,
            target,
            type: 'encrypted'
          })
        })

        if (!response.ok) {
          const error = await response.text()
          throw new Error(`Failed to create env var: ${response.status} - ${error}`)
        }

        console.log(`✅ Created environment variable: ${key}`)
        return await response.json()
      }
    } catch (error) {
      console.error(`❌ Error updating Vercel env var ${key}:`, error)
      throw error
    }
  }

  async getEnvironmentVariable(key: string) {
    const url = this.teamId
      ? `https://api.vercel.com/v9/projects/${this.projectId}/env?teamId=${this.teamId}`
      : `https://api.vercel.com/v9/projects/${this.projectId}/env`

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch env vars: ${response.status}`)
      }

      const data = await response.json()
      return data.envs.find((env: any) => env.key === key)
    } catch (error) {
      console.error('Error fetching env vars:', error)
      return null
    }
  }

  async updateGHLTokens(accessToken: string, refreshToken: string) {
    console.log('💾 Starting Vercel env vars update...')
    console.log('🔧 Update config:', {
      hasApiToken: !!this.apiToken,
      hasProjectId: !!this.projectId,
      hasTeamId: !!this.teamId,
      accessTokenLength: accessToken?.length,
      refreshTokenLength: refreshToken?.length
    })

    try {
      // Update tokens sequentially to avoid rate limits
      console.log('📝 Updating GHL_API_KEY...')
      await this.updateEnvironmentVariable('GHL_API_KEY', accessToken)
      
      console.log('📝 Updating GHL_REFRESH_TOKEN...')  
      await this.updateEnvironmentVariable('GHL_REFRESH_TOKEN', refreshToken)
      
      console.log('✅ Successfully updated all GHL tokens in Vercel')
    } catch (error) {
      console.error('❌ Failed to update GHL tokens in Vercel:', error)
      // Don't throw the error - token refresh worked, just persistence failed
      console.warn('⚠️ Token refresh succeeded but persistence to Vercel failed. Manual update may be required.')
    }
  }
}