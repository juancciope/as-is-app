export interface GHLConfig {
  apiKey: string
  locationId: string
  baseUrl?: string
}

export interface GHLConversation {
  id: string
  contactId: string
  locationId: string
  assignedTo?: string
  status: string
  starred: boolean
  unreadCount: number
  lastMessageDate: string
  lastMessageBody: string
  lastMessageType: string
  contactName: string
  contactEmail?: string
  contactPhone?: string
  dateAdded: string
  dateUpdated: string
}

export interface GHLMessage {
  id: string
  conversationId: string
  locationId: string
  contactId: string
  body: string
  type: string
  direction: string
  status: string
  dateAdded: string
  attachments?: any[]
}

export class GoHighLevelAPI {
  private config: GHLConfig
  private headers: HeadersInit

  constructor(config: GHLConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl || 'https://services.leadconnectorhq.com'
    }
    
    this.headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'Version': '2021-07-28'
    }
  }

  async getConversation(conversationId: string): Promise<GHLConversation> {
    const response = await fetch(
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

  async getConversations(params?: {
    locationId?: string
    assignedTo?: string
    status?: string
    starred?: boolean
    limit?: number
    offset?: number
  }): Promise<{ conversations: GHLConversation[], total: number }> {
    const queryParams = new URLSearchParams()
    
    if (params?.locationId || this.config.locationId) {
      queryParams.append('locationId', params?.locationId || this.config.locationId)
    }
    if (params?.assignedTo) queryParams.append('assignedTo', params.assignedTo)
    if (params?.status) queryParams.append('status', params.status)
    if (params?.starred !== undefined) queryParams.append('starred', String(params.starred))
    if (params?.limit) queryParams.append('limit', String(params.limit))
    if (params?.offset) queryParams.append('offset', String(params.offset))

    const response = await fetch(
      `${this.config.baseUrl}/conversations?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: this.headers
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch conversations: ${response.statusText}`)
    }

    return await response.json()
  }

  async getMessages(conversationId: string, params?: {
    limit?: number
    offset?: number
  }): Promise<{ messages: GHLMessage[], total: number }> {
    const queryParams = new URLSearchParams()
    if (params?.limit) queryParams.append('limit', String(params.limit))
    if (params?.offset) queryParams.append('offset', String(params.offset))

    const response = await fetch(
      `${this.config.baseUrl}/conversations/${conversationId}/messages?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: this.headers
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch messages: ${response.statusText}`)
    }

    return await response.json()
  }

  async sendMessage(conversationId: string, message: {
    type: 'SMS' | 'Email' | 'WhatsApp' | 'GMB' | 'FB' | 'IG' | 'Custom'
    body: string
    attachments?: string[]
  }): Promise<GHLMessage> {
    const response = await fetch(
      `${this.config.baseUrl}/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          type: message.type,
          message: message.body,
          attachments: message.attachments
        })
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`)
    }

    const data = await response.json()
    return data.message
  }

  async updateConversation(conversationId: string, updates: {
    starred?: boolean
    assignedTo?: string
    status?: string
  }): Promise<GHLConversation> {
    const response = await fetch(
      `${this.config.baseUrl}/conversations/${conversationId}`,
      {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify(updates)
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to update conversation: ${response.statusText}`)
    }

    const data = await response.json()
    return data.conversation
  }
}