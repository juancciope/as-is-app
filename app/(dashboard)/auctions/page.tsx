'use client';

import { useState, useEffect } from 'react';
import { Gavel, User, Home, MapPin, Calendar, DollarSign, Search, Filter, Eye, Phone, Mail, Clock } from 'lucide-react';

interface AuctionProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  estimatedValue: number;
  auctionDate: string;
  auctionTime: string;
  status: 'upcoming' | 'active' | 'sold' | 'withdrawn';
  minimumBid?: number;
  auctionType: 'foreclosure' | 'tax_lien' | 'estate' | 'bankruptcy';
  owner: AuctionOwner;
}

interface AuctionOwner {
  id: string;
  name: string;
  relationship: string; // borrower, estate, business, etc.
  phone?: string;
  email?: string;
  address?: string;
}

export default function AuctionsPage() {
  const [properties, setProperties] = useState<AuctionProperty[]>([]);
  const [owners, setOwners] = useState<AuctionOwner[]>([]);
  const [activeTab, setActiveTab] = useState<'properties' | 'owners'>('properties');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // TODO: Replace with actual API call
    const mockProperties: AuctionProperty[] = [
      {
        id: '1',
        address: '789 Pine Street',
        city: 'Nashville',
        state: 'TN',
        zipCode: '37204',
        estimatedValue: 320000,
        auctionDate: '2024-08-15',
        auctionTime: '10:00 AM',
        status: 'upcoming',
        minimumBid: 200000,
        auctionType: 'foreclosure',
        owner: {
          id: '1',
          name: 'Robert Wilson',
          relationship: 'borrower',
          phone: '(615) 555-0789',
          email: 'rwilson@example.com'
        }
      },
      {
        id: '2',
        address: '321 Cedar Avenue',
        city: 'Nashville',
        state: 'TN',
        zipCode: '37206',
        estimatedValue: 150000,
        auctionDate: '2024-08-20',
        auctionTime: '2:00 PM',
        status: 'upcoming',
        minimumBid: 75000,
        auctionType: 'tax_lien',
        owner: {
          id: '2',
          name: 'ABC Properties LLC',
          relationship: 'business',
          phone: '(615) 555-0321'
        }
      },
      {
        id: '3',
        address: '654 Elm Street',
        city: 'Nashville',
        state: 'TN',
        zipCode: '37207',
        estimatedValue: 280000,
        auctionDate: '2024-07-25',
        auctionTime: '11:00 AM',
        status: 'sold',
        minimumBid: 180000,
        auctionType: 'estate',
        owner: {
          id: '3',
          name: 'Thompson Estate',
          relationship: 'estate',
          email: 'estate@example.com'
        }
      }
    ];

    const mockOwners: AuctionOwner[] = mockProperties.map(p => p.owner);
    
    setProperties(mockProperties);
    setOwners(mockOwners);
    setIsLoading(false);
  }, []);

  const filteredProperties = properties.filter(property => {
    const matchesSearch = property.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         property.owner.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || property.status === statusFilter;
    const matchesType = typeFilter === 'all' || property.auctionType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const filteredOwners = owners.filter(owner => {
    return owner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (owner.phone && owner.phone.includes(searchTerm)) ||
           (owner.email && owner.email.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'text-blue-600 bg-blue-100';
      case 'active': return 'text-green-600 bg-green-100';
      case 'sold': return 'text-gray-600 bg-gray-100';
      case 'withdrawn': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'foreclosure': return 'text-red-600 bg-red-100';
      case 'tax_lien': return 'text-yellow-600 bg-yellow-100';
      case 'estate': return 'text-purple-600 bg-purple-100';
      case 'bankruptcy': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatAuctionType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Gavel className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Loading auction data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Gavel className="h-8 w-8 mr-3 text-[#04325E]" />
            Auctions
          </h1>
          <p className="text-gray-600 mt-1">
            Track property auctions including foreclosures, tax liens, and estate sales
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search by address or owner name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#04325E] focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#04325E] focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="sold">Sold</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#04325E] focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="foreclosure">Foreclosure</option>
              <option value="tax_lien">Tax Lien</option>
              <option value="estate">Estate</option>
              <option value="bankruptcy">Bankruptcy</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('properties')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'properties'
                ? 'border-[#04325E] text-[#04325E]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Home className="inline-block h-4 w-4 mr-2" />
            Properties ({filteredProperties.length})
          </button>
          <button
            onClick={() => setActiveTab('owners')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'owners'
                ? 'border-[#04325E] text-[#04325E]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <User className="inline-block h-4 w-4 mr-2" />
            Owners ({filteredOwners.length})
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'properties' ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Property
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Owner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Auction Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Est. Value / Min Bid
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProperties.map((property) => (
                  <tr key={property.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {property.address}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center">
                          <MapPin className="h-3 w-3 mr-1" />
                          {property.city}, {property.state} {property.zipCode}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {property.owner.name}
                      </div>
                      <div className="text-sm text-gray-500 capitalize">
                        {property.owner.relationship}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(property.auctionType)}`}>
                        {formatAuctionType(property.auctionType)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(property.status)}`}>
                        {property.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1 text-blue-600" />
                        <div>
                          <div>{new Date(property.auctionDate).toLocaleDateString()}</div>
                          <div className="text-xs text-gray-500 flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {property.auctionTime}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="flex items-center text-green-600">
                          <DollarSign className="h-4 w-4 mr-1" />
                          {property.estimatedValue.toLocaleString()}
                        </div>
                        {property.minimumBid && (
                          <div className="text-xs text-gray-500">
                            Min: ${property.minimumBid.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button className="text-[#04325E] hover:text-[#0a4976] transition-colors">
                          <Eye className="h-4 w-4" />
                        </button>
                        {property.owner.phone && (
                          <a href={`tel:${property.owner.phone}`} className="text-green-600 hover:text-green-700 transition-colors">
                            <Phone className="h-4 w-4" />
                          </a>
                        )}
                        {property.owner.email && (
                          <a href={`mailto:${property.owner.email}`} className="text-blue-600 hover:text-blue-700 transition-colors">
                            <Mail className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Relationship
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact Info
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOwners.map((owner) => (
                  <tr key={owner.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {owner.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500 capitalize">
                        {owner.relationship}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {owner.phone && (
                          <div className="flex items-center">
                            <Phone className="h-3 w-3 mr-1" />
                            {owner.phone}
                          </div>
                        )}
                        {owner.email && (
                          <div className="flex items-center mt-1">
                            <Mail className="h-3 w-3 mr-1" />
                            {owner.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button className="text-[#04325E] hover:text-[#0a4976] transition-colors">
                          <Eye className="h-4 w-4" />
                        </button>
                        {owner.phone && (
                          <a href={`tel:${owner.phone}`} className="text-green-600 hover:text-green-700 transition-colors">
                            <Phone className="h-4 w-4" />
                          </a>
                        )}
                        {owner.email && (
                          <a href={`mailto:${owner.email}`} className="text-blue-600 hover:text-blue-700 transition-colors">
                            <Mail className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty States */}
      {activeTab === 'properties' && filteredProperties.length === 0 && (
        <div className="text-center py-12">
          <Gavel className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No auction properties found</h3>
          <p className="text-gray-600">
            {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' ? 'Try adjusting your search or filters.' : 'Auction data will appear here once available.'}
          </p>
        </div>
      )}

      {activeTab === 'owners' && filteredOwners.length === 0 && (
        <div className="text-center py-12">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No owners found</h3>
          <p className="text-gray-600">
            {searchTerm ? 'Try adjusting your search.' : 'Owner data will appear here once available.'}
          </p>
        </div>
      )}
    </div>
  );
}