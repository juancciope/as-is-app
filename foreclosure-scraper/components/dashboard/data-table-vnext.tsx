'use client';

import { useState } from 'react';
import { 
  ChevronDown, ChevronUp, ExternalLink, MapPin, Calendar, Clock, 
  Search, CheckCircle2, Loader2, Star, TrendingUp, AlertCircle,
  Phone, Mail, User, Building
} from 'lucide-react';
import { FeatureFlags } from '@/lib/config';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

interface DataTableProps {
  data: any[];
}

interface EnhancedProperty {
  id: string;
  full_address?: string;
  address?: string; // Legacy support
  street?: string;
  city?: string;
  state?: string;
  county?: string;
  date?: string; // Legacy - sale date
  next_sale_date?: string; // vNext
  time?: string;
  firm?: string;
  source?: string;
  distance_miles?: number; // Legacy
  distance_nash_mi?: number; // vNext
  distance_mtjuliet_mi?: number; // vNext
  within_30min?: string; // Legacy (Y/N)
  within_30min_nash?: boolean; // vNext
  within_30min_mtjuliet?: boolean; // vNext
  owner_email_1?: string; // Legacy
  owner_phone_1?: string; // Legacy
  enriched?: boolean; // vNext
  contact_count?: number; // vNext
  score?: number; // vNext
  priority?: 'low' | 'medium' | 'high' | 'urgent'; // vNext
  urgency_days?: number; // vNext
  event_count?: number; // vNext
  stage?: string; // vNext
  property_type?: string; // vNext
  contacts?: any[]; // vNext
  events?: any[]; // vNext
}

