'use client'

import { useState, useEffect, useRef } from 'react'
import { Star, Phone, Mail, Loader2, AlertCircle, MessageCircle, ArrowLeft, MapPin, Home, Calendar, DollarSign, User } from 'lucide-react'
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
  const [isMobile, setIsMobile] = useState(false)
  const [contactDetails, setContactDetails] = useState<any>(null)
  const [propertyDetails, setPropertyDetails] = useState<any>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchConversations()
    
    // Check if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && chatContainerRef.current) {
      const messageList = chatContainerRef.current.querySelector('.cs-message-list__scroll-wrapper')
      if (messageList) {
        setTimeout(() => {
          messageList.scrollTop = messageList.scrollHeight
        }, 100)
      }
    }
  }, [messages])

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
      console.log('Messages API response for conversation', conversationId, ':', data)
      
      let messagesArray = []
      if (Array.isArray(data)) {
        messagesArray = data
      } else if (data.messages && Array.isArray(data.messages)) {
        messagesArray = data.messages
      } else if (data.data && Array.isArray(data.data)) {
        messagesArray = data.data
      } else if (data.results && Array.isArray(data.results)) {
        messagesArray = data.results
      } else {
        console.warn('❌ Messages data is not in expected format:', data)
        messagesArray = []
      }
      
      setMessages(messagesArray)
    } catch (error) {
      console.error('Error fetching messages:', error)
      setMessages([])
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

  const fetchContactDetails = async (contactId: string) => {
    try {
      setIsLoadingProfile(true)
      const response = await fetch(`/api/ghl/contact/${contactId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch contact details')
      }

      const data = await response.json()
      setContactDetails(data.contact)
      
      // If we have address information, fetch Zestimate
      if (data.contact.address1 && data.contact.city && data.contact.state) {
        fetchPropertyDetails(data.contact.address1, data.contact.city, data.contact.state, data.contact.postalCode)
      }
    } catch (error) {
      console.error('Error fetching contact details:', error)
      setContactDetails(null)
    } finally {
      setIsLoadingProfile(false)
    }
  }

  const fetchPropertyDetails = async (address: string, city: string, state: string, zipCode?: string) => {
    try {
      const params = new URLSearchParams({
        address,
        city,
        state,
        ...(zipCode && { zipCode })
      })
      
      const response = await fetch(`/api/zillow/zestimate?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch property details')
      }

      const data = await response.json()
      setPropertyDetails(data.property)
    } catch (error) {
      console.error('Error fetching property details:', error)
      setPropertyDetails(null)
    }
  }

  const handleSelectLead = (lead: any) => {
    setSelectedLead(lead)
    if (lead) {
      fetchMessages(lead.id)
      // Fetch contact details for the profile sidebar
      if (lead.contactId) {
        fetchContactDetails(lead.contactId)
      }
    }
  }

  const handleBackToLeads = () => {
    setSelectedLead(null)
    setContactDetails(null)
    setPropertyDetails(null)
  }

  const renderMessages = () => {
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
  }

  // Mobile: Show only leads list when no lead selected
  if (isMobile && !selectedLead) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col z-50 overflow-hidden">
        {/* Mobile Header */}
        <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white w-full">
          <h1 className="text-xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-600 mt-1">Starred conversations</p>
        </div>
        
        {/* Mobile Leads List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden w-full">
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
                  </div>
                </div>
              </div>
            </div>
          ) : leads.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No starred conversations found</p>
            </div>
          ) : (
            leads.map((lead) => (
              <div
                key={lead.id}
                onClick={() => handleSelectLead(lead)}
                className="p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 active:bg-gray-100 w-full"
              >
                <div className="flex items-start justify-between w-full">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center">
                      <h3 className="font-semibold text-gray-900 truncate">{lead.contactName || 'Unknown'}</h3>
                      {lead.starred && <Star className="ml-2 h-4 w-4 text-[#FE8F00] fill-current flex-shrink-0" />}
                      {lead.unreadCount > 0 && (
                        <span className="ml-2 px-2 py-1 text-xs bg-[#04325E] text-white rounded-full flex-shrink-0">
                          {lead.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1 truncate w-full">{lead.lastMessageBody || 'No messages'}</p>
                    <p className="text-xs text-gray-500 mt-1 truncate w-full">
                      {lead.lastMessageDate ? new Date(lead.lastMessageDate).toLocaleString() : 'No date'}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // Mobile: Show chat when lead selected
  if (isMobile && selectedLead) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col z-50 overflow-hidden">
        {/* Mobile Chat Header */}
        <div className="flex-shrink-0 flex items-center p-4 border-b border-gray-200 bg-white w-full">
          <button 
            onClick={handleBackToLeads}
            className="mr-3 p-2 hover:bg-gray-100 rounded-full active:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="h-6 w-6 text-gray-700" />
          </button>
          <Avatar 
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(selectedLead.contactName || 'Unknown')}&background=FE8F00&color=fff`}
            name={selectedLead.contactName || 'Unknown'} 
            size="sm"
          />
          <div className="ml-3 flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-[#04325E] truncate">{selectedLead.contactName || 'Unknown'}</h2>
            <p className="text-sm text-gray-600 truncate">{selectedLead.contactPhone || selectedLead.contactEmail || 'No contact info'}</p>
          </div>
        </div>

        {/* Mobile Chat Container - Fixed Height */}
        <div className="flex-1 min-h-0 w-full overflow-hidden" ref={chatContainerRef}>
          <MainContainer style={{ height: '100%' }}>
            <ChatContainer style={{ height: '100%' }}>
              <MessageList 
                typingIndicator={isSending ? <TypingIndicator content="Sending..." /> : null}
                style={{ height: '100%' }}
              >
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : (
                  renderMessages()
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
        </div>
      </div>
    )
  }

  // Desktop: 3-column layout
  return (
    <div className="fixed inset-0 bg-white">
      <div className="h-full flex">
        {/* Account for main sidebar - 256px (w-64) */}
        <div className="w-64 flex-shrink-0"></div>
        
        {/* Column 2: Conversations List - Fixed Width, Independent Scroll */}
        <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
          {/* Conversations Header - Fixed */}
          <div className="flex-shrink-0 p-4 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">Leads</h1>
            <p className="text-sm text-gray-600 mt-1">Starred conversations</p>
          </div>
          
          {/* Conversations List - Scrollable */}
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
                    </div>
                  </div>
                </div>
              </div>
            ) : leads.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No starred conversations found</p>
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
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <h3 className="font-semibold text-gray-900 truncate">{lead.contactName || 'Unknown'}</h3>
                        {lead.starred && <Star className="ml-2 h-4 w-4 text-[#FE8F00] fill-current flex-shrink-0" />}
                        {lead.unreadCount > 0 && (
                          <span className="ml-2 px-2 py-1 text-xs bg-[#04325E] text-white rounded-full flex-shrink-0">
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

        {/* Column 3: Chat Window - Flex-1, Fixed Height, Independent Scroll */}
        <div className="flex-1 flex flex-col min-w-0 max-w-2xl">
          {selectedLead ? (
            <>
              {/* Chat Header - Fixed */}
              <div className="flex-shrink-0 flex items-center p-4 border-b border-gray-200 bg-white">
                <Avatar 
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(selectedLead.contactName || 'Unknown')}&background=FE8F00&color=fff`}
                  name={selectedLead.contactName || 'Unknown'} 
                />
                <div className="ml-3 flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-[#04325E] truncate">{selectedLead.contactName || 'Unknown'}</h2>
                  <p className="text-sm text-gray-600 truncate">{selectedLead.contactPhone || selectedLead.contactEmail || 'No contact info'}</p>
                </div>
                <button 
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                  onClick={() => console.log('Star clicked')}
                >
                  <Star className={`h-5 w-5 ${selectedLead.starred ? 'text-[#FE8F00] fill-current' : 'text-gray-400'}`} />
                </button>
              </div>

              {/* Chat Container - Fixed Height, Independent Scroll */}
              <div className="flex-1 min-h-0" ref={chatContainerRef}>
                <MainContainer style={{ height: '100%' }}>
                  <ChatContainer style={{ height: '100%' }}>
                    <MessageList 
                      typingIndicator={isSending ? <TypingIndicator content="Sending..." /> : null}
                      style={{ height: '100%' }}
                    >
                      {isLoadingMessages ? (
                        <div className="flex items-center justify-center p-8">
                          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                      ) : (
                        renderMessages()
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
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm text-gray-400 mt-1">Choose a lead from the list to start messaging</p>
              </div>
            </div>
          )}
        </div>

        {/* Column 4: Lead Profile Sidebar - Fixed Width, Independent Scroll */}
        <div className="w-80 border-l border-gray-200 bg-gray-50 flex flex-col">
          {selectedLead ? (
            <>
              {/* Profile Header */}
              <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white">
                <div className="flex items-center">
                  <Avatar 
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(selectedLead.contactName || 'Unknown')}&background=04325E&color=fff`}
                    name={selectedLead.contactName || 'Unknown'} 
                    size="lg"
                  />
                  <div className="ml-3">
                    <h2 className="text-lg font-semibold text-[#04325E]">{selectedLead.contactName || 'Unknown'}</h2>
                    <p className="text-sm text-gray-600">Lead Profile</p>
                  </div>
                </div>
              </div>

              {/* Profile Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {isLoadingProfile ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <>
                    {/* Contact Information */}
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center mb-3">
                        <User className="h-5 w-5 text-[#04325E] mr-2" />
                        <h3 className="font-semibold text-gray-900">Contact Information</h3>
                      </div>
                      
                      <div className="space-y-3">
                        {contactDetails?.email && (
                          <div className="flex items-center">
                            <Mail className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                            <a href={`mailto:${contactDetails.email}`} className="text-sm text-blue-600 hover:text-blue-800 truncate">
                              {contactDetails.email}
                            </a>
                          </div>
                        )}
                        
                        {contactDetails?.phone && (
                          <div className="flex items-center">
                            <Phone className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                            <a href={`tel:${contactDetails.phone}`} className="text-sm text-blue-600 hover:text-blue-800">
                              {contactDetails.phone}
                            </a>
                          </div>
                        )}
                        
                        {(contactDetails?.address1 || contactDetails?.city || contactDetails?.state) && (
                          <div className="flex items-start">
                            <MapPin className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-gray-700">
                              {contactDetails?.address1 && (
                                <div>{contactDetails.address1}</div>
                              )}
                              <div>
                                {contactDetails?.city && contactDetails.city}
                                {contactDetails?.city && contactDetails?.state && ', '}
                                {contactDetails?.state && contactDetails.state}
                                {contactDetails?.postalCode && ` ${contactDetails.postalCode}`}
                              </div>
                            </div>
                          </div>
                        )}

                        {contactDetails?.dateAdded && (
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                            <span className="text-sm text-gray-700">
                              Added {new Date(contactDetails.dateAdded).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Property Information */}
                    {propertyDetails && (
                      <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="flex items-center mb-3">
                          <Home className="h-5 w-5 text-[#04325E] mr-2" />
                          <h3 className="font-semibold text-gray-900">Property Information</h3>
                        </div>
                        
                        <div className="space-y-3">
                          {propertyDetails.zestimate?.amount && (
                            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                              <div className="flex items-center">
                                <DollarSign className="h-5 w-5 text-green-600 mr-2" />
                                <span className="font-semibold text-green-800">Zestimate</span>
                              </div>
                              <span className="text-lg font-bold text-green-700">
                                ${propertyDetails.zestimate.amount.toLocaleString()}
                              </span>
                            </div>
                          )}
                          
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            {propertyDetails.livingArea && (
                              <div>
                                <span className="text-gray-500">Living Area</span>
                                <div className="font-medium">{propertyDetails.livingArea.toLocaleString()} sq ft</div>
                              </div>
                            )}
                            
                            {propertyDetails.bedrooms && (
                              <div>
                                <span className="text-gray-500">Bedrooms</span>
                                <div className="font-medium">{propertyDetails.bedrooms}</div>
                              </div>
                            )}
                            
                            {propertyDetails.bathrooms && (
                              <div>
                                <span className="text-gray-500">Bathrooms</span>
                                <div className="font-medium">{propertyDetails.bathrooms}</div>
                              </div>
                            )}
                            
                            {propertyDetails.yearBuilt && (
                              <div>
                                <span className="text-gray-500">Year Built</span>
                                <div className="font-medium">{propertyDetails.yearBuilt}</div>
                              </div>
                            )}
                          </div>

                          {propertyDetails.zestimate?.lastUpdated && (
                            <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                              Last updated: {new Date(propertyDetails.zestimate.lastUpdated).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    {contactDetails?.tags && contactDetails.tags.length > 0 && (
                      <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">Tags</h3>
                        <div className="flex flex-wrap gap-2">
                          {contactDetails.tags.map((tag: string, index: number) => (
                            <span 
                              key={index}
                              className="px-2 py-1 bg-[#FE8F00] bg-opacity-10 text-[#FE8F00] text-xs rounded-full border border-[#FE8F00] border-opacity-20"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 p-4">
              <div className="text-center">
                <User className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-sm font-medium">Select a lead</p>
                <p className="text-xs text-gray-400 mt-1">Choose a conversation to view profile details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}