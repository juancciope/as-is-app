'use client'

import { useState, useEffect, useRef } from 'react'
import { Star, Phone, Mail, Loader2, AlertCircle, MessageCircle, ArrowLeft, MapPin, Home, Calendar, DollarSign, User, FileText, TrendingUp, ChevronDown, ChevronUp, Trash2, Plus, X, Check } from 'lucide-react'
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
  const [propertyAnalysis, setPropertyAnalysis] = useState<any>(null)
  const [previousReports, setPreviousReports] = useState<any[]>([])
  const [isLoadingReports, setIsLoadingReports] = useState(false)
  const [isInvestmentAnalysisExpanded, setIsInvestmentAnalysisExpanded] = useState(true)
  const [isPreviousReportsExpanded, setIsPreviousReportsExpanded] = useState(false)
  const [contactProperties, setContactProperties] = useState<any[]>([])
  const [selectedPropertyIndex, setSelectedPropertyIndex] = useState(0)
  const [isAddingProperty, setIsAddingProperty] = useState(false)
  const [newPropertyAddress, setNewPropertyAddress] = useState('')
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(400) // Default 400px width
  const [isResizing, setIsResizing] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)

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

  // Resize functionality
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      
      const newWidth = window.innerWidth - e.clientX
      const minWidth = 300
      const maxWidth = Math.min(800, window.innerWidth * 0.6)
      
      setSidebarWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.body.style.cursor = 'default'
      document.body.style.userSelect = 'auto'
    }

    if (isResizing) {
      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }

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
      
      // Initialize properties array with primary address
      const primaryProperty = {
        id: 'primary',
        address: data.contact?.address1 || '',
        city: data.contact?.city || '',
        state: data.contact?.state || '',
        zipCode: data.contact?.postalCode || '',
        isPrimary: true
      }
      setContactProperties([primaryProperty])
      setSelectedPropertyIndex(0)
      
      // Fetch previous property analysis reports for this address
      if (data.contact?.address1) {
        fetchPreviousReports(data.contact.address1)
      }
      
    } catch (error) {
      console.error('Error fetching contact details:', error)
      setContactDetails(null)
    } finally {
      setIsLoadingProfile(false)
    }
  }

  const fetchPreviousReports = async (address: string) => {
    try {
      setIsLoadingReports(true)
      const response = await fetch(`/api/property/reports?address=${encodeURIComponent(address)}&limit=5`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch previous reports')
      }

      const data = await response.json()
      setPreviousReports(data.reports || [])
      
      // If we have a recent report (within last 7 days), use it as current analysis
      const recentReport = data.reports?.find((report: any) => {
        const reportDate = new Date(report.created_at)
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        return reportDate > sevenDaysAgo
      })
      
      if (recentReport && !propertyAnalysis) {
        setPropertyAnalysis({
          success: true,
          data: recentReport.analysis_data,
          address: recentReport.property_address,
          timestamp: recentReport.created_at,
          method: recentReport.method,
          web_searches_performed: recentReport.web_searches_performed,
          sources_found: recentReport.sources_found,
          report_id: recentReport.id,
          from_database: true
        })
      }
      
    } catch (error) {
      console.error('Error fetching previous reports:', error)
      setPreviousReports([])
    } finally {
      setIsLoadingReports(false)
    }
  }

  // Removed dummy Zillow API call - now using AI assistant only

  const handleSelectLead = (lead: any) => {
    setSelectedLead(lead)
    if (lead) {
      fetchMessages(lead.id)
      // Fetch contact details for the profile sidebar
      if (lead.contactId) {
        fetchContactDetails(lead.contactId)
      }
    }
    // Reset analysis when switching leads
    setPropertyAnalysis(null)
    setPreviousReports([])
    setContactProperties([])
    setSelectedPropertyIndex(0)
    setIsAddingProperty(false)
  }

  const handleBackToLeads = () => {
    setSelectedLead(null)
    setContactDetails(null)
    setPropertyDetails(null)
    setPropertyAnalysis(null)
    setPreviousReports([])
    setContactProperties([])
    setSelectedPropertyIndex(0)
    setIsAddingProperty(false)
  }

  const deletePropertyReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this property analysis report?')) {
      return
    }

    try {
      const response = await fetch(`/api/property/reports/${reportId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete report')
      }

      // Remove from local state
      setPreviousReports(prev => prev.filter(report => report.id !== reportId))
      
      // If the deleted report is currently displayed, clear it
      if (propertyAnalysis?.report_id === reportId) {
        setPropertyAnalysis(null)
      }

      console.log('✅ Report deleted successfully')
    } catch (error) {
      console.error('Error deleting report:', error)
      alert('Failed to delete report. Please try again.')
    }
  }

  // Helper function to parse full address into components
  const parseAddress = (fullAddress: string) => {
    // Simple address parsing - can be enhanced with a proper address parsing library
    const parts = fullAddress.split(',').map(part => part.trim())
    
    if (parts.length >= 3) {
      // Format: "123 Main St, Nashville, TN 37203"
      const address = parts[0]
      const city = parts[1]
      const stateZip = parts[2].split(' ')
      const state = stateZip[0]
      const zipCode = stateZip.slice(1).join(' ')
      
      return { address, city, state, zipCode }
    } else if (parts.length === 2) {
      // Format: "123 Main St, Nashville TN"
      const address = parts[0]
      const cityStateZip = parts[1].split(' ')
      const city = cityStateZip.slice(0, -1).join(' ')
      const state = cityStateZip[cityStateZip.length - 1]
      
      return { address, city, state, zipCode: '' }
    } else {
      // Single part or complex format - treat as full address
      return { address: fullAddress, city: '', state: '', zipCode: '' }
    }
  }

  const addNewProperty = () => {
    const parsedAddress = parseAddress(newPropertyAddress)
    
    const newProperty = {
      id: `property-${Date.now()}`,
      address: parsedAddress.address,
      city: parsedAddress.city,
      state: parsedAddress.state,
      zipCode: parsedAddress.zipCode,
      isPrimary: false
    }
    
    setContactProperties(prev => [...prev, newProperty])
    setSelectedPropertyIndex(contactProperties.length) // Select the new property
    setIsAddingProperty(false)
    setNewPropertyAddress('')
    
    // Fetch reports for the new property using the original full address
    fetchPreviousReports(newPropertyAddress)
  }

  const switchToProperty = (index: number) => {
    setSelectedPropertyIndex(index)
    setPropertyAnalysis(null) // Clear current analysis
    setPreviousReports([]) // Clear previous reports
    
    // Fetch reports for the selected property
    const property = contactProperties[index]
    if (property) {
      const fullAddress = `${property.address}, ${property.city}, ${property.state}${property.zipCode ? ` ${property.zipCode}` : ''}`
      fetchPreviousReports(fullAddress)
    }
  }

  const removeProperty = (index: number) => {
    if (contactProperties[index]?.isPrimary) {
      alert('Cannot remove the primary property')
      return
    }
    
    if (!confirm('Are you sure you want to remove this property?')) {
      return
    }
    
    setContactProperties(prev => prev.filter((_, i) => i !== index))
    
    // Adjust selected index if needed
    if (selectedPropertyIndex >= index) {
      const newIndex = Math.max(0, selectedPropertyIndex - 1)
      setSelectedPropertyIndex(newIndex)
      if (contactProperties.length > 1) {
        switchToProperty(newIndex)
      }
    }
  }

  const generatePropertyReport = async () => {
    const selectedProperty = contactProperties[selectedPropertyIndex]
    if (!selectedProperty?.address || !selectedProperty?.city || !selectedProperty?.state) {
      alert('Property address information is required to generate a report')
      return
    }

    try {
      setIsGeneratingReport(true)
      const response = await fetch('/api/property/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          address: selectedProperty.address,
          city: selectedProperty.city,
          state: selectedProperty.state,
          zipCode: selectedProperty.zipCode
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate property report')
      }

      const data = await response.json()
      setPropertyAnalysis(data)
    } catch (error) {
      console.error('Error generating property report:', error)
      alert('Failed to generate property report. Please try again.')
    } finally {
      setIsGeneratingReport(false)
    }
  }

  // Helper function to format comparable sales data
  const formatComparableSales = (comparableSales: any) => {
    if (typeof comparableSales === 'string') {
      // Try to parse JSON if it's a string
      try {
        const parsed = JSON.parse(comparableSales)
        if (Array.isArray(parsed)) {
          return parsed.map((comp: any, index: number) => (
            <div key={index} className="p-2 bg-gray-50 rounded text-xs">
              <div className="font-medium">{comp.address}</div>
              <div className="text-gray-600 mt-1">
                <span className="font-medium">${comp.sale_price?.toLocaleString()}</span>
                {comp.square_footage && (
                  <span className="ml-2">• {comp.square_footage?.toLocaleString()} sf</span>
                )}
                {comp.price_per_sqft && (
                  <span className="ml-2">• ${comp.price_per_sqft}/sf</span>
                )}
              </div>
            </div>
          ))
        }
      } catch (e) {
        // If parsing fails, display as text
        return <div className="text-sm">{comparableSales}</div>
      }
    } else if (Array.isArray(comparableSales)) {
      // If it's already an array
      return comparableSales.map((comp: any, index: number) => (
        <div key={index} className="p-2 bg-gray-50 rounded text-xs">
          <div className="font-medium">{comp.address}</div>
          <div className="text-gray-600 mt-1">
            <span className="font-medium">${comp.sale_price?.toLocaleString()}</span>
            {comp.square_footage && (
              <span className="ml-2">• {comp.square_footage?.toLocaleString()} sf</span>
            )}
            {comp.price_per_sqft && (
              <span className="ml-2">• ${comp.price_per_sqft}/sf</span>
            )}
          </div>
        </div>
      ))
    }
    
    // Fallback to string display
    return <div className="text-sm">{String(comparableSales)}</div>
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
        <div className="flex-1 flex flex-col min-w-0">
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

        {/* Column 4: Lead Profile Sidebar - Resizable Width, Independent Scroll */}
        <div 
          className="border-l border-gray-200 bg-gray-50 flex flex-col relative"
          style={{ width: `${sidebarWidth}px` }}
        >
          {/* Resize handle */}
          <div
            ref={resizeRef}
            className="absolute left-0 top-0 w-1 h-full cursor-ew-resize hover:bg-[#04325E] bg-gray-400 opacity-50 hover:opacity-100 transition-all z-10 group"
            onMouseDown={handleResizeStart}
            style={{ marginLeft: '-2px' }}
            title="Drag to resize sidebar"
          >
            {/* Visual grip lines */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex flex-col space-y-1">
                <div className="w-0.5 h-4 bg-white rounded"></div>
                <div className="w-0.5 h-4 bg-white rounded"></div>
                <div className="w-0.5 h-4 bg-white rounded"></div>
              </div>
            </div>
          </div>
          {selectedLead ? (
            <>
              {/* Profile Header */}
              <div className="flex-shrink-0 p-3 border-b border-gray-200 bg-white">
                <div className="text-center">
                  <Avatar 
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(selectedLead.contactName || 'Unknown')}&background=04325E&color=fff`}
                    name={selectedLead.contactName || 'Unknown'} 
                    size="sm"
                  />
                  <h2 className="text-sm font-semibold text-[#04325E] mt-2 truncate">{selectedLead.contactName || 'Unknown'}</h2>
                  <p className="text-xs text-gray-600">Profile</p>
                  {isResizing && (
                    <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                      {sidebarWidth}px
                    </div>
                  )}
                </div>
              </div>

              {/* Profile Content */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {isLoadingProfile ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <>
                    {/* Contact Information */}
                    <div className="bg-white rounded border border-gray-200 p-3">
                      <h3 className="text-sm font-semibold text-[#04325E] mb-2 flex items-center">
                        <User className="h-4 w-4 mr-2" />
                        Contact
                      </h3>
                      
                      <div className="space-y-2 text-sm">
                        {contactDetails?.email && (
                          <div className="flex items-center">
                            <Mail className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                            <a href={`mailto:${contactDetails.email}`} className="text-blue-600 hover:text-blue-800 truncate">
                              {contactDetails.email}
                            </a>
                          </div>
                        )}
                        
                        {contactDetails?.phone && (
                          <div className="flex items-center">
                            <Phone className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                            <a href={`tel:${contactDetails.phone}`} className="text-blue-600 hover:text-blue-800">
                              {contactDetails.phone}
                            </a>
                          </div>
                        )}
                        
                        {(contactDetails?.address1 || contactDetails?.city || contactDetails?.state) && (
                          <div className="flex items-start">
                            <MapPin className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0 mt-0.5" />
                            <div className="text-gray-700">
                              {contactDetails?.address1 && (
                                <div className="truncate">{contactDetails.address1}</div>
                              )}
                              <div className="truncate">
                                {contactDetails?.city && contactDetails.city}
                                {contactDetails?.city && contactDetails?.state && ', '}
                                {contactDetails?.state && contactDetails.state}
                                {contactDetails?.postalCode && ` ${contactDetails.postalCode}`}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Properties Management */}
                    {contactProperties.length > 0 && (
                      <div className="bg-white rounded border border-gray-200 p-3">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-[#04325E] flex items-center">
                            <Home className="h-4 w-4 mr-2" />
                            Properties ({contactProperties.length})
                          </h3>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => setIsAddingProperty(true)}
                              className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 flex items-center"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Property
                            </button>
                            <button
                              onClick={generatePropertyReport}
                              disabled={isGeneratingReport}
                              className="px-2 py-1 bg-[#04325E] text-white text-xs rounded hover:bg-[#032847] disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                            >
                              {isGeneratingReport ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Analyzing...
                                </>
                              ) : (
                                <>
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                  Generate Report
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Add Property Form */}
                        {isAddingProperty && (
                          <div className="mb-3 p-3 bg-gray-50 rounded border">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-medium text-gray-700">Add New Property</h4>
                              <button
                                onClick={() => {
                                  setIsAddingProperty(false)
                                  setNewPropertyAddress('')
                                }}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="space-y-2">
                              <input
                                type="text"
                                placeholder="Full Address (e.g., 123 Main St, Nashville, TN 37203)"
                                value={newPropertyAddress}
                                onChange={(e) => setNewPropertyAddress(e.target.value)}
                                className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-[#04325E]"
                              />
                              <div className="text-xs text-gray-500">
                                Enter the complete address including city, state, and ZIP code
                              </div>
                              <div className="flex justify-end space-x-2">
                                <button
                                  onClick={() => {
                                    setIsAddingProperty(false)
                                    setNewPropertyAddress('')
                                  }}
                                  className="px-2 py-1 text-xs text-gray-600 border rounded hover:bg-gray-100"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={addNewProperty}
                                  disabled={!newPropertyAddress.trim()}
                                  className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  Add Property
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Property Selector Tabs */}
                        <div className="flex space-x-1 mb-3 overflow-x-auto">
                          {contactProperties.map((property, index) => (
                            <button
                              key={property.id}
                              onClick={() => switchToProperty(index)}
                              className={`flex-shrink-0 px-2 py-1 text-xs rounded flex items-center ${
                                selectedPropertyIndex === index
                                  ? 'bg-[#04325E] text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              <Home className="h-3 w-3 mr-1" />
                              {property.isPrimary ? 'Primary' : `Property ${index}`}
                              {!property.isPrimary && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    removeProperty(index)
                                  }}
                                  className="ml-1 text-red-400 hover:text-red-600"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </button>
                          ))}
                        </div>
                        
                        {/* Selected Property Address Display */}
                        {contactProperties[selectedPropertyIndex] && (
                          <div className="text-sm text-gray-700 mb-3 p-2 bg-blue-50 rounded">
                            <div className="font-medium">{contactProperties[selectedPropertyIndex].address}</div>
                            <div>
                              {contactProperties[selectedPropertyIndex].city}, {contactProperties[selectedPropertyIndex].state} {contactProperties[selectedPropertyIndex].zipCode}
                            </div>
                          </div>
                        )}

                        {/* Investment Summary - Always Visible */}
                        {propertyAnalysis?.data?.investment_analysis && (
                          <div className="space-y-3">
                            <div className="text-center p-2 bg-blue-50 rounded border border-blue-200">
                              <div className="text-xs text-blue-600 font-medium">Investment Grade</div>
                              <div className="text-lg font-bold text-blue-700">
                                {propertyAnalysis.data.investment_analysis.investment_grade || 'N/A'}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-gray-500">ARV</span>
                                <div className="font-medium">${propertyAnalysis.data.investment_analysis.estimated_arv?.toLocaleString() || 'N/A'}</div>
                              </div>
                              <div>
                                <span className="text-gray-500">ROI</span>
                                <div className="font-medium">{propertyAnalysis.data.investment_analysis.roi_percentage || 'N/A'}%</div>
                              </div>
                              <div>
                                <span className="text-gray-500">Reno Est.</span>
                                <div className="font-medium">${propertyAnalysis.data.investment_analysis.renovation_estimate?.toLocaleString() || 'N/A'}</div>
                              </div>
                              <div>
                                <span className="text-gray-500">Profit</span>
                                <div className="font-medium">${propertyAnalysis.data.investment_analysis.projected_profit?.toLocaleString() || 'N/A'}</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Error Display for Parsing Issues */}
                        {propertyAnalysis?.data?.parsing_error && (
                          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-yellow-600">⚠️</span>
                              <span className="font-medium text-yellow-800">Analysis Needs Review</span>
                            </div>
                            <div className="text-sm text-yellow-700 mb-2">
                              {propertyAnalysis.data.error_message || 'The AI response could not be automatically parsed. Please review the raw response below.'}
                            </div>
                            {propertyAnalysis.data.raw_response && (
                              <details className="text-xs">
                                <summary className="cursor-pointer text-yellow-600 hover:text-yellow-800">View Raw Response</summary>
                                <div className="mt-2 p-2 bg-white rounded border max-h-32 overflow-y-auto">
                                  <pre className="whitespace-pre-wrap">{propertyAnalysis.data.raw_response}</pre>
                                </div>
                              </details>
                            )}
                          </div>
                        )}
                        
                        {/* Property Details - Always Visible */}
                        {propertyAnalysis?.data?.property_details && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-gray-500">Property Details</span>
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                🤖 AI Property Analysis
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {propertyAnalysis.data.property_details.square_footage && (
                                <div>
                                  <span className="text-gray-500">Area</span>
                                  <div className="font-medium">{propertyAnalysis.data.property_details.square_footage.toLocaleString()} sf</div>
                                </div>
                              )}
                              
                              {propertyAnalysis.data.property_details.bedrooms && (
                                <div>
                                  <span className="text-gray-500">Beds</span>
                                  <div className="font-medium">{propertyAnalysis.data.property_details.bedrooms}</div>
                                </div>
                              )}
                              
                              {propertyAnalysis.data.property_details.bathrooms && (
                                <div>
                                  <span className="text-gray-500">Baths</span>
                                  <div className="font-medium">{propertyAnalysis.data.property_details.bathrooms}</div>
                                </div>
                              )}
                              
                              {propertyAnalysis.data.property_details.year_built && (
                                <div>
                                  <span className="text-gray-500">Built</span>
                                  <div className="font-medium">{propertyAnalysis.data.property_details.year_built}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Investment Analysis Report - Expandable */}
                    {propertyAnalysis && (
                      <div className="bg-white rounded border border-gray-200 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold text-[#04325E] flex items-center">
                            <FileText className="h-4 w-4 mr-2" />
                            Investment Analysis
                          </h3>
                          <button
                            onClick={() => setIsInvestmentAnalysisExpanded(!isInvestmentAnalysisExpanded)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            {isInvestmentAnalysisExpanded ? 
                              <ChevronUp className="h-4 w-4 text-gray-500" /> : 
                              <ChevronDown className="h-4 w-4 text-gray-500" />
                            }
                          </button>
                        </div>
                        
                        <div className="text-xs text-gray-500 mb-2">
                          Generated: {new Date(propertyAnalysis.timestamp).toLocaleString()}
                          {propertyAnalysis.method && (
                            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                              🤖 {propertyAnalysis.method === 'web_search' ? 'Web Search' : 'AI Assistant'}
                            </span>
                          )}
                          {propertyAnalysis.from_database && (
                            <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded">
                              💾 Cached
                            </span>
                          )}
                        </div>
                        
                        {isInvestmentAnalysisExpanded && (
                          <div className="text-sm text-gray-700 max-h-96 overflow-y-auto">
                          <div className="space-y-4">
                            {/* Investment Recommendation */}
                            {propertyAnalysis.data?.investment_recommendation && (
                              <div className="p-3 bg-gray-50 rounded">
                                <h4 className="font-semibold text-[#04325E] mb-2">📋 Investment Recommendation</h4>
                                <div className={`text-lg font-bold mb-1 ${
                                  propertyAnalysis.data.investment_recommendation.decision === 'PROCEED' ? 'text-green-600' :
                                  propertyAnalysis.data.investment_recommendation.decision === 'PROCEED_WITH_CAUTION' ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {propertyAnalysis.data.investment_recommendation.decision?.replace(/_/g, ' ')}
                                </div>
                                <div className="text-sm text-gray-600 mb-2">
                                  Confidence: {propertyAnalysis.data.investment_recommendation.confidence_level}
                                </div>
                                {propertyAnalysis.data.investment_recommendation.key_reasons && (
                                  <div className="text-sm">
                                    <strong>✅ Reasons:</strong>
                                    <ul className="list-disc list-inside mt-1 ml-2">
                                      {propertyAnalysis.data.investment_recommendation.key_reasons.map((reason: string, i: number) => (
                                        <li key={i}>{reason}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {propertyAnalysis.data.investment_recommendation.concerns && (
                                  <div className="text-sm mt-2">
                                    <strong>⚠️ Concerns:</strong>
                                    <ul className="list-disc list-inside mt-1 ml-2">
                                      {propertyAnalysis.data.investment_recommendation.concerns.map((concern: string, i: number) => (
                                        <li key={i}>{concern}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Financial Projections */}
                            {propertyAnalysis.data?.financial_projections && (
                              <div className="p-3 bg-blue-50 rounded">
                                <h4 className="font-semibold text-[#04325E] mb-2">💰 Financial Analysis</h4>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div className="bg-white p-2 rounded">
                                    <span className="text-gray-500">Purchase Price</span>
                                    <div className="font-bold text-lg">${propertyAnalysis.data.financial_projections.purchase_price?.toLocaleString()}</div>
                                  </div>
                                  <div className="bg-white p-2 rounded">
                                    <span className="text-gray-500">Renovation</span>
                                    <div className="font-bold text-lg">${propertyAnalysis.data.financial_projections.renovation_costs?.toLocaleString()}</div>
                                  </div>
                                  <div className="bg-white p-2 rounded">
                                    <span className="text-gray-500">Total Investment</span>
                                    <div className="font-bold text-lg">${propertyAnalysis.data.financial_projections.total_investment?.toLocaleString()}</div>
                                  </div>
                                  <div className="bg-white p-2 rounded">
                                    <span className="text-gray-500">Expected Sale</span>
                                    <div className="font-bold text-lg">${propertyAnalysis.data.financial_projections.estimated_sale_price?.toLocaleString()}</div>
                                  </div>
                                  <div className="bg-green-100 p-2 rounded col-span-2">
                                    <span className="text-gray-500">Projected Profit</span>
                                    <div className="font-bold text-xl text-green-700">${propertyAnalysis.data.financial_projections.gross_profit?.toLocaleString()}</div>
                                    <div className="text-sm text-green-600">ROI: {propertyAnalysis.data.financial_projections.roi_percentage}%</div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Market Analysis */}
                            {propertyAnalysis.data?.market_analysis && (
                              <div className="p-3 bg-orange-50 rounded">
                                <h4 className="font-semibold text-[#04325E] mb-2">🏘️ Market Analysis</h4>
                                <div className="space-y-2 text-sm">
                                  <div><span className="font-medium">Market Trend:</span> {propertyAnalysis.data.market_analysis.market_trend || 'N/A'}</div>
                                  {propertyAnalysis.data.market_analysis.days_on_market_average && (
                                    <div><span className="font-medium">Avg Days on Market:</span> {propertyAnalysis.data.market_analysis.days_on_market_average} days</div>
                                  )}
                                  <div>
                                    <span className="font-medium">Comparable Sales:</span>
                                    <div className="mt-2 space-y-2">
                                      {formatComparableSales(propertyAnalysis.data.market_analysis.comparable_sales)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Action Items */}
                            {propertyAnalysis.data?.action_items && (
                              <div className="p-3 bg-purple-50 rounded">
                                <h4 className="font-semibold text-[#04325E] mb-2">✅ Next Steps</h4>
                                <ul className="space-y-2 text-sm">
                                  {propertyAnalysis.data.action_items.map((item: string, i: number) => (
                                    <li key={i} className="flex items-start">
                                      <span className="text-purple-600 mr-2">•</span>
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Parsing Error or Manual Review Required */}
                            {propertyAnalysis.data?.parsing_error && (
                              <div className="p-3 bg-red-50 rounded border border-red-200">
                                <div className="flex items-center mb-2">
                                  <span className="text-red-600">❌</span>
                                  <h4 className="font-semibold text-red-800 ml-2">Analysis Parsing Error</h4>
                                </div>
                                <div className="text-sm text-red-700 mb-2">
                                  The AI Assistant found property data but couldn't structure it properly. 
                                  Web searches were performed ({propertyAnalysis.web_searches_performed} searches) 
                                  but the response needs manual review.
                                </div>
                                {propertyAnalysis.data?.raw_analysis_text && (
                                  <details className="mt-2">
                                    <summary className="text-xs text-red-600 cursor-pointer hover:text-red-800">
                                      View raw analysis text
                                    </summary>
                                    <div className="mt-2 p-2 bg-red-100 rounded text-xs whitespace-pre-wrap max-h-40 overflow-y-auto">
                                      {propertyAnalysis.data.raw_analysis_text}
                                    </div>
                                  </details>
                                )}
                                <button
                                  onClick={generatePropertyReport}
                                  className="mt-2 px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                                >
                                  Try Generate Again
                                </button>
                              </div>
                            )}

                            {/* Fallback - if no structured data and no parsing error, show formatted message */}
                            {!propertyAnalysis.data?.investment_analysis && !propertyAnalysis.data?.financial_projections && !propertyAnalysis.data?.parsing_error && (
                              <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
                                <div className="flex items-center mb-2">
                                  <span className="text-yellow-600">⚠️</span>
                                  <h4 className="font-semibold text-yellow-800 ml-2">Incomplete Analysis</h4>
                                </div>
                                <div className="text-sm text-yellow-700">
                                  The AI Assistant provided analysis but some sections are missing. 
                                  Please check the property details above for available metrics, or try generating the report again.
                                </div>
                                {(propertyAnalysis.data?.analysis_text || propertyAnalysis.data?.raw_analysis_text) && (
                                  <details className="mt-2">
                                    <summary className="text-xs text-yellow-600 cursor-pointer hover:text-yellow-800">
                                      View raw response (for debugging)
                                    </summary>
                                    <div className="mt-2 p-2 bg-yellow-100 rounded text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                                      {propertyAnalysis.data?.raw_analysis_text || propertyAnalysis.data?.analysis_text || 'No raw text available'}
                                    </div>
                                  </details>
                                )}
                                <button
                                  onClick={generatePropertyReport}
                                  className="mt-2 px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700"
                                >
                                  Try Generate Again
                                </button>
                              </div>
                            )}
                          </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Previous Reports - Expandable */}
                    {previousReports.length > 0 && (
                      <div className="bg-white rounded border border-gray-200 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold text-[#04325E] flex items-center">
                            <FileText className="h-4 w-4 mr-2" />
                            Previous Reports ({previousReports.length})
                          </h3>
                          <button
                            onClick={() => setIsPreviousReportsExpanded(!isPreviousReportsExpanded)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            {isPreviousReportsExpanded ? 
                              <ChevronUp className="h-4 w-4 text-gray-500" /> : 
                              <ChevronDown className="h-4 w-4 text-gray-500" />
                            }
                          </button>
                        </div>
                        
                        {isPreviousReportsExpanded && (
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {previousReports.map((report: any, index: number) => (
                              <div 
                                key={report.id}
                                className="text-xs p-2 bg-gray-50 rounded group"
                              >
                                <div className="flex items-center justify-between">
                                  <div 
                                    className="flex-1 cursor-pointer hover:bg-gray-100 p-1 rounded"
                                    onClick={() => {
                                      setPropertyAnalysis({
                                        success: true,
                                        data: report.analysis_data,
                                        address: report.property_address,
                                        timestamp: report.created_at,
                                        method: report.method,
                                        web_searches_performed: report.web_searches_performed,
                                        sources_found: report.sources_found,
                                        report_id: report.id,
                                        from_database: true
                                      })
                                    }}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium text-gray-700">
                                        {new Date(report.created_at).toLocaleDateString()}
                                      </span>
                                      <div className="flex items-center space-x-1">
                                        {report.method === 'web_search' && (
                                          <span className="px-1 py-0.5 bg-blue-100 text-blue-600 rounded text-xs">
                                            Web
                                          </span>
                                        )}
                                        {report.web_searches_performed > 0 && (
                                          <span className="text-green-600">
                                            {report.sources_found} sources
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-gray-500 mt-1 truncate">
                                      {report.analysis_data?.investment_recommendation?.decision || 'Analysis available'}
                                    </div>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      deletePropertyReport(report.id)
                                    }}
                                    className="ml-2 p-1 text-red-500 hover:bg-red-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Delete report"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tags */}
                    {contactDetails?.tags && contactDetails.tags.length > 0 && (
                      <div className="bg-white rounded border border-gray-200 p-3">
                        <h3 className="text-sm font-semibold text-[#04325E] mb-2">Tags</h3>
                        <div className="flex flex-wrap gap-2">
                          {contactDetails.tags.map((tag: string, index: number) => (
                            <span 
                              key={index}
                              className="px-2 py-0.5 bg-[#FE8F00] bg-opacity-10 text-[#FE8F00] text-xs rounded-full border border-[#FE8F00] border-opacity-20"
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
            <div className="flex-1 flex items-center justify-center text-gray-500 p-2">
              <div className="text-center">
                <User className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-xs font-medium">Select a lead</p>
                <p className="text-xs text-gray-400 mt-1">View profile</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}