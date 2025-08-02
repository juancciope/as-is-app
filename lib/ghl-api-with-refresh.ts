import { GoHighLevelAPI, GHLConfig } from './ghl-api'
import { GHLOAuthManager } from './ghl-oauth'

export interface GHLConfigWithRefresh extends GHLConfig {
  clientId?: string
  clientSecret?: string
  refreshToken?: string
  onTokenRefresh?: (newAccessToken: string, newRefreshToken: string) => Promise<void>
}

export class GoHighLevelAPIWithRefresh extends GoHighLevelAPI {
  private oauthManager?: GHLOAuthManager
  private onTokenRefresh?: (newAccessToken: string, newRefreshToken: string) => Promise<void>

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
    let response = await fetch(url, options)
    
    // If we get a 401 and have OAuth manager, try to refresh the token
    if (response.status === 401 && this.oauthManager) {
      console.log('🔄 Access token expired, attempting to refresh...')
      
      try {
        const newTokens = await this.oauthManager.refreshAccessToken()
        console.log('✅ Token refreshed successfully')
        
        // Update the headers with new token
        const headers = options.headers as HeadersInit
        if (headers && typeof headers === 'object' && 'Authorization' in headers) {
          headers['Authorization'] = `Bearer ${newTokens.access_token}`
        }
        
        // Update internal config
        this.config.apiKey = newTokens.access_token
        
        // Call the callback to persist the new tokens
        if (this.onTokenRefresh) {
          await this.onTokenRefresh(newTokens.access_token, newTokens.refresh_token)
        }
        
        // Retry the request with new token
        response = await fetch(url, options)
      } catch (error) {
        console.error('❌ Token refresh failed:', error)
        throw error
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

  // Add getter to update headers dynamically
  get headers(): HeadersInit {
    return {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'Version': '2021-04-15'
    }
  }

  get contactsHeaders(): HeadersInit {
    return {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'Version': '2021-07-28'
    }
  }
}