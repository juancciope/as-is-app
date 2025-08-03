'use client'

import { useState, useEffect, useRef } from 'react'
import { Star, Phone, Mail, Loader2, AlertCircle, MessageCircle, ArrowLeft, MapPin, Home, Calendar, DollarSign, User, FileText, TrendingUp, ChevronDown, ChevronUp, Trash2, Plus, X, Check, Zap, BarChart, Building } from 'lucide-react'
import { AddressAutocomplete } from '@/components/ui/google-places-autocomplete'
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
  const [generatingReportForProperty, setGeneratingReportForProperty] = useState<string | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(400) // Default 400px width
  const [isResizing, setIsResizing] = useState(false)
  const [showMobileProperties, setShowMobileProperties] = useState(false)
  const [selectedPlaceData, setSelectedPlaceData] = useState<any>(null)
  const [isLoadingContactData, setIsLoadingContactData] = useState(false)
  const [forceRefreshKey, setForceRefreshKey] = useState(0)
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

  // REMOVED AUTO-SAVE - All saves are now explicit and immediate

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
      console.log('🔄 Loading contact:', contactId)
      
      // Step 1: Get contact details from GHL
      const response = await fetch(`/api/ghl/contact/${contactId}`)
      if (!response.ok) throw new Error('Failed to fetch contact details')
      
      const data = await response.json()
      setContactDetails(data.contact)
      
      // Step 2: Load or create properties for this specific contact
      await loadPropertiesForContact(contactId, data.contact)
      
    } catch (error) {
      console.error('❌ Error loading contact:', error)
      setContactDetails(null)
      setContactProperties([])
    } finally {
      setIsLoadingProfile(false)
    }
  }

  const loadPropertiesForContact = async (contactId: string, contactData: any) => {
    try {
      console.log('📦 Loading properties for contact:', contactId)
      
      // Step 1: Try to load saved properties from database
      const savedProperties = await loadContactProperties(contactId)
      
      if (savedProperties && savedProperties.length > 0) {
        console.log('✅ Loaded saved properties:', savedProperties.length)
        setContactProperties(savedProperties)
        setSelectedPropertyIndex(0)
        return
      }
      
      // Step 2: Create initial property from GHL contact data
      if (contactData?.address1) {
        const newProperty = {
          id: 'primary',
          address: contactData.address1,
          city: contactData.city || '',
          state: contactData.state || '',
          zipCode: contactData.postalCode || '',
          isPrimary: true,
          analysis: null,
          previousReports: []
        }
        
        console.log('🏠 Creating new property:', newProperty.address)
        setContactProperties([newProperty])
        setSelectedPropertyIndex(0)
        
        // Save immediately
        await saveContactProperties(contactId, [newProperty])
      } else {
        console.log('❌ No address data for contact')
        setContactProperties([])
      }
      
    } catch (error) {
      console.error('❌ Error loading properties:', error)
      setContactProperties([])
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

  // Helper function to save contact properties to database
  const saveContactProperties = async (contactId: string, properties: any[]) => {
    if (!contactId) return
    
    try {
      console.log('💾 Saving properties for contact:', contactId, 'Properties:', properties.length)
      if (properties.length > 0) {
        console.log('💾 First property address being saved:', properties[0].address)
      }
      
      const response = await fetch(`/api/contact-properties/${contactId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ properties })
      })

      if (!response.ok) {
        throw new Error('Failed to save contact properties')
      }

      console.log('✅ Contact properties saved to database for contact:', contactId)
    } catch (error) {
      console.error('❌ Error saving contact properties to database:', error)
    }
  }

  // Helper function to load contact properties from database
  const loadContactProperties = async (contactId: string): Promise<any[]> => {
    if (!contactId) return []
    
    try {
      console.log('🔍 Loading properties for contact:', contactId)
      // Add cache-busting timestamp to force fresh data
      const timestamp = new Date().getTime()
      const response = await fetch(`/api/contact-properties/${contactId}?t=${timestamp}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to load contact properties')
      }

      const data = await response.json()
      console.log('📦 Loaded properties data:', data)
      return data.properties || []
    } catch (error) {
      console.error('❌ Error loading contact properties from database:', error)
      return []
    }
  }

  // Removed dummy Zillow API call - now using AI assistant only

  const handleSelectLead = (lead: any) => {
    console.log('🔄 Switching to contact:', lead.contactId)
    
    // Clear all state
    setPropertyAnalysis(null)
    setPreviousReports([])
    setContactProperties([])
    setSelectedPropertyIndex(0)
    setIsAddingProperty(false)
    setContactDetails(null)
    setNewPropertyAddress('')
    setSelectedPlaceData(null)
    setGeneratingReportForProperty(null)
    
    // Set new lead and load data
    setSelectedLead(lead)
    if (lead?.id) {
      fetchMessages(lead.id)
    }
    if (lead?.contactId) {
      fetchContactDetails(lead.contactId)
    }
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

  // SIMPLE: Create new property with complete address - no complex parsing
  const createNewProperty = async () => {
    console.log('🏠 Creating new property with address:', newPropertyAddress)
    
    if (!newPropertyAddress.trim()) {
      alert('Please enter a property address')
      return
    }

    if (!selectedLead?.contactId) {
      alert('No contact selected')
      return
    }

    try {
      // SIMPLE: Use the complete address exactly as entered/selected
      const newProperty = {
        id: `property-${Date.now()}`,
        address: newPropertyAddress.trim(), // Use COMPLETE address as-is
        city: '', // We don't need to parse these for the analysis to work
        state: '',
        zipCode: '',
        isPrimary: false,
        analysis: null,
        previousReports: []
      }

      console.log('✅ New property created:', newProperty)

      // Add to state
      const updatedProperties = [...contactProperties, newProperty]
      setContactProperties(updatedProperties)
      
      // Save to database immediately
      await saveContactProperties(selectedLead.contactId, updatedProperties)
      console.log('💾 Property saved to database')
      
      // Clear form
      setIsAddingProperty(false)
      setNewPropertyAddress('')
      setSelectedPlaceData(null)
      
    } catch (error) {
      console.error('❌ Error creating property:', error)
      alert('Failed to add property. Please try again.')
    }
  }

  const switchToProperty = (index: number) => {
    setSelectedPropertyIndex(index)
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

  const generatePropertyReport = async (propertyId: string) => {
    const property = contactProperties.find(p => p.id === propertyId)
    if (!property?.address || !property?.city || !property?.state) {
      alert('Property address information is required to generate a report')
      return
    }

    try {
      setGeneratingReportForProperty(propertyId)
      const response = await fetch('/api/property/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          address: property.address,
          city: property.city,
          state: property.state,
          zipCode: property.zipCode
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate property report')
      }

      const data = await response.json()
      
      console.log('📊 Generated report for property:', propertyId, data)
      
      // Update the specific property with its analysis
      const updatedProperties = contactProperties.map(p => 
        p.id === propertyId 
          ? { ...p, analysis: data }
          : p
      )
      
      setContactProperties(updatedProperties)
      
      // Save to database
      if (selectedLead?.contactId) {
        await saveContactProperties(selectedLead.contactId, updatedProperties)
      }
      
    } catch (error) {
      console.error('Error generating property report:', error)
      alert('Failed to generate property report. Please try again.')
    } finally {
      setGeneratingReportForProperty(null)
    }
  }


  // REMOVED fetchPreviousReportsForProperty - source of contamination

  // REMOVED old handleAddProperty - replaced with simple createNewProperty

  const handleDeleteProperty = async (propertyId: string) => {
    const property = contactProperties.find(p => p.id === propertyId)
    if (!property) return

    if (property.isPrimary) {
      alert('Cannot delete the primary property')
      return
    }

    if (!confirm('Are you sure you want to delete this property?')) {
      return
    }

    if (!selectedLead?.contactId) {
      alert('No contact selected')
      return
    }

    console.log('🗑️ Deleting property:', propertyId)

    // Update state immediately
    const updatedProperties = contactProperties.filter(p => p.id !== propertyId)
    setContactProperties(updatedProperties)
    
    // IMMEDIATELY save to database
    try {
      await saveContactProperties(selectedLead.contactId, updatedProperties)
      console.log('✅ Property deletion saved to database immediately')
    } catch (saveError) {
      console.error('❌ Failed to save property deletion to database:', saveError)
      alert('Failed to save changes to database. Changes may not persist.')
    }
  }

  // SIMPLE: Unified Add Property Form Component
  const AddPropertyForm = ({ isMobile = false }: { isMobile?: boolean }) => {
    return (
      <div className={`${isMobile ? 'mb-4 p-4 bg-gray-50 rounded-lg border' : 'bg-gray-50 rounded-lg p-4 border border-green-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-700">
            {isMobile ? 'Add Property' : 'Add New Property'}
          </h4>
          <button
            onClick={() => {
              setIsAddingProperty(false)
              setNewPropertyAddress('')
              setSelectedPlaceData(null)
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <div className="space-y-3">
          <AddressAutocomplete
            value={newPropertyAddress}
            onChange={(value) => {
              console.log('📝 Address input changed:', value)
              setNewPropertyAddress(value)
            }}
            onPlaceSelected={(place) => {
              console.log('🎯 Google Places selected:', place)
              if (place?.formatted_address) {
                setNewPropertyAddress(place.formatted_address)
                setSelectedPlaceData(place)
              }
            }}
            placeholder="Enter complete property address..."
            className={isMobile 
              ? "p-3 border border-gray-300 rounded-lg text-sm w-full"
              : "px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent w-full"
            }
          />
          
          <div className="text-xs text-gray-500">
            Enter the complete address including city, state, and ZIP code
          </div>
          
          <div className={`flex gap-2 ${isMobile ? '' : 'justify-end'}`}>
            <button
              onClick={() => {
                setIsAddingProperty(false)
                setNewPropertyAddress('')
                setSelectedPlaceData(null)
              }}
              className={`px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors ${isMobile ? 'flex items-center' : ''}`}
            >
              {isMobile && <X className="h-4 w-4 mr-1" />}
              Cancel
            </button>
            <button
              onClick={createNewProperty}
              disabled={!newPropertyAddress.trim()}
              className={`px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${isMobile ? 'flex items-center' : 'flex items-center'}`}
            >
              <Check className="h-4 w-4 mr-1" />
              Add Property
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Property Analysis Section Component
  const PropertyAnalysisSection = ({ property }: { property: any }) => {
    const [isExpanded, setIsExpanded] = useState(false)
    
    return (
      <div className="ml-4 pl-4 border-l-2 border-blue-200 bg-gradient-to-r from-blue-50 to-transparent">
        {/* Foldable Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between py-2 text-left hover:bg-blue-100 rounded px-2 transition-colors"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Investment Analysis</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {property.analysis.data?.analysis_summary?.investment_grade || 'Analyzed'}
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-blue-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-blue-600" />
          )}
        </button>

        {/* Expandable Content */}
        {isExpanded && (
          <div className="pb-3 space-y-4">
            {/* Investment Overview */}
            {property.analysis.data?.analysis_summary && (
              <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                <div className="px-3 py-2 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-200">
                  <h4 className="text-xs font-semibold text-green-800">Investment Overview</h4>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-blue-600 font-medium uppercase tracking-wide">Grade</div>
                      <div className="text-sm font-bold text-blue-900">
                        {property.analysis.data.analysis_summary?.investment_grade || 'N/A'}
                      </div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-green-600 font-medium uppercase tracking-wide">ROI</div>
                      <div className="text-sm font-bold text-green-900">
                        {property.analysis.data.analysis_summary?.roi_percentage || 'N/A'}%
                      </div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-orange-600 font-medium uppercase tracking-wide">ARV</div>
                      <div className="text-sm font-bold text-orange-900">
                        ${property.analysis.data.analysis_summary?.estimated_arv?.toLocaleString() || 'N/A'}
                      </div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-purple-600 font-medium uppercase tracking-wide">Profit</div>
                      <div className="text-sm font-bold text-purple-900">
                        ${property.analysis.data.analysis_summary?.projected_profit?.toLocaleString() || 'N/A'}
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-blue-600 font-medium uppercase tracking-wide">Max Offer</div>
                      <div className="text-sm font-bold text-blue-900">
                        ${property.analysis.data.analysis_summary?.max_offer?.toLocaleString() || 'N/A'}
                      </div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-red-600 font-medium uppercase tracking-wide">Repair Cost</div>
                      <div className="text-sm font-bold text-red-900">
                        ${property.analysis.data.analysis_summary?.estimated_repair_cost?.toLocaleString() || 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Property Details */}
            {property.analysis.data?.property_details && (
              <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                <div className="px-3 py-2 bg-blue-50 border-b border-blue-200">
                  <h4 className="text-xs font-semibold text-blue-800">Property Details</h4>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {property.analysis.data.property_details.square_footage && (
                      <div className="text-center">
                        <div className="text-gray-500 uppercase tracking-wide">Area</div>
                        <div className="font-semibold text-gray-900">
                          {property.analysis.data.property_details.square_footage.toLocaleString()} sf
                        </div>
                      </div>
                    )}
                    {property.analysis.data.property_details.bedrooms && (
                      <div className="text-center">
                        <div className="text-gray-500 uppercase tracking-wide">Bedrooms</div>
                        <div className="font-semibold text-gray-900">
                          {property.analysis.data.property_details.bedrooms}
                        </div>
                      </div>
                    )}
                    {property.analysis.data.property_details.bathrooms && (
                      <div className="text-center">
                        <div className="text-gray-500 uppercase tracking-wide">Bathrooms</div>
                        <div className="font-semibold text-gray-900">
                          {property.analysis.data.property_details.bathrooms}
                        </div>
                      </div>
                    )}
                    {property.analysis.data.property_details.year_built && (
                      <div className="text-center">
                        <div className="text-gray-500 uppercase tracking-wide">Built</div>
                        <div className="font-semibold text-gray-900">
                          {property.analysis.data.property_details.year_built}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Financial Projections */}
            {property.analysis.data?.financial_projections && (
              <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                <div className="px-3 py-2 bg-blue-50 border-b border-blue-200">
                  <h4 className="text-xs font-semibold text-blue-800">💰 Financial Analysis</h4>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 p-2 rounded">
                      <span className="text-gray-500">Purchase Price</span>
                      <div className="font-bold text-sm">${property.analysis.data.financial_projections.purchase_price?.toLocaleString()}</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <span className="text-gray-500">Renovation</span>
                      <div className="font-bold text-sm">${property.analysis.data.financial_projections.renovation_costs?.toLocaleString()}</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <span className="text-gray-500">Total Investment</span>
                      <div className="font-bold text-sm">${property.analysis.data.financial_projections.total_investment?.toLocaleString()}</div>
                    </div>
                    <div className="bg-green-100 p-2 rounded">
                      <span className="text-gray-500">Expected Sale</span>
                      <div className="font-bold text-sm text-green-700">${property.analysis.data.financial_projections.estimated_sale_price?.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Market Analysis */}
            {property.analysis.data?.market_analysis && (
              <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                <div className="px-3 py-2 bg-orange-50 border-b border-orange-200">
                  <h4 className="text-xs font-semibold text-orange-800">🏘️ Market Analysis</h4>
                </div>
                <div className="p-3 space-y-2 text-xs">
                  <div><span className="font-medium">Market Trend:</span> {property.analysis.data.market_analysis.market_trend || 'N/A'}</div>
                  {property.analysis.data.market_analysis.days_on_market_average && (
                    <div><span className="font-medium">Avg Days on Market:</span> {property.analysis.data.market_analysis.days_on_market_average} days</div>
                  )}
                  <div>
                    <span className="font-medium">Comparable Sales:</span>
                    <div className="mt-1">
                      {formatComparableSales(property.analysis.data.market_analysis.comparable_sales)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Investment Recommendation */}
            {property.analysis.data?.investment_recommendation && (
              <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                  <h4 className="text-xs font-semibold text-gray-800">📋 Investment Recommendation</h4>
                </div>
                <div className="p-3">
                  <div className={`text-sm font-bold mb-1 ${
                    property.analysis.data.investment_recommendation.decision === 'PROCEED' ? 'text-green-600' :
                    property.analysis.data.investment_recommendation.decision === 'PROCEED_WITH_CAUTION' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {property.analysis.data.investment_recommendation.decision?.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xs text-gray-600 mb-2">
                    Confidence: {property.analysis.data.investment_recommendation.confidence_level}
                  </div>
                  {property.analysis.data.investment_recommendation.key_reasons && (
                    <div className="text-xs">
                      <strong>✅ Reasons:</strong>
                      <ul className="list-disc list-inside mt-1 ml-2">
                        {property.analysis.data.investment_recommendation.key_reasons.map((reason: string, i: number) => (
                          <li key={i}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {property.analysis.data.investment_recommendation.concerns && (
                    <div className="text-xs mt-2">
                      <strong>⚠️ Concerns:</strong>
                      <ul className="list-disc list-inside mt-1 ml-2">
                        {property.analysis.data.investment_recommendation.concerns.map((concern: string, i: number) => (
                          <li key={i}>{concern}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Items */}
            {property.analysis.data?.action_items && (
              <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                <div className="px-3 py-2 bg-purple-50 border-b border-purple-200">
                  <h4 className="text-xs font-semibold text-purple-800">✅ Next Steps</h4>
                </div>
                <div className="p-3">
                  <ul className="space-y-1 text-xs">
                    {property.analysis.data.action_items.map((item: string, i: number) => (
                      <li key={i} className="flex items-start">
                        <span className="text-purple-600 mr-2">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Analysis Timestamp */}
            <div className="text-xs text-gray-500 text-center pt-2 border-t border-blue-200">
              <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 rounded-full">
                🤖 AI Analysis Complete
              </span>
              <div className="mt-1">
                Generated: {new Date(property.analysis.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </div>
    )
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
        {/* Mobile Chat Header - Enhanced Design */}
        <div className="flex-shrink-0 bg-white w-full">
          <div className="px-4 py-3 bg-gradient-to-r from-[#04325E] to-[#0a4976] text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                <button 
                  onClick={handleBackToLeads}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors flex-shrink-0"
                >
                  <ArrowLeft className="h-5 w-5 text-white" />
                </button>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold truncate">{selectedLead.contactName || 'Unknown'}</h2>
                  <div className="flex items-start gap-1 mt-1">
                    <MapPin className="h-3 w-3 text-white/80 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-white/90 leading-tight overflow-hidden" style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {contactDetails?.address1 
                        ? `${contactDetails.address1}${contactDetails.city ? `, ${contactDetails.city}` : ''}${contactDetails.state ? `, ${contactDetails.state}` : ''}`
                        : 'No address available'
                      }
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Click to Call Button */}
                {selectedLead.contactPhone && (
                  <a
                    href={`tel:${selectedLead.contactPhone}`}
                    className="flex items-center px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-colors"
                  >
                    <Phone className="h-3 w-3 mr-1" />
                    Call
                  </a>
                )}
                {/* Properties/Reports Toggle Button */}
                <button 
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  onClick={() => setShowMobileProperties(!showMobileProperties)}
                >
                  <Building className="h-4 w-4 text-white/80" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Content - Chat or Properties */}
        <div className="flex-1 min-h-0 w-full overflow-hidden">
          {showMobileProperties ? (
            // Mobile Properties/Reports View
            <div className="h-full overflow-y-auto p-4 bg-gray-50">
              <div className="space-y-4">
                {/* Contact Details */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-[#04325E]">Contact Details</h3>
                    <button 
                      className="text-gray-400 hover:text-gray-600"
                      onClick={() => setShowMobileProperties(false)}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">{selectedLead.contactPhone || 'No phone'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">{selectedLead.contactEmail || 'No email'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">
                        {contactDetails?.address1 
                          ? `${contactDetails.address1}${contactDetails.city ? `, ${contactDetails.city}` : ''}${contactDetails.state ? `, ${contactDetails.state}` : ''}`
                          : 'No address available'
                        }
                      </span>
                    </div>
                  </div>
                </div>

                {/* Properties Section */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-[#04325E]">Properties</h3>
                    <button
                      onClick={() => setIsAddingProperty(!isAddingProperty)}
                      className="flex items-center px-3 py-2 bg-[#04325E] text-white rounded-lg text-sm font-medium hover:bg-[#0a4976] transition-colors"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Property
                    </button>
                  </div>

                  {/* Add Property Form */}
                  {isAddingProperty && (
                    <AddPropertyForm isMobile={true} />
                  )}

                  {/* Properties List */}
                  <div className="space-y-3">
                    {contactProperties.map((property, index) => (
                      <div key={property.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Home className="h-4 w-4 text-[#04325E]" />
                              <h4 className="font-medium text-sm text-[#04325E]">
                                {property.address}
                              </h4>
                            </div>
                            
                            {/* Property Analysis */}
                            {property.analysis && (
                              <div className="mt-3 space-y-2">
                                {/* Quick Metrics */}
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div className="bg-blue-50 p-2 rounded">
                                    <div className="text-blue-600 font-medium">ARV</div>
                                    <div className="text-blue-800">
                                      ${property.analysis.data?.analysis_summary?.estimated_arv?.toLocaleString() || 'N/A'}
                                    </div>
                                  </div>
                                  <div className="bg-green-50 p-2 rounded">
                                    <div className="text-green-600 font-medium">Investment Grade</div>
                                    <div className="text-green-800">
                                      {property.analysis.data?.analysis_summary?.investment_grade || 'N/A'}
                                    </div>
                                  </div>
                                  <div className="bg-red-50 p-2 rounded">
                                    <div className="text-red-600 font-medium">Repair Cost</div>
                                    <div className="text-red-800">
                                      ${property.analysis.data?.analysis_summary?.estimated_repair_cost?.toLocaleString() || 'N/A'}
                                    </div>
                                  </div>
                                  <div className="bg-purple-50 p-2 rounded">
                                    <div className="text-purple-600 font-medium">Max Offer</div>
                                    <div className="text-purple-800">
                                      ${property.analysis.data?.analysis_summary?.max_offer?.toLocaleString() || 'N/A'}
                                    </div>
                                  </div>
                                  <div className="bg-yellow-50 p-2 rounded">
                                    <div className="text-yellow-600 font-medium">Profit</div>
                                    <div className="text-yellow-800">
                                      ${property.analysis.data?.analysis_summary?.projected_profit?.toLocaleString() || 'N/A'}
                                    </div>
                                  </div>
                                  <div className="bg-indigo-50 p-2 rounded">
                                    <div className="text-indigo-600 font-medium">ROI</div>
                                    <div className="text-indigo-800">
                                      {property.analysis.data?.analysis_summary?.roi_percentage || 'N/A'}%
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Property Details */}
                                {property.analysis.data?.property_details && (
                                  <details className="bg-gray-50 rounded p-2">
                                    <summary className="text-xs font-medium text-gray-700 cursor-pointer">Property Details</summary>
                                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                      {property.analysis.data.property_details.square_footage && (
                                        <div className="text-center bg-white p-2 rounded">
                                          <div className="text-gray-500 uppercase tracking-wide">Area</div>
                                          <div className="font-semibold text-gray-900">
                                            {property.analysis.data.property_details.square_footage.toLocaleString()} sf
                                          </div>
                                        </div>
                                      )}
                                      {property.analysis.data.property_details.bedrooms && (
                                        <div className="text-center bg-white p-2 rounded">
                                          <div className="text-gray-500 uppercase tracking-wide">Bedrooms</div>
                                          <div className="font-semibold text-gray-900">
                                            {property.analysis.data.property_details.bedrooms}
                                          </div>
                                        </div>
                                      )}
                                      {property.analysis.data.property_details.bathrooms && (
                                        <div className="text-center bg-white p-2 rounded">
                                          <div className="text-gray-500 uppercase tracking-wide">Bathrooms</div>
                                          <div className="font-semibold text-gray-900">
                                            {property.analysis.data.property_details.bathrooms}
                                          </div>
                                        </div>
                                      )}
                                      {property.analysis.data.property_details.year_built && (
                                        <div className="text-center bg-white p-2 rounded">
                                          <div className="text-gray-500 uppercase tracking-wide">Built</div>
                                          <div className="font-semibold text-gray-900">
                                            {property.analysis.data.property_details.year_built}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </details>
                                )}
                                
                                {/* Financial Projections */}
                                {property.analysis.data?.financial_projections && (
                                  <details className="bg-gray-50 rounded p-2">
                                    <summary className="text-xs font-medium text-gray-700 cursor-pointer">💰 Financial Analysis</summary>
                                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                      <div className="bg-white p-2 rounded">
                                        <span className="text-gray-500">Purchase Price</span>
                                        <div className="font-bold text-sm">${property.analysis.data.financial_projections.purchase_price?.toLocaleString()}</div>
                                      </div>
                                      <div className="bg-white p-2 rounded">
                                        <span className="text-gray-500">Renovation</span>
                                        <div className="font-bold text-sm">${property.analysis.data.financial_projections.renovation_costs?.toLocaleString()}</div>
                                      </div>
                                      <div className="bg-white p-2 rounded">
                                        <span className="text-gray-500">Total Investment</span>
                                        <div className="font-bold text-sm">${property.analysis.data.financial_projections.total_investment?.toLocaleString()}</div>
                                      </div>
                                      <div className="bg-green-100 p-2 rounded">
                                        <span className="text-gray-500">Expected Sale</span>
                                        <div className="font-bold text-sm text-green-700">${property.analysis.data.financial_projections.estimated_sale_price?.toLocaleString()}</div>
                                      </div>
                                    </div>
                                  </details>
                                )}
                                
                                {/* Market Analysis */}
                                {property.analysis.data?.market_analysis && (
                                  <details className="bg-gray-50 rounded p-2">
                                    <summary className="text-xs font-medium text-gray-700 cursor-pointer">🏘️ Market Analysis</summary>
                                    <div className="mt-2 text-xs text-gray-600 space-y-1 bg-white p-2 rounded">
                                      <div><span className="font-medium">Market Trend:</span> {property.analysis.data.market_analysis.market_trend || 'N/A'}</div>
                                      {property.analysis.data.market_analysis.days_on_market_average && (
                                        <div><span className="font-medium">Avg Days on Market:</span> {property.analysis.data.market_analysis.days_on_market_average} days</div>
                                      )}
                                      <div><span className="font-medium">Neighborhood:</span> {property.analysis.data.market_analysis.neighborhood_grade || 'N/A'}</div>
                                    </div>
                                  </details>
                                )}
                                
                                {/* Investment Recommendation */}
                                {property.analysis.data?.investment_recommendation && (
                                  <details className="bg-gray-50 rounded p-2">
                                    <summary className="text-xs font-medium text-gray-700 cursor-pointer">📋 Investment Recommendation</summary>
                                    <div className="mt-2 bg-white p-2 rounded">
                                      <div className={`text-sm font-bold mb-1 ${
                                        property.analysis.data.investment_recommendation.decision === 'PROCEED' ? 'text-green-600' :
                                        property.analysis.data.investment_recommendation.decision === 'PROCEED_WITH_CAUTION' ? 'text-yellow-600' : 'text-red-600'
                                      }`}>
                                        {property.analysis.data.investment_recommendation.decision?.replace(/_/g, ' ')}
                                      </div>
                                      <div className="text-xs text-gray-600 mb-2">
                                        Confidence: {property.analysis.data.investment_recommendation.confidence_level}
                                      </div>
                                      {property.analysis.data.investment_recommendation.key_reasons && (
                                        <div className="text-xs">
                                          <strong>✅ Reasons:</strong>
                                          <ul className="list-disc list-inside mt-1 ml-2">
                                            {property.analysis.data.investment_recommendation.key_reasons.map((reason: string, i: number) => (
                                              <li key={i}>{reason}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {property.analysis.data.investment_recommendation.concerns && (
                                        <div className="text-xs mt-2">
                                          <strong>⚠️ Concerns:</strong>
                                          <ul className="list-disc list-inside mt-1 ml-2">
                                            {property.analysis.data.investment_recommendation.concerns.map((concern: string, i: number) => (
                                              <li key={i}>{concern}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  </details>
                                )}
                                
                                {/* Action Items */}
                                {property.analysis.data?.action_items && (
                                  <details className="bg-gray-50 rounded p-2">
                                    <summary className="text-xs font-medium text-gray-700 cursor-pointer">📝 Action Items</summary>
                                    <div className="mt-2 bg-white p-2 rounded">
                                      <ul className="text-xs space-y-1">
                                        {property.analysis.data.action_items.map((item: string, i: number) => (
                                          <li key={i} className="flex items-start gap-2">
                                            <span className="text-blue-600 mt-0.5">•</span>
                                            <span>{item}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </details>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="flex flex-col gap-1 ml-2">
                            <button
                              onClick={() => generatePropertyReport(property.id)}
                              disabled={generatingReportForProperty === property.id}
                              className="p-2 bg-[#04325E] text-white rounded hover:bg-[#0a4976] disabled:opacity-50 transition-colors"
                            >
                              {generatingReportForProperty === property.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <BarChart className="h-3 w-3" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteProperty(property.id)}
                              className="p-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Mobile Chat View
            <div className="h-full" ref={chatContainerRef}>
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
                    attachButton={false}
                  />
                </ChatContainer>
              </MainContainer>
            </div>
          )}
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
              {/* Chat Container - Card Style Design */}
              <div className="flex-1 min-h-0 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden" ref={chatContainerRef}>
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
                      attachButton={false}
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
              {/* Profile Content */}
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {isLoadingProfile ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <>
                    {/* Contact Header */}
                    <div className="bg-gradient-to-r from-[#04325E] to-[#0a4976] rounded-lg p-4 text-white">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h2 className="text-lg font-semibold truncate">
                            {contactDetails?.name || 
                             (contactDetails?.firstName && contactDetails?.lastName ? 
                              `${contactDetails.firstName} ${contactDetails.lastName}` : 
                              contactDetails?.firstName || contactDetails?.lastName || 'Contact')}
                          </h2>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 font-medium">
                              <span className="w-2 h-2 bg-green-400 rounded-full mr-1"></span>
                              Active Lead
                            </span>
                            {contactProperties.length > 0 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 font-medium">
                                {contactProperties.length} {contactProperties.length === 1 ? 'Property' : 'Properties'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Quick Actions */}
                      <div className="flex items-center justify-between">
                        <div className="flex space-x-2">
                          {contactDetails?.phone && (
                            <a 
                              href={`tel:${contactDetails.phone}`}
                              className="flex items-center px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-xs transition-colors"
                            >
                              <Phone className="h-3 w-3 mr-1" />
                              Call
                            </a>
                          )}
                          {contactDetails?.email && (
                            <a 
                              href={`mailto:${contactDetails.email}`}
                              className="flex items-center px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-xs transition-colors"
                            >
                              <Mail className="h-3 w-3 mr-1" />
                              Email
                            </a>
                          )}
                        </div>
                        <div className="text-xs opacity-75">
                          Last updated: {new Date().toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {/* Contact Summary Card */}
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900 flex items-center">
                          <User className="h-4 w-4 mr-2 text-gray-600" />
                          Contact Details
                        </h3>
                      </div>
                      <div className="p-4 space-y-3">
                        {contactDetails?.email && (
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                              <Mail className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
                              <a href={`mailto:${contactDetails.email}`} className="text-sm text-blue-600 hover:text-blue-800 truncate block">
                                {contactDetails.email}
                              </a>
                            </div>
                          </div>
                        )}
                        
                        {contactDetails?.phone && (
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                              <Phone className="h-4 w-4 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Phone</p>
                              <a href={`tel:${contactDetails.phone}`} className="text-sm text-green-600 hover:text-green-800">
                                {contactDetails.phone}
                              </a>
                            </div>
                          </div>
                        )}
                        
                        {(contactDetails?.address1 || contactDetails?.city || contactDetails?.state) && (
                          <div className="flex items-start">
                            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mr-3 mt-0.5">
                              <MapPin className="h-4 w-4 text-orange-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Address</p>
                              <div className="text-sm text-gray-700">
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
                          </div>
                        )}
                      </div>
                    </div>


                    {/* Property Portfolio */}
                    {contactProperties.length > 0 && (
                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-900 flex items-center">
                              <Home className="h-4 w-4 mr-2 text-gray-600" />
                              Property Portfolio ({contactProperties.length})
                            </h3>
                          </div>
                        </div>
                        <div className="p-4 space-y-4">
                          {contactProperties.map((property, index) => (
                            <div key={property.id} className="space-y-3">
                              {/* Property Card */}
                              <div
                                onClick={() => switchToProperty(index)}
                                className={`border rounded-lg p-3 cursor-pointer transition-all duration-200 ${
                                  selectedPropertyIndex === index
                                    ? 'border-[#04325E] bg-blue-50 shadow-sm'
                                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                }`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <div className={`w-3 h-3 rounded-full ${
                                        property.isPrimary ? 'bg-blue-500' : 'bg-gray-400'
                                      }`}></div>
                                      <span className="text-xs font-medium text-gray-600">
                                        {property.isPrimary ? 'Primary Property' : `Property ${index + 1}`}
                                      </span>
                                      {selectedPropertyIndex === index && (
                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                          Active
                                        </span>
                                      )}
                                      {property.analysis && (
                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                          Analyzed
                                        </span>
                                      )}
                                    </div>
                                    <div className="font-medium text-sm text-gray-900 truncate">
                                      {property.address}
                                    </div>
                                    <div className="text-xs text-gray-500 truncate">
                                      {property.city}, {property.state} {property.zipCode}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 ml-2">
                                    {/* Generate Report Button */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        generatePropertyReport(property.id)
                                      }}
                                      disabled={generatingReportForProperty === property.id}
                                      className={`p-2 rounded-lg transition-colors ${
                                        property.analysis 
                                          ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                                          : 'bg-[#04325E] text-white hover:bg-[#032847]'
                                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                                      title={property.analysis ? 'Regenerate Analysis' : 'Generate Analysis'}
                                    >
                                      {generatingReportForProperty === property.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <BarChart className="h-4 w-4" />
                                      )}
                                    </button>
                                    {!property.isPrimary && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          removeProperty(index)
                                        }}
                                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Comprehensive Analysis Section - Foldable */}
                              {property.analysis && (
                                <PropertyAnalysisSection property={property} />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}


                    {/* Action Center */}
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900 flex items-center">
                          <Zap className="h-4 w-4 mr-2 text-gray-600" />
                          Actions
                        </h3>
                      </div>
                      <div className="p-4 space-y-3">
                        {!isAddingProperty ? (
                          <button
                            onClick={() => setIsAddingProperty(true)}
                            className="w-full flex items-center justify-center px-4 py-3 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add New Property
                          </button>
                        ) : (
                          <AddPropertyForm isMobile={false} />
                        )}
                        
                        
                        {/* Next Steps for Active Property */}
                        {contactProperties[selectedPropertyIndex]?.analysis?.data?.action_items && (
                          <div className="pt-3 border-t border-gray-200">
                            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                              Next Steps - {contactProperties[selectedPropertyIndex].address}
                            </h4>
                            <ul className="space-y-2">
                              {contactProperties[selectedPropertyIndex].analysis.data.action_items.slice(0, 3).map((item: string, i: number) => (
                                <li key={i} className="flex items-start text-xs text-gray-600">
                                  <span className="text-blue-500 mr-2 mt-0.5">•</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                            <div className="mt-2 text-xs text-gray-500">
                              View complete analysis by expanding the property above
                            </div>
                          </div>
                        )}
                      </div>
                    </div>


                    {/* Tags */}
                    {contactDetails?.tags && contactDetails.tags.length > 0 && (
                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                          <h3 className="text-sm font-semibold text-gray-900">Tags</h3>
                        </div>
                        <div className="p-4">
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
