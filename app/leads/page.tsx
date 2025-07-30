'use client'

import { useState, useEffect, useRef } from 'react'
import { Star, MessageCircle, Phone, Mail, Calendar, Loader2, AlertCircle, ChevronDown } from 'lucide-react'

export default function LeadsPage() {
  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [leads, setLeads] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])  
  const [messages, setMessages] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messageText, setMessageText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [userScrolled, setUserScrolled] = useState(false)

  useEffect(() => {
    fetchConversations()
  }, [])

  // Auto-scroll to bottom when messages change (unless user has scrolled up)
  useEffect(() => {
    if (!userScrolled && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, userScrolled])

  // Reset user scroll flag when switching conversations
  useEffect(() => {
    setUserScrolled(false)
  }, [selectedLead])

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
      setUserScrolled(false)
    }
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 10
    setUserScrolled(!isAtBottom)
  }

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

  const sendMessage = async () => {
    if (!selectedLead || !messageText.trim()) return

    try {
      setIsSending(true)
      const response = await fetch(`/api/ghl/messages/${selectedLead.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: messageText,
          type: 'SMS',
          contactId: selectedLead.contactId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      setMessageText('')
      await fetchMessages(selectedLead.id)
      // Scroll to bottom after sending message
      setTimeout(scrollToBottom, 100)
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
    <div className="h-screen bg-white rounded-lg shadow overflow-hidden">
      <div className="flex h-full">
        {/* Leads List */}
        <div className="w-1/3 border-r border-gray-200 flex flex-col h-full">
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
                    selectedLead?.id === lead.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h3 className="font-semibold text-gray-900">{lead.contactName || 'Unknown'}</h3>
                        {lead.starred && <Star className="ml-2 h-4 w-4 text-yellow-400 fill-current" />}
                        {lead.unreadCount > 0 && (
                          <span className="ml-2 px-2 py-1 text-xs bg-blue-500 text-white rounded-full">
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
        <div className="flex-1 flex flex-col h-full">
          {selectedLead ? (
            <>
              {/* Chat Header - Fixed */}
              <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{selectedLead.contactName || 'Unknown'}</h2>
                    <div className="flex items-center mt-1 space-x-4">
                      {selectedLead.contactPhone && (
                        <a href={`tel:${selectedLead.contactPhone}`} className="flex items-center text-sm text-gray-600 hover:text-gray-900">
                          <Phone className="h-3 w-3 mr-1" />
                          {selectedLead.contactPhone}
                        </a>
                      )}
                      {selectedLead.contactEmail && (
                        <a href={`mailto:${selectedLead.contactEmail}`} className="flex items-center text-sm text-gray-600 hover:text-gray-900">
                          <Mail className="h-3 w-3 mr-1" />
                          {selectedLead.contactEmail}
                        </a>
                      )}
                    </div>
                  </div>
                  <button className="p-2 text-gray-400 hover:text-gray-600">
                    <Star className={`h-5 w-5 ${selectedLead.starred ? 'text-yellow-400 fill-current' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Messages Area - Scrollable */}
              <div 
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto bg-gray-50 p-4 relative"
                style={{ minHeight: 0 }} // Important for flex child to shrink
              >
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No messages in this conversation</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 pb-4">
                    {(() => {
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

                      return Object.entries(groupedMessages).map(([dateKey, dayMessages]) => (
                        <div key={dateKey}>
                          {/* Date separator */}
                          <div className="flex justify-center my-4">
                            <div className="bg-white px-3 py-1 rounded-full text-xs text-gray-500 border border-gray-200 shadow-sm">
                              {(() => {
                                const date = new Date(dateKey)
                                const today = new Date()
                                const yesterday = new Date(today)
                                yesterday.setDate(yesterday.getDate() - 1)
                                
                                if (date.toDateString() === today.toDateString()) {
                                  return 'Today'
                                } else if (date.toDateString() === yesterday.toDateString()) {
                                  return 'Yesterday'
                                } else {
                                  return date.toLocaleDateString('en-US', { 
                                    weekday: 'long', 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                  })
                                }
                              })()}
                            </div>
                          </div>
                          
                          {/* Messages for this date */}
                          <div className="space-y-2">
                            {dayMessages.map((message: any) => (
                              <div
                                key={message.id}
                                className={`flex ${
                                  message.direction === 'outbound' ? 'justify-end' : 'justify-start'
                                }`}
                              >
                                <div
                                  className={`max-w-sm px-4 py-2 rounded-2xl shadow-sm ${
                                    message.direction === 'outbound'
                                      ? 'bg-blue-500 text-white rounded-br-sm'
                                      : 'bg-white text-gray-900 rounded-bl-sm border border-gray-200'
                                  }`}
                                >
                                  <p className="text-sm">{message.body}</p>
                                  <p className={`text-xs mt-1 ${
                                    message.direction === 'outbound' ? 'text-blue-100' : 'text-gray-500'
                                  }`}>
                                    {new Date(message.dateAdded).toLocaleTimeString([], { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    })()}
                    {/* Scroll anchor */}
                    <div ref={messagesEndRef} />
                  </div>
                )}
                
                {/* Scroll to bottom button */}
                {userScrolled && (
                  <div className="absolute bottom-20 right-6">
                    <button
                      onClick={scrollToBottom}
                      className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full shadow-lg transition-all duration-200 hover:scale-105"
                      aria-label="Scroll to bottom"
                    >
                      <ChevronDown className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Input Area - Fixed at bottom */}
              <div className="flex-shrink-0 p-4 bg-white border-t border-gray-100">
                <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex items-end space-x-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Type a message..."
                      className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      disabled={isSending}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSending || !messageText.trim()}
                    className="px-6 py-3 bg-blue-500 text-white rounded-2xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-medium"
                  >
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
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