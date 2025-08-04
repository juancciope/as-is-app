'use client';

import { useState, useEffect } from 'react';
import { Store, User, Home, MapPin, Calendar, DollarSign, Search, Filter, Eye, Phone, Mail, Tag, AlertCircle } from 'lucide-react';

interface MarketplaceProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  estimatedValue: number;
  lastUpdated: string;
  status: 'available' | 'pending' | 'sold' | 'withdrawn';
  sourceType: 'probate' | 'auction' | 'divorce' | 'immigration' | 'pawn_shop' | 'cpa' | 'bail' | 'foreclosure' | 'tax_lien';
  compellingEvent: string;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  owner: MarketplaceOwner;
}

interface MarketplaceOwner {
  id: string;
  name: string;
  situation: string; // describes their current situation
  phone?: string;
  email?: string;
  address?: string;
  motivationScore: number; // 1-10 scale
}

export default function MarketplacePage() {
  const [properties, setProperties] = useState<MarketplaceProperty[]>([]);
  const [owners, setOwners] = useState<MarketplaceOwner[]>([]);
  const [activeTab, setActiveTab] = useState<'properties' | 'owners'>('properties');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // TODO: Replace with actual API calls from multiple data sources
    const mockProperties: MarketplaceProperty[] = [
      {
        id: '1',
        address: '456 Oak Lane',
        city: 'Nashville',
        state: 'TN',
        zipCode: '37215',
        estimatedValue: 285000,
        lastUpdated: '2024-08-01',
        status: 'available',
        sourceType: 'divorce',
        compellingEvent: 'Divorce proceedings requiring quick sale',
        urgencyLevel: 'high',
        owner: {
          id: '1',
          name: 'Sarah Mitchell',
          situation: 'Going through divorce, needs to liquidate assets',
          phone: '(615) 555-0987',
          email: 'smitchell@example.com',
          motivationScore: 8
        }
      },
      {
        id: '2',
        address: '123 Maple Drive',
        city: 'Nashville',
        state: 'TN',
        zipCode: '37203',
        estimatedValue: 195000,
        lastUpdated: '2024-07-28',
        status: 'available',
        sourceType: 'probate',
        compellingEvent: 'Estate settlement required',
        urgencyLevel: 'medium',
        owner: {
          id: '2',
          name: 'Johnson Estate',
          situation: 'Estate needs to be settled within 6 months',
          email: 'executor@example.com',
          motivationScore: 6
        }
      },
      {
        id: '3',
        address: '789 Pine Street',
        city: 'Nashville',
        state: 'TN',
        zipCode: '37204',
        estimatedValue: 340000,
        lastUpdated: '2024-08-03',
        status: 'available',
        sourceType: 'immigration',
        compellingEvent: 'Relocation assistance needed',
        urgencyLevel: 'critical',
        owner: {
          id: '3',
          name: 'Carlos Rodriguez Family',
          situation: 'Relocating for new opportunities, time-sensitive',
          phone: '(615) 555-0654',
          motivationScore: 9
        }
      },
      {
        id: '4',
        address: '321 Cedar Avenue',
        city: 'Nashville',
        state: 'TN',
        zipCode: '37206',
        estimatedValue: 225000,
        lastUpdated: '2024-07-30',
        status: 'pending',
        sourceType: 'cpa',
        compellingEvent: 'Tax planning optimization',
        urgencyLevel: 'medium',
        owner: {
          id: '4',
          name: 'Anderson Family Trust',
          situation: 'Tax planning requires property restructuring',
          phone: '(615) 555-0321',
          motivationScore: 5
        }
      }
    ];

    const mockOwners: MarketplaceOwner[] = mockProperties.map(p => p.owner);
    
    setProperties(mockProperties);
    setOwners(mockOwners);
    setIsLoading(false);
  }, []);

  const filteredProperties = properties.filter(property => {
    const matchesSearch = property.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         property.owner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         property.compellingEvent.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || property.status === statusFilter;
    const matchesSource = sourceFilter === 'all' || property.sourceType === sourceFilter;
    const matchesUrgency = urgencyFilter === 'all' || property.urgencyLevel === urgencyFilter;
    return matchesSearch && matchesStatus && matchesSource && matchesUrgency;
  });

  const filteredOwners = owners.filter(owner => {
    return owner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           owner.situation.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (owner.phone && owner.phone.includes(searchTerm)) ||
           (owner.email && owner.email.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'sold': return 'text-gray-600 bg-gray-100';
      case 'withdrawn': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSourceColor = (source: string) => {
    const colors = {
      'probate': 'text-purple-600 bg-purple-100',
      'auction': 'text-blue-600 bg-blue-100',
      'divorce': 'text-pink-600 bg-pink-100',
      'immigration': 'text-indigo-600 bg-indigo-100',
      'pawn_shop': 'text-yellow-600 bg-yellow-100',
      'cpa': 'text-green-600 bg-green-100',
      'bail': 'text-red-600 bg-red-100',
      'foreclosure': 'text-orange-600 bg-orange-100',
      'tax_lien': 'text-amber-600 bg-amber-100'
    };
    return colors[source as keyof typeof colors] || 'text-gray-600 bg-gray-100';
  };

  const formatSourceType = (source: string) => {
    return source.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getMotivationColor = (score: number) => {
    if (score >= 8) return 'text-red-600';
    if (score >= 6) return 'text-orange-600';
    if (score >= 4) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Store className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Loading marketplace data...</p>
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
            <Store className="h-8 w-8 mr-3 text-[#04325E]" />
            Marketplace
          </h1>
          <p className="text-gray-600 mt-1">
            Centralized database of all property opportunities from multiple compelling event sources
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Home className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Properties</p>
              <p className="text-2xl font-bold text-gray-900">{properties.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">High Urgency</p>
              <p className="text-2xl font-bold text-gray-900">
                {properties.filter(p => p.urgencyLevel === 'high' || p.urgencyLevel === 'critical').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Tag className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Available</p>
              <p className="text-2xl font-bold text-gray-900">
                {properties.filter(p => p.status === 'available').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <DollarSign className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Value</p>
              <p className="text-2xl font-bold text-gray-900">
                ${(properties.reduce((sum, p) => sum + p.estimatedValue, 0) / 1000000).toFixed(1)}M
              </p>
            </div>
          </div>
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
                placeholder="Search by address, owner, or compelling event..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#04325E] focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#04325E] focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="pending">Pending</option>
              <option value="sold">Sold</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#04325E] focus:border-transparent"
            >
              <option value="all">All Sources</option>
              <option value="probate">Probate</option>
              <option value="auction">Auction</option>
              <option value="divorce">Divorce</option>
              <option value="immigration">Immigration</option>
              <option value="pawn_shop">Pawn Shop</option>
              <option value="cpa">CPA</option>
              <option value="bail">Bail</option>
              <option value="foreclosure">Foreclosure</option>
              <option value="tax_lien">Tax Lien</option>
            </select>
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#04325E] focus:border-transparent"
            >
              <option value="all">All Urgency</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
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
                    Owner & Situation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source & Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Urgency & Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value & Motivation
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
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {property.owner.name}
                      </div>
                      <div className="text-sm text-gray-500 max-w-xs">
                        {property.owner.situation}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="mb-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSourceColor(property.sourceType)}`}>
                          {formatSourceType(property.sourceType)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 max-w-xs">
                        {property.compellingEvent}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="mb-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getUrgencyColor(property.urgencyLevel)}`}>
                          {property.urgencyLevel}
                        </span>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(property.status)}`}>
                        {property.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-green-600 mb-1">
                        <DollarSign className="h-4 w-4 mr-1" />
                        {property.estimatedValue.toLocaleString()}
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">Motivation: </span>
                        <span className={`font-semibold ${getMotivationColor(property.owner.motivationScore)}`}>
                          {property.owner.motivationScore}/10
                        </span>
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
                    Situation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Motivation Score
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
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 max-w-xs">
                        {owner.situation}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-lg font-bold ${getMotivationColor(owner.motivationScore)}`}>
                        {owner.motivationScore}/10
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
          <Store className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No properties found</h3>
          <p className="text-gray-600">
            {searchTerm || statusFilter !== 'all' || sourceFilter !== 'all' || urgencyFilter !== 'all' 
              ? 'Try adjusting your search or filters.' 
              : 'Property data from various sources will appear here once available.'}
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