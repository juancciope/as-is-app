import { useState } from 'react';
import { ChevronDown, ChevronUp, Mail, Phone, MapPin, Home, User, Calendar } from 'lucide-react';

interface Contact {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name: string;
  emails: Array<{
    email: string;
    label: string;
    source: string;
    verified: boolean;
  }>;
  phones: Array<{
    number: string;
    label: string;
    source: string;
    verified: boolean;
  }>;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  created_at: string;
  updated_at: string;
  properties: Array<{
    id: string;
    address: string;
    city: string;
    county: string;
    sale_date?: string;
    source?: string;
  }>;
}

interface ContactsTableProps {
  contacts: Contact[];
  isLoading?: boolean;
}

export function ContactsTable({ contacts, isLoading = false }: ContactsTableProps) {
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedContacts, setExpandedContacts] = useState<Set<string>>(new Set());
  
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleExpanded = (contactId: string) => {
    const newExpanded = new Set(expandedContacts);
    if (newExpanded.has(contactId)) {
      newExpanded.delete(contactId);
    } else {
      newExpanded.add(contactId);
    }
    setExpandedContacts(newExpanded);
  };
  
  const sortedContacts = [...contacts].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case 'full_name':
        aValue = a.full_name || '';
        bValue = b.full_name || '';
        break;
      case 'emails':
        aValue = a.emails.length;
        bValue = b.emails.length;
        break;
      case 'phones':
        aValue = a.phones.length;
        bValue = b.phones.length;
        break;
      case 'properties':
        aValue = a.properties.length;
        bValue = b.properties.length;
        break;
      case 'created_at':
      default:
        aValue = new Date(a.created_at);
        bValue = new Date(b.created_at);
        break;
    }
    
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;
    
    let comparison = 0;
    if (aValue > bValue) comparison = 1;
    if (aValue < bValue) comparison = -1;
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });
  
  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) {
      return <ChevronDown className="h-4 w-4 text-blue-600" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="h-4 w-4 text-blue-800" />
      : <ChevronDown className="h-4 w-4 text-blue-800" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading contacts...</span>
      </div>
    );
  }
  
  return (
    <div className="relative overflow-x-auto bg-white rounded-lg border border-gray-200">
      <table className="w-full text-sm text-left text-gray-900 bg-white">
        <thead className="text-xs uppercase bg-gradient-to-r from-green-50 to-emerald-50 text-green-900">
          <tr>
            <th className="px-6 py-4 w-8"></th>
            <th 
              className="px-6 py-4 cursor-pointer hover:bg-green-100 transition-colors"
              onClick={() => handleSort('full_name')}
            >
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Contact Name
                <SortIcon field="full_name" />
              </div>
            </th>
            <th 
              className="px-6 py-4 cursor-pointer hover:bg-green-100 transition-colors"
              onClick={() => handleSort('emails')}
            >
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
                <SortIcon field="emails" />
              </div>
            </th>
            <th 
              className="px-6 py-4 cursor-pointer hover:bg-green-100 transition-colors"
              onClick={() => handleSort('phones')}
            >
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone
                <SortIcon field="phones" />
              </div>
            </th>
            <th className="px-6 py-4">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Address
              </div>
            </th>
            <th 
              className="px-6 py-4 cursor-pointer hover:bg-green-100 transition-colors"
              onClick={() => handleSort('properties')}
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Properties
                <SortIcon field="properties" />
              </div>
            </th>
            <th 
              className="px-6 py-4 cursor-pointer hover:bg-green-100 transition-colors"
              onClick={() => handleSort('created_at')}
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Added
                <SortIcon field="created_at" />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedContacts.map((contact) => (
            <tr key={contact.id}>
              <td className="px-6 py-4">
                <button
                  onClick={() => toggleExpanded(contact.id)}
                  className="text-blue-600 hover:text-blue-800 transition-colors"
                >
                  {expandedContacts.has(contact.id) ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </td>
              <td className="px-6 py-4 font-medium text-gray-900">
                <div className="flex flex-col">
                  <span className="font-semibold">
                    {contact.full_name || 'Unknown'}
                  </span>
                  {contact.first_name && (
                    <span className="text-xs text-gray-500">
                      {contact.first_name} {contact.last_name}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4">
                {contact.emails.length > 0 ? (
                  <div className="space-y-1">
                    {contact.emails.slice(0, 2).map((emailObj, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <a 
                          href={`mailto:${emailObj.email}`}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          {emailObj.email}
                        </a>
                        {emailObj.verified && (
                          <span className="text-xs text-green-600">✓</span>
                        )}
                      </div>
                    ))}
                    {contact.emails.length > 2 && (
                      <span className="text-xs text-gray-500">
                        +{contact.emails.length - 2} more
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-500 text-sm">No email</span>
                )}
              </td>
              <td className="px-6 py-4">
                {contact.phones.length > 0 ? (
                  <div className="space-y-1">
                    {contact.phones.slice(0, 2).map((phoneObj, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <a 
                          href={`tel:${phoneObj.number}`}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          {phoneObj.number}
                        </a>
                        {phoneObj.verified && (
                          <span className="text-xs text-green-600">✓</span>
                        )}
                      </div>
                    ))}
                    {contact.phones.length > 2 && (
                      <span className="text-xs text-gray-500">
                        +{contact.phones.length - 2} more
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-500 text-sm">No phone</span>
                )}
              </td>
              <td className="px-6 py-4">
                {contact.address ? (
                  <div className="text-sm">
                    <div>{contact.address}</div>
                    {(contact.city || contact.state || contact.zip) && (
                      <div className="text-gray-500">
                        {contact.city && contact.city}
                        {contact.city && contact.state && ', '}
                        {contact.state} {contact.zip}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-500 text-sm">No address</span>
                )}
              </td>
              <td className="px-6 py-4">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 font-medium">
                  {contact.properties.length} {contact.properties.length === 1 ? 'property' : 'properties'}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {new Date(contact.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
          
          {/* Expanded property details rows */}
          {sortedContacts.map((contact) => 
            expandedContacts.has(contact.id) && (
              <tr key={`${contact.id}-expanded`} className="bg-gray-50">
                <td></td>
                <td colSpan={6} className="px-6 py-4">
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Associated Properties:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {contact.properties.map((property) => (
                        <div key={property.id} className="bg-white p-3 rounded border border-gray-200">
                          <div className="font-medium text-sm">{property.address}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {property.city}, {property.county} County
                          </div>
                          {property.sale_date && (
                            <div className="text-xs text-blue-600 mt-1">
                              Sale: {new Date(property.sale_date).toLocaleDateString()}
                            </div>
                          )}
                          {property.source && (
                            <div className="text-xs text-gray-500 mt-1">
                              Source: {property.source}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
      
      {sortedContacts.length === 0 && (
        <div className="text-center py-12 text-gray-500 bg-white">
          <div className="flex flex-col items-center gap-2">
            <User className="h-12 w-12 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900">No Contacts Found</h3>
            <p className="text-sm">No contacts available for the current filter selection</p>
          </div>
        </div>
      )}
    </div>
  );
}