export function DataTableVNext({ data }: DataTableProps) {
  const [sortField, setSortField] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [skipTracingIds, setSkipTracingIds] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  const isVNext = !FeatureFlags.USE_LEGACY;
  const showScoring = FeatureFlags.VNEXT_SCORING_ENABLED;
  const showDualProximity = FeatureFlags.USE_VNEXT_FILTERS;
  
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  const handleSkipTrace = async (propertyId: string) => {
    setSkipTracingIds(prev => new Set(prev).add(propertyId));
    
    try {
      const response = await fetch('/api/skip-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error('Skip trace API error:', result);
        const errorMessage = result.details || result.error || 'Unknown error occurred';
        alert(`Skip trace failed: ${errorMessage}`);
        return;
      }
      
      if (result.success) {
        window.location.reload(); // Simple refresh for now
      } else {
        console.error('Skip trace failed:', result);
        const errorMessage = result.details || result.error || 'Skip trace failed for unknown reason';
        alert(`Skip trace failed: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Skip trace error:', error);
      alert('Skip trace failed. Please try again.');
    } finally {
      setSkipTracingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(propertyId);
        return newSet;
      });
    }
  };
  
  const toggleRowExpanded = (rowId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  };
  
  const sortedData = [...data].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;
    
    if (sortField === 'date' || sortField === 'next_sale_date') {
      try {
        const dateA = new Date(aValue);
        const dateB = new Date(bValue);
        
        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
          return sortDirection === 'asc' 
            ? String(aValue).localeCompare(String(bValue))
            : String(bValue).localeCompare(String(aValue));
        }
        
        return sortDirection === 'asc' 
          ? dateA.getTime() - dateB.getTime()
          : dateB.getTime() - dateA.getTime();
      } catch {
        return sortDirection === 'asc' 
          ? String(aValue).localeCompare(String(bValue))
          : String(bValue).localeCompare(String(aValue));
      }
    }
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    const comparison = String(aValue).localeCompare(String(bValue));
    return sortDirection === 'asc' ? comparison : -comparison;
  });
  
  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) {
      return <ChevronDown className="h-4 w-4 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="h-4 w-4 text-blue-600" />
      : <ChevronDown className="h-4 w-4 text-blue-600" />;
  };
  
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 ring-1 ring-red-600/20';
      case 'high': return 'bg-orange-100 text-orange-800 ring-1 ring-orange-600/20';
      case 'medium': return 'bg-yellow-100 text-yellow-800 ring-1 ring-yellow-600/20';
      case 'low': return 'bg-gray-100 text-gray-800 ring-1 ring-gray-600/20';
      default: return 'bg-gray-100 text-gray-600';
    }
  };
  
  const getStageColor = (stage?: string) => {
    switch (stage) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'researching': return 'bg-purple-100 text-purple-800';
      case 'contacting': return 'bg-indigo-100 text-indigo-800';
      case 'negotiating': return 'bg-yellow-100 text-yellow-800';
      case 'under_contract': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };
  
  const getPropertyTypeIcon = (type?: string) => {
    switch (type) {
      case 'SFR': return <Building className="h-3 w-3" />;
      case 'Condo': return <Building className="h-3 w-3" />;
      case 'Multi-Family': return <Building className="h-3 w-3" />;
      default: return <Building className="h-3 w-3" />;
    }
  };
  
  const formatAddress = (row: EnhancedProperty) => {
    if (row.full_address) return row.full_address;
    if (row.address) return row.address;
    if (row.street) {
      return `${row.street}${row.city ? ', ' + row.city : ''}${row.state ? ', ' + row.state : ''}`;
    }
    return 'N/A';
  };
  
  return (
    <div className="relative overflow-x-auto bg-white rounded-lg border border-gray-200">
      <table className="w-full text-sm text-left text-gray-900 bg-white">
        <thead className="text-xs uppercase bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-900">
          <tr>
            {/* Score Column - vNext only */}
            {showScoring && (
              <th 
                className="px-4 py-4 cursor-pointer hover:bg-blue-100 transition-colors"
                onClick={() => handleSort('score')}
              >
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Score
                  <SortIcon field="score" />
                </div>
              </th>
            )}
            
            <th 
              className="px-6 py-4 cursor-pointer hover:bg-blue-100 transition-colors"
              onClick={() => handleSort(isVNext ? 'next_sale_date' : 'date')}
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Sale Date
                <SortIcon field={isVNext ? 'next_sale_date' : 'date'} />
              </div>
            </th>
            
            <th className="px-6 py-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Time
              </div>
            </th>
            
            <th 
              className="px-6 py-4 cursor-pointer hover:bg-blue-100 transition-colors"
              onClick={() => handleSort(isVNext ? 'full_address' : 'address')}
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Address
                <SortIcon field={isVNext ? 'full_address' : 'address'} />
              </div>
            </th>
            
            <th className="px-6 py-4">County</th>
            
            {/* Distance columns - conditional based on features */}
            {!showDualProximity ? (
              <th 
                className="px-6 py-4 cursor-pointer hover:bg-blue-100 transition-colors"
                onClick={() => handleSort('distance_miles')}
              >
                <div className="flex items-center gap-2">
                  Distance
                  <SortIcon field="distance_miles" />
                </div>
              </th>
            ) : (
              <>
                <th 
                  className="px-4 py-4 cursor-pointer hover:bg-blue-100 transition-colors"
                  onClick={() => handleSort('distance_nash_mi')}
                >
                  <div className="flex items-center gap-1 text-xs">
                    <MapPin className="h-3 w-3" />
                    Nash
                    <SortIcon field="distance_nash_mi" />
                  </div>
                </th>
                <th 
                  className="px-4 py-4 cursor-pointer hover:bg-blue-100 transition-colors"
                  onClick={() => handleSort('distance_mtjuliet_mi')}
                >
                  <div className="flex items-center gap-1 text-xs">
                    <MapPin className="h-3 w-3" />
                    Mt.J
                    <SortIcon field="distance_mtjuliet_mi" />
                  </div>
                </th>
              </>
            )}
            
            <th className="px-6 py-4">Source</th>
            <th className="px-6 py-4">Contact Info</th>
            
            {/* Stage column - vNext only */}
            {isVNext && (
              <th className="px-6 py-4">Stage</th>
            )}
            
            <th className="px-6 py-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row: EnhancedProperty, index) => {
            const isExpanded = expandedRows.has(row.id);
            const hasContacts = row.enriched || row.owner_email_1 || row.owner_phone_1;
            
            return (
              <React.Fragment key={row.id || index}>
                <tr 
                  className={cn(
                    "bg-white border-b border-gray-100 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-150",
                    isExpanded && "bg-blue-50"
                  )}
                >
                  {/* Score Cell */}
                  {showScoring && (
                    <td className="px-4 py-4">
                      {row.score !== undefined ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className={cn(
                            "inline-flex items-center px-2 py-1 text-xs font-medium rounded-full",
                            getPriorityColor(row.priority)
                          )}>
                            {row.score}
                          </span>
                          {row.urgency_days !== undefined && row.urgency_days <= 7 && (
                            <AlertCircle className="h-3 w-3 text-red-600" title={`${row.urgency_days} days`} />
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  )}
                  
                  {/* Date Cell */}
                  <td className="px-6 py-4 font-medium text-gray-900">
                    <div className="flex flex-col">
                      <span>{row.next_sale_date || row.date}</span>
                      {row.urgency_days !== undefined && (
                        <span className="text-xs text-gray-500">
                          {row.urgency_days === 0 ? 'Today' : `${row.urgency_days} days`}
                        </span>
                      )}
                    </div>
                  </td>
                  
                  {/* Time Cell */}
                  <td className="px-6 py-4 text-gray-900">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                      {row.time || 'N/A'}
                    </span>
                  </td>
                  
                  {/* Address Cell */}
                  <td className="px-6 py-4 max-w-xs text-gray-900" title={formatAddress(row)}>
                    <div className="flex items-center gap-2">
                      <div className="truncate font-medium">{formatAddress(row)}</div>
                      {row.property_type && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          {getPropertyTypeIcon(row.property_type)}
                          {row.property_type}
                        </span>
                      )}
                    </div>
                  </td>
                  
                  {/* County Cell */}
                  <td className="px-6 py-4 text-gray-900">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                      {row.county || 'N/A'}
                    </span>
                  </td>
                  
                  {/* Distance Cells */}
                  {!showDualProximity ? (
                    <td className="px-6 py-4 text-gray-900">
                      {row.distance_miles !== undefined ? (
                        <span className={cn(
                          "inline-flex items-center px-2 py-1 rounded-full text-xs",
                          row.within_30min === 'Y' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                        )}>
                          {row.distance_miles} mi
                        </span>
                      ) : (
                        <span className="text-gray-500">N/A</span>
                      )}
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-4 text-gray-900">
                        {row.distance_nash_mi !== undefined ? (
                          <span className={cn(
                            "inline-flex items-center px-2 py-1 rounded-full text-xs",
                            row.within_30min_nash ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                          )}>
                            {row.distance_nash_mi} mi
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-gray-900">
                        {row.distance_mtjuliet_mi !== undefined ? (
                          <span className={cn(
                            "inline-flex items-center px-2 py-1 rounded-full text-xs",
                            row.within_30min_mtjuliet ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                          )}>
                            {row.distance_mtjuliet_mi} mi
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">N/A</span>
                        )}
                      </td>
                    </>
                  )}
                  
                  {/* Source Cell */}
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800 font-medium">
                      {getSourceDisplayName(row.source)}
                    </span>
                  </td>
                  
                  {/* Contact Info Cell */}
                  <td className="px-6 py-4">
                    {hasContacts ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-xs text-green-600 font-medium">
                          {isVNext && row.contact_count ? `${row.contact_count} contacts` : 'Enriched'}
                        </span>
                        {isVNext && row.contacts && row.contacts.length > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleRowExpanded(row.id)}
                            className="h-6 px-2 text-xs"
                          >
                            {isExpanded ? 'Hide' : 'Show'}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSkipTrace(row.id)}
                        disabled={skipTracingIds.has(row.id)}
                        className="inline-flex items-center px-3 py-1 text-xs font-medium text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Run skip trace to find contact information"
                      >
                        {skipTracingIds.has(row.id) ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Tracing...
                          </>
                        ) : (
                          <>
                            <Search className="h-3 w-3 mr-1" />
                            Skip Trace
                          </>
                        )}
                      </button>
                    )}
                  </td>
                  
                  {/* Stage Cell - vNext only */}
                  {isVNext && (
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                        getStageColor(row.stage)
                      )}>
                        {row.stage || 'new'}
                      </span>
                    </td>
                  )}
                  
                  {/* Actions Cell */}
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const address = encodeURIComponent(formatAddress(row));
                          window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank');
                        }}
                        className="inline-flex items-center px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors"
                        title="View on Google Maps"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Maps
                      </button>
                      {showScoring && (
                        <button
                          onClick={() => {
                            window.open(`/api/properties/${row.id}/analyze`, '_blank');
                          }}
                          className="inline-flex items-center px-3 py-1 text-xs font-medium text-orange-600 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 rounded-full transition-colors"
                          title="View detailed analysis"
                        >
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Analyze
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                
                {/* Expanded Contact Details Row */}
                {isExpanded && isVNext && row.contacts && row.contacts.length > 0 && (
                  <tr>
                    <td colSpan={showScoring ? 12 : 11} className="px-6 py-4 bg-gray-50">
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Contact Information
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {row.contacts.map((contact: any, idx: number) => (
                            <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200">
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  {(contact.name_first || contact.name_last) && (
                                    <p className="font-medium text-gray-900">
                                      {contact.name_first} {contact.name_last}
                                    </p>
                                  )}
                                  {contact.phones && contact.phones.length > 0 && (
                                    <div className="flex items-center gap-1 text-sm text-gray-600">
                                      <Phone className="h-3 w-3" />
                                      {contact.phones.map((p: any) => p.number).join(', ')}
                                    </div>
                                  )}
                                  {contact.emails && contact.emails.length > 0 && (
                                    <div className="flex items-center gap-1 text-sm text-gray-600">
                                      <Mail className="h-3 w-3" />
                                      {contact.emails.map((e: any) => e.email).join(', ')}
                                    </div>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500">
                                  {contact.contact_type}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      
      {sortedData.length === 0 && (
        <div className="text-center py-12 text-gray-500 bg-white">
          <div className="flex flex-col items-center gap-2">
            <MapPin className="h-12 w-12 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900">No Properties Found</h3>
            <p className="text-sm">Run scrapers to collect property data</p>
          </div>
        </div>
      )}
    </div>
  );
}

function getSourceDisplayName(source?: string): string {
  if (!source) return 'N/A';
  const names: Record<string, string> = {
    'phillipjoneslaw': 'PJ Law',
    'clearrecon': 'ClearRecon',
    'tnledger': 'TN Ledger',
    'wabipowerbi': 'WABI',
    'wilsonassociates': 'Wilson',
    'wilson': 'Wilson',
    'connectedinvestors': 'CI'
  };
  return names[source] || source;
}