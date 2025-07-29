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
  messageType: string
  direction: string
  status: string
  dateAdded: string
  attachments?: string[]
  meta?: any
}

export interface GHLContact {
  id: string
  locationId: string
  firstName: string
  lastName: string
  name: string
  email: string
  phone: string
  conversationId?: string
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
      'Version': '2021-04-15'
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

  // Note: GHL API doesn't have a direct "list conversations" endpoint
  // This would need to be implemented by getting contacts and their conversation IDs
  // For now, this method is a placeholder
  async getConversations(params?: {
    locationId?: string
    assignedTo?: string
    status?: string
    starred?: boolean
    limit?: number
    offset?: number
  }): Promise<{ conversations: GHLConversation[], total: number }> {
    // This endpoint doesn't exist in GHL API
    // Would need to implement by:
    // 1. Getting contacts from the location
    // 2. Getting conversation IDs for each contact
    // 3. Fetching individual conversations
    throw new Error('List conversations endpoint not available in GHL API. Use getConversation(id) instead.')
  }

  async getMessages(conversationId: string, params?: {
    limit?: number
    lastMessageId?: string
    type?: string
  }): Promise<{ messages: GHLMessage[], lastMessageId: string, nextPage: boolean }> {
    const queryParams = new URLSearchParams()
    if (params?.limit) queryParams.append('limit', String(params.limit))
    if (params?.lastMessageId) queryParams.append('lastMessageId', params.lastMessageId)
    if (params?.type) queryParams.append('type', params.type)

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

  async sendMessage(message: {
    type: 'SMS' | 'Email' | 'WhatsApp' | 'IG' | 'FB' | 'Custom' | 'Live_Chat'
    contactId: string
    message: string
    attachments?: string[]
    subject?: string
    emailFrom?: string
    fromNumber?: string
    toNumber?: string
  }): Promise<{ conversationId: string, messageId: string }> {
    const response = await fetch(
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