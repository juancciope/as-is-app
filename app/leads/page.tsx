'use client'

import { useState, useEffect } from 'react'
import { Star, Phone, Mail, Loader2, AlertCircle, MessageCircle } from 'lucide-react'
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css'
import './chat-theme.css'
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  ConversationHeader,
  Avatar,
  InfoButton,
  TypingIndicator,
  MessageSeparator
} from '@chatscope/chat-ui-kit-react'

export default function LeadsPage() {
  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [leads, setLeads] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])  
  const [messages, setMessages] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>(null)

  useEffect(() => {
    fetchConversations()
  }, [])


  const fetchConversations = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/ghl/conversations?starred=true')
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch conversations')
      }

      const data = await response.json()
      setLeads(data.conversations || [])
      setContacts(data.contacts || [])
      setDebugInfo(data)
    } catch (error: any) {
      console.error('Error fetching conversations:', error)
      setError(error.message || 'Failed to load conversations')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchMessages = async (conversationId: string) => {
    try {
      setIsLoadingMessages(true)
      const response = await fetch(`/api/ghl/messages/${conversationId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch messages')
      }

      const data = await response.json()
      console.log('Messages API response for conversation', conversationId, ':', data) // Debug log
      
      // Handle different possible response structures
      let messagesArray = []
      if (Array.isArray(data)) {
        messagesArray = data
        console.log('✓ Messages found as direct array:', messagesArray.length)
      } else if (data.messages && Array.isArray(data.messages)) {
        messagesArray = data.messages
        console.log('✓ Messages found in data.messages:', messagesArray.length)
      } else if (data.data && Array.isArray(data.data)) {
        messagesArray = data.data
        console.log('✓ Messages found in data.data:', messagesArray.length)
      } else if (data.results && Array.isArray(data.results)) {
        messagesArray = data.results
        console.log('✓ Messages found in data.results:', messagesArray.length)
      } else {
        console.warn('❌ Messages data is not in expected format:', data)
        console.warn('Available keys:', Object.keys(data))
        messagesArray = []
      }
      
      console.log('📝 Final messages array:', messagesArray)
      console.log('🏷️ Message types found:', messagesArray.map((msg: any) => msg.messageType))
      console.log('📱 SMS messages only:', messagesArray.filter((msg: any) => msg.messageType === 'TYPE_SMS').length)
      setMessages(messagesArray)
    } catch (error) {
      console.error('Error fetching messages:', error)
      setMessages([]) // Ensure messages is always an array
    } finally {
      setIsLoadingMessages(false)
    }
  }

  const sendMessage = async (innerHtml: string, textContent: string) => {
    if (!selectedLead || !textContent.trim()) return

    try {
      setIsSending(true)
      const response = await fetch(`/api/ghl/messages/${selectedLead.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: textContent,
          type: 'SMS',
          contactId: selectedLead.contactId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      await fetchMessages(selectedLead.id)
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setIsSending(false)
    }
  }

  const handleSelectLead = (lead: any) => {
    setSelectedLead(lead)
    if (lead) {
      fetchMessages(lead.id)
    }
  }

  return (
    <div className="h-full bg-white rounded-lg shadow overflow-hidden">
      <div className="flex h-full relative">
        {/* Leads List */}
        <div className={`${selectedLead ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 border-r border-gray-200 flex-col h-full leads-list`}>
          <div className="p-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
            <p className="text-sm text-gray-600 mt-1">Starred conversations from Go High Level</p>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : error ? (
              <div className="p-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                    <div>
                      <p className="text-sm text-red-800">{error}</p>
                      <p className="text-xs text-red-600 mt-1">Make sure GHL API credentials are configured</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : leads.length === 0 ? (
              <div className="p-4 space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <Star className="h-5 w-5 text-blue-400 mr-2 mt-0.5" />
                    <div>
                      <p className="text-sm text-blue-800 font-medium">GHL API Status</p>
                      {debugInfo?.message && (
                        <p className="text-xs text-blue-700 mt-1">{debugInfo.message}</p>
                      )}
                      {contacts.length > 0 && (
                        <p className="text-xs text-blue-600 mt-2">
                          Found {contacts.length} contacts. To see conversations, we need conversation IDs.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
                {contacts.length > 0 && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-800 mb-2">Available Contacts:</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {contacts.slice(0, 10).map((contact: any) => (
                        <div key={contact.id} className="text-xs text-gray-600 flex justify-between">
                          <span>{contact.name || contact.email || 'Unknown'}</span>
                          <span>{contact.phone || contact.email}</span>
                        </div>
                      ))}
                      {contacts.length > 10 && (
                        <div className="text-xs text-gray-500">...and {contacts.length - 10} more</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              leads.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => handleSelectLead(lead)}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                    selectedLead?.id === lead.id ? 'bg-orange-50 border-l-4 border-l-[#FE8F00]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h3 className="font-semibold text-gray-900">{lead.contactName || 'Unknown'}</h3>
                        {lead.starred && <Star className="ml-2 h-4 w-4 text-yellow-400 fill-current" />}
                        {lead.unreadCount > 0 && (
                          <span className="ml-2 px-2 py-1 text-xs bg-[#04325E] text-white rounded-full">
                            {lead.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1 truncate">{lead.lastMessageBody || 'No messages'}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {lead.lastMessageDate ? new Date(lead.lastMessageDate).toLocaleString() : 'No date'}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`${selectedLead ? 'flex' : 'hidden md:flex'} flex-1 chat-area`} style={{ position: 'relative', height: '100%' }}>
          {selectedLead ? (
            <MainContainer>
              <ChatContainer>
                <ConversationHeader>
                  <ConversationHeader.Back onClick={() => setSelectedLead(null)} />
                  <Avatar 
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(selectedLead.contactName || 'Unknown')}&background=FE8F00&color=fff`}
                    name={selectedLead.contactName || 'Unknown'} 
                  />
                  <ConversationHeader.Content 
                    userName={selectedLead.contactName || 'Unknown'}
                    info={selectedLead.contactPhone || selectedLead.contactEmail || 'No contact info'}
                  />
                  <ConversationHeader.Actions>
                    <InfoButton />
                    <button 
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      onClick={() => console.log('Star clicked')}
                    >
                      <Star className={`h-5 w-5 ${selectedLead.starred ? 'text-[#FE8F00] fill-current' : 'text-gray-400'}`} />
                    </button>
                  </ConversationHeader.Actions>
                </ConversationHeader>
                
                <MessageList 
                  typingIndicator={isSending ? <TypingIndicator content="Sending..." /> : null}
                >
                  {isLoadingMessages ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    (() => {
                      const smsMessages = Array.isArray(messages) ? 
                        messages.filter((message: any) => message.messageType === 'TYPE_SMS').slice().reverse() : []
                      
                      const groupedMessages: { [key: string]: any[] } = {}
                      smsMessages.forEach((message: any) => {
                        const messageDate = new Date(message.dateAdded)
                        const dateKey = messageDate.toDateString()
                        if (!groupedMessages[dateKey]) {
                          groupedMessages[dateKey] = []
                        }
                        groupedMessages[dateKey].push(message)
                      })

                      const elements: JSX.Element[] = []
                      
                      Object.entries(groupedMessages).forEach(([dateKey, dayMessages]) => {
                        // Add date separator
                        const date = new Date(dateKey)
                        const today = new Date()
                        const yesterday = new Date(today)
                        yesterday.setDate(yesterday.getDate() - 1)
                        
                        let dateLabel = ''
                        if (date.toDateString() === today.toDateString()) {
                          dateLabel = 'Today'
                        } else if (date.toDateString() === yesterday.toDateString()) {
                          dateLabel = 'Yesterday'
                        } else {
                          dateLabel = date.toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })
                        }
                        
                        elements.push(
                          <MessageSeparator key={`sep-${dateKey}`} content={dateLabel} />
                        )
                        
                        // Add messages for this date
                        dayMessages.forEach((message: any) => {
                          elements.push(
                            <Message
                              key={message.id}
                              model={{
                                message: message.body,
                                sentTime: new Date(message.dateAdded).toLocaleTimeString([], { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                }),
                                sender: message.direction === 'outbound' ? "You" : selectedLead.contactName || "Unknown",
                                direction: message.direction === 'outbound' ? "outgoing" : "incoming",
                                position: "single"
                              }}
                            />
                          )
                        })
                      })
                      
                      return elements
                    })()
                  )}
                </MessageList>
                
                <MessageInput 
                  placeholder="Type a message..." 
                  onSend={sendMessage}
                  disabled={isSending}
                  sendDisabled={isSending}
                />
              </ChatContainer>
            </MainContainer>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 h-full">
              <div className="text-center">
                <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p>Select a lead to view conversation</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}