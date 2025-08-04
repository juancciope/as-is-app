import { GoHighLevelAPI, GHLConfig } from './ghl-api'
import { GHLOAuthManager, GHLTokenResponse } from './ghl-oauth'

export interface GHLConfigWithRefresh extends GHLConfig {
  clientId?: string
  clientSecret?: string
  refreshToken?: string
  onTokenRefresh?: (newAccessToken: string, newRefreshToken: string) => Promise<void>
}

export class GoHighLevelAPIWithRefresh extends GoHighLevelAPI {
  private oauthManager?: GHLOAuthManager
  private onTokenRefresh?: (newAccessToken: string, newRefreshToken: string) => Promise<void>
  private refreshPromise?: Promise<GHLTokenResponse>
  
  // Make config accessible for testing
  public get apiConfig() {
    return super['config']
  }

  constructor(config: GHLConfigWithRefresh) {
    super(config)
    
    // Initialize OAuth manager if we have refresh credentials
    if (config.clientId && config.clientSecret && config.refreshToken) {
      this.oauthManager = new GHLOAuthManager({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        accessToken: config.apiKey,
        refreshToken: config.refreshToken,
        locationId: config.locationId
      })
      this.onTokenRefresh = config.onTokenRefresh
    }
  }

  // Override the base fetch method to handle 401 errors
  private async fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
    // Clone the options to avoid mutating the original
    const clonedOptions = { ...options }
    let response = await fetch(url, clonedOptions)
    
    // If we get a 401 and have OAuth manager, try to refresh the token
    if (response.status === 401 && this.oauthManager) {
      console.log('🔄 Access token expired, attempting to refresh...')
      
      try {
        // Use a single refresh promise to prevent race conditions
        if (!this.refreshPromise) {
          this.refreshPromise = this.oauthManager.refreshAccessToken()
        }
        
        const newTokens = await this.refreshPromise
        console.log('✅ Token refreshed successfully:', {
          hasAccessToken: !!newTokens.access_token,
          hasRefreshToken: !!newTokens.refresh_token,
          expiresIn: newTokens.expires_in
        })
        
        // Update internal config and OAuth manager
        super['config'].apiKey = newTokens.access_token
        this.oauthManager.config.accessToken = newTokens.access_token
        this.oauthManager.config.refreshToken = newTokens.refresh_token
        
        // Update headers with new token
        this.updateHeaders()
        
        // Call the callback to persist the new tokens to environment variables
        if (this.onTokenRefresh) {
          console.log('💾 Persisting new tokens to environment variables...')
          await this.onTokenRefresh(newTokens.access_token, newTokens.refresh_token)
          console.log('✅ Tokens persisted successfully')
        }
        
        // Clear the refresh promise
        this.refreshPromise = undefined
        
        // Create new options with updated headers
        const newOptions = {
          ...clonedOptions,
          headers: {
            ...this.headers
          }
        }
        
        // Retry the request with new token
        response = await fetch(url, newOptions)
        console.log('🔄 Retry with new token - Status:', response.status)
        
      } catch (error) {
        console.error('❌ Token refresh failed:', error)
        this.refreshPromise = undefined
        throw new Error(`Token refresh failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    
    return response
  }

  // Override all API methods to use fetchWithRetry
  async getConversation(conversationId: string) {
    const response = await this.fetchWithRetry(
      `${this.config.baseUrl}/conversations/${conversationId}`,
      {
        method: 'GET',
        headers: this.headers
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch conversation: ${response.statusText}`)
    }

    const data = await response.json()
    return data.conversation
  }

  async getConversations(params?: any) {
    const queryParams = new URLSearchParams()
    
    if (params?.locationId || this.config.locationId) {
      queryParams.append('locationId', params?.locationId || this.config.locationId)
    }
    if (params?.assignedTo) queryParams.append('assignedTo', params.assignedTo)
    if (params?.contactId) queryParams.append('contactId', params.contactId)
    if (params?.query) queryParams.append('query', params.query)
    if (params?.lastMessageType) queryParams.append('lastMessageType', params.lastMessageType)
    if (params?.limit) queryParams.append('limit', String(params.limit))
    if (params?.sort) queryParams.append('sort', params.sort)
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy)
    
