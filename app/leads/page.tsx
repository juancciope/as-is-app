'use client'

import { useState } from 'react'
import { Star, MessageCircle, Phone, Mail, Calendar } from 'lucide-react'

export default function LeadsPage() {
  const [selectedLead, setSelectedLead] = useState<any>(null)

  // Placeholder data - will be replaced with GHL integration
  const leads = [
    {
      id: 1,
      name: 'John Doe',
      phone: '(555) 123-4567',
      email: 'john.doe@email.com',
      lastMessage: 'I\'m interested in the property on Main St',
      lastMessageTime: '2 hours ago',
      starred: true,
      unread: 2
    },
    {
      id: 2,
      name: 'Jane Smith',
      phone: '(555) 987-6543',
      email: 'jane.smith@email.com',
      lastMessage: 'Can we schedule a viewing?',
      lastMessageTime: '5 hours ago',
      starred: true,
      unread: 0
    }
  ]

  return (
    <div className="h-full bg-white rounded-lg shadow">
      <div className="flex h-full">
        {/* Leads List */}
        <div className="w-1/3 border-r border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
            <p className="text-sm text-gray-600 mt-1">Starred conversations from Go High Level</p>
          </div>
          
          <div className="overflow-y-auto">
            {leads.map((lead) => (
              <div
                key={lead.id}
                onClick={() => setSelectedLead(lead)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                  selectedLead?.id === lead.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h3 className="font-semibold text-gray-900">{lead.name}</h3>
                      {lead.starred && <Star className="ml-2 h-4 w-4 text-yellow-400 fill-current" />}
                      {lead.unread > 0 && (
                        <span className="ml-2 px-2 py-1 text-xs bg-blue-500 text-white rounded-full">
                          {lead.unread}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{lead.lastMessage}</p>
                    <p className="text-xs text-gray-500 mt-1">{lead.lastMessageTime}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lead Details */}
        <div className="flex-1">
          {selectedLead ? (
            <div className="h-full flex flex-col">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{selectedLead.name}</h2>
                    <div className="flex items-center mt-2 space-x-4">
                      <a href={`tel:${selectedLead.phone}`} className="flex items-center text-sm text-gray-600 hover:text-gray-900">
                        <Phone className="h-4 w-4 mr-1" />
                        {selectedLead.phone}
                      </a>
                      <a href={`mailto:${selectedLead.email}`} className="flex items-center text-sm text-gray-600 hover:text-gray-900">
                        <Mail className="h-4 w-4 mr-1" />
                        {selectedLead.email}
                      </a>
                    </div>
                  </div>
                  <button className="p-2 text-gray-400 hover:text-gray-600">
                    <Star className={`h-5 w-5 ${selectedLead.starred ? 'text-yellow-400 fill-current' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
                <div className="text-center text-gray-500">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Conversation history will appear here</p>
                  <p className="text-sm mt-2">Integration with Go High Level coming soon</p>
                </div>
              </div>

              <div className="p-4 border-t border-gray-200">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                    Send
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
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