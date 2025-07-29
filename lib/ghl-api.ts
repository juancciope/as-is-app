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
  firstName?: string
  lastName?: string
  name?: string
  email?: string
  phone?: string
  dateAdded: string
  dateUpdated?: string
  tags?: string[]
  source?: string
  customFields?: Array<{
    id: string
    value: string
  }>
  conversationId?: string
}

export class GoHighLevelAPI {
  private config: GHLConfig
  private headers: HeadersInit
  private contactsHeaders: HeadersInit

  constructor(config: GHLConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl || 'https://services.leadconnectorhq.com'
    }
    
    // Headers for conversations API (version 2021-04-15)
    this.headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'Version': '2021-04-15'
    }

    // Headers for contacts API (version 2021-07-28)
    this.contactsHeaders = {
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
    query?: string
    contactId?: string
    lastMessageType?: string
    sort?: 'asc' | 'desc'
    sortBy?: 'last_manual_message_date' | 'last_message_date' | 'score_profile'
  }): Promise<{ conversations: GHLConversation[], total: number }> {
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

    const response = await fetch(
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

  async getMessages(conversationId: string, params?: {
    limit?: number
    lastMessageId?: string
    type?: string
  }): Promise<{ messages: GHLMessage[], lastMessageId: string, nextPage: boolean }> {
    const queryParams = new URLSearchParams()
    if (params?.limit) queryParams.append('limit', String(params.limit))
    if (params?.lastMessageId) queryParams.append('lastMessageId', params.lastMessageId)
    if (params?.type) queryParams.append('type', params.type)

    const url = `${this.config.baseUrl}/conversations/${conversationId}/messages?${queryParams.toString()}`
    console.log('🌐 GHL API URL:', url)
    console.log('📤 GHL API Headers:', this.headers)

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers
    })

    console.log('📥 GHL API Response Status:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ GHL API Error Response:', errorText)
      throw new Error(`Failed to fetch messages: ${response.statusText}`)
    }

    const jsonResponse = await response.json()
    console.log('📨 GHL API JSON Response:', JSON.stringify(jsonResponse, null, 2))
    
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

  async getContacts(params?: {
    locationId?: string
    limit?: number
    query?: string
    startAfter?: number
    startAfterId?: string
  }): Promise<{ contacts: GHLContact[], count: number }> {
    const queryParams = new URLSearchParams()
    
    if (params?.locationId || this.config.locationId) {
      queryParams.append('locationId', params?.locationId || this.config.locationId)
    }
    if (params?.limit) queryParams.append('limit', String(params.limit))
    if (params?.query) queryParams.append('query', params.query)
    if (params?.startAfter) queryParams.append('startAfter', String(params.startAfter))
    if (params?.startAfterId) queryParams.append('startAfterId', params.startAfterId)

    const response = await fetch(
      `${this.config.baseUrl}/contacts/?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: this.contactsHeaders
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch contacts: ${response.statusText}`)
    }

    return await response.json()
  }

  async getContact(contactId: string): Promise<GHLContact> {
    const response = await fetch(
      `${this.config.baseUrl}/contacts/${contactId}`,
      {
        method: 'GET',
        headers: this.contactsHeaders
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch contact: ${response.statusText}`)
    }

    const data = await response.json()
    return data.contact
  }

  // Helper method to get conversations from contacts
  async getConversationsFromContacts(params?: {
    starred?: boolean
    limit?: number
  }): Promise<{ conversations: GHLConversation[], total: number }> {
    try {
      // Get all contacts
      const contactsResult = await this.getContacts({
        limit: params?.limit || 100
      })

      const conversations: GHLConversation[] = []
      
      // For each contact, try to get their conversation
      // Note: We need to somehow determine conversation IDs
      // This is a limitation - we'd need to track conversation IDs separately
      // or use webhook data to know which contacts have active conversations
      
      for (const contact of contactsResult.contacts) {
        try {
          // This is a workaround - in practice you'd need to store conversation IDs
          // or get them from webhook data when conversations are created
          if (contact.conversationId) {
            const conversation = await this.getConversation(contact.conversationId)
            
            // Filter by starred if requested
            if (params?.starred === undefined || conversation.starred === params.starred) {
              // Enrich conversation with contact info
              conversation.contactName = contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
              conversation.contactEmail = contact.email
              conversation.contactPhone = contact.phone
              
              conversations.push(conversation)
            }
          }
        } catch (error) {
          // Skip contacts without valid conversations
          console.warn(`Could not fetch conversation for contact ${contact.id}:`, error)
        }
      }

      return {
        conversations,
        total: conversations.length
      }
    } catch (error) {
      throw new Error(`Failed to get conversations from contacts: ${error}`)
    }
  }
}