    // Handle status parameter - starred becomes status=starred
    if (params?.starred) {
      queryParams.append('status', 'starred')
    } else if (params?.status) {
      queryParams.append('status', params.status)
    }

    const response = await this.fetchWithRetry(
      `${this.config.baseUrl}/conversations/search?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: this.headers
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to search conversations: ${response.statusText}`)
    }

    const data = await response.json()
    return {
      conversations: data.conversations.map((conv: any) => ({
        ...conv,
        contactName: conv.fullName || conv.contactName,
        contactEmail: conv.email,
        contactPhone: conv.phone,
        starred: conv.status === 'starred' || false,
        lastMessageBody: conv.lastMessageBody,
        lastMessageDate: conv.lastMessageDate,
        lastMessageType: conv.lastMessageType,
        unreadCount: conv.unreadCount
      })),
      total: data.total
    }
  }

  async getMessages(conversationId: string, params?: any) {
    const queryParams = new URLSearchParams()
    if (params?.limit) queryParams.append('limit', String(params.limit))
    if (params?.lastMessageId) queryParams.append('lastMessageId', params.lastMessageId)
    if (params?.type) queryParams.append('type', params.type)

    const url = `${this.config.baseUrl}/conversations/${conversationId}/messages?${queryParams.toString()}`
    
    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: this.headers
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ GHL API Error Response:', errorText)
      throw new Error(`Failed to fetch messages: ${response.statusText}`)
    }

    const jsonResponse = await response.json()
    
    // Handle the nested structure - messages are in jsonResponse.messages.messages
    if (jsonResponse.messages && Array.isArray(jsonResponse.messages.messages)) {
      return {
        messages: jsonResponse.messages.messages,
        lastMessageId: jsonResponse.messages.lastMessageId,
        nextPage: jsonResponse.messages.nextPage
      }
    }
    
    return jsonResponse
  }

  async sendMessage(message: any) {
    const response = await this.fetchWithRetry(
      `${this.config.baseUrl}/conversations/messages`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          type: message.type,
          contactId: message.contactId,
          message: message.message,
          attachments: message.attachments,
          subject: message.subject,
          emailFrom: message.emailFrom,
          fromNumber: message.fromNumber,
          toNumber: message.toNumber
        })
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`)
    }

    const data = await response.json()
    return {
      conversationId: data.conversationId,
      messageId: data.messageId
    }
  }

  async getContact(contactId: string) {
    const url = `${this.config.baseUrl}/contacts/${contactId}`
    
    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: this.contactsHeaders
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ GHL Contact API Error Response:', errorText)
      throw new Error(`Failed to fetch contact: ${response.statusText}`)
    }

    const data = await response.json()
    return data.contact
  }

  // Update headers with new token
  public updateHeaders() {
    this.headers = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'Version': '2021-04-15'
    }
    
    this.contactsHeaders = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'Version': '2021-07-28'
    }
  }

  async searchContacts(query: string): Promise<{ contacts: any[], total: number }> {
    const queryParams = new URLSearchParams({
      locationId: this.config.locationId,
      query,
      limit: '10'
    })

    const response = await this.fetchWithRetry(
      `${this.config.baseUrl}/contacts/?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: this.headers
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to search contacts: ${response.statusText}`)
    }

    const data = await response.json()
    return {
      contacts: data.contacts || [],
      total: data.meta?.total || 0
    }
  }

  async createContact(contact: {
    firstName: string
    lastName?: string
    phone?: string
    email?: string
    locationId: string
  }): Promise<{ contact: any }> {
    const response = await this.fetchWithRetry(
      `${this.config.baseUrl}/contacts/`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(contact)
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to create contact: ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    return data
  }

  async starConversation(conversationId: string): Promise<void> {
    console.log(`🌟 Attempting to star conversation ${conversationId} via PUT request`);
    const response = await this.fetchWithRetry(
      `${this.config.baseUrl}/conversations/${conversationId}`,
      {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify({
          starred: true
        })
      }
    )

    console.log(`📊 Star conversation response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Star conversation failed: ${response.status} ${response.statusText} - ${errorText}`);
      throw new Error(`Failed to star conversation: ${response.statusText} - ${errorText}`)
    }
    
    const responseData = await response.text();
    console.log(`✅ Star conversation successful. Response: ${responseData}`);
  }
}