import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, MapPin, Calendar, Clock, Search, CheckCircle2, Loader2 } from 'lucide-react';

interface DataTableProps {
  data: any[];
  onDataUpdate?: () => void;
}

export function DataTable({ data, onDataUpdate }: DataTableProps) {
  const [sortField, setSortField] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [skipTracingIds, setSkipTracingIds] = useState<Set<string>>(new Set());
  const [feedbackMessage, setFeedbackMessage] = useState<{type: 'success' | 'error', message: string} | null>(null);
  
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
    setFeedbackMessage(null);
    
    try {
      const response = await fetch('/api/skip-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        // Handle HTTP error responses
        console.error('Skip trace API error:', result);
        const errorMessage = result.details || result.error || 'Unknown error occurred';
        setFeedbackMessage({
          type: 'error',
          message: `Skip trace failed: ${errorMessage}`
        });
        return;
      }
      
      if (result.success) {
        // Show success message
        const emailCount = result.data?.emails?.length || 0;
        const phoneCount = result.data?.phones?.length || 0;
        setFeedbackMessage({
          type: 'success',
          message: `Skip trace completed! Found ${emailCount} email(s) and ${phoneCount} phone(s).`
        });
        
        // Refresh data without losing filters
        if (onDataUpdate) {
          onDataUpdate();
        }
      } else {
        console.error('Skip trace failed:', result);
        const errorMessage = result.details || result.error || 'Skip trace failed for unknown reason';
        setFeedbackMessage({
          type: 'error',
          message: `Skip trace failed: ${errorMessage}`
        });
      }
    } catch (error) {
      console.error('Skip trace error:', error);
      setFeedbackMessage({
        type: 'error',
        message: 'Skip trace failed. Please try again.'
      });
    } finally {
      setSkipTracingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(propertyId);
        return newSet;
      });
      
      // Clear feedback message after 5 seconds
      setTimeout(() => {
        setFeedbackMessage(null);
      }, 5000);
    }
  };
  
  const sortedData = [...data].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;
    
    if (sortField === 'date') {
      try {
        const dateA = new Date(aValue);
        const dateB = new Date(bValue);
        
        // If dates are invalid, fall back to string comparison
        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
          return sortDirection === 'asc' 
            ? String(aValue).localeCompare(String(bValue))
            : String(bValue).localeCompare(String(aValue));
        }
        
        return sortDirection === 'asc' 
          ? dateA.getTime() - dateB.getTime()
          : dateB.getTime() - dateA.getTime();
      } catch {
        // Fallback to string comparison if date parsing fails
        return sortDirection === 'asc' 
          ? String(aValue).localeCompare(String(bValue))
          : String(bValue).localeCompare(String(aValue));
      }
    }
    
    if (sortField === 'distance_miles' || sortField === 'est_drive_time') {
      const numA = parseFloat(aValue) || 0;
      const numB = parseFloat(bValue) || 0;
      return sortDirection === 'asc' ? numA - numB : numB - numA;
    }
    
    const comparison = String(aValue).localeCompare(String(bValue));
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
  
  return (
    <div className="space-y-4">
      {/* Feedback Message */}
      {feedbackMessage && (
        <div className={`p-4 rounded-lg border ${
          feedbackMessage.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span className="font-medium">{feedbackMessage.message}</span>
          </div>
        </div>
      )}
      
      <div className="relative overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="w-full text-sm text-left text-gray-900 bg-white">
        <thead className="text-xs uppercase bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-900">
          <tr>
            <th 
              className="px-6 py-4 cursor-pointer hover:bg-blue-100 transition-colors"
              onClick={() => handleSort('date')}
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Sale Date
                <SortIcon field="date" />
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
              onClick={() => handleSort('address')}
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Address
                <SortIcon field="address" />
              </div>
            </th>
            <th className="px-6 py-4">City</th>
            <th className="px-6 py-4">County</th>
            <th className="px-6 py-4">Firm</th>
            <th 
              className="px-6 py-4 cursor-pointer hover:bg-blue-100 transition-colors"
              onClick={() => handleSort('distance_miles')}
            >
              <div className="flex items-center gap-2">
                Distance
                <SortIcon field="distance_miles" />
              </div>
            </th>
            <th className="px-6 py-4">Within 30min</th>
            <th className="px-6 py-4">Source</th>
            <th className="px-6 py-4">Contact Info</th>
            <th className="px-6 py-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, index) => (
            <tr 
              key={index}
              className="bg-white border-b border-gray-100 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-150"
            >
              <td className="px-6 py-4 font-medium text-gray-900">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span>{row.date}</span>
                    {row.status === 'new' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 font-medium">
                        NEW
                      </span>
                    )}
                    {row.first_seen_at && isToday(row.first_seen_at) && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 font-medium">
                        TODAY
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {(() => {
                      try {
                        const parsedDate = new Date(row.date);
                        return !isNaN(parsedDate.getTime()) 
                          ? parsedDate.toLocaleDateString('en-US', { weekday: 'short' })
                          : '';
                      } catch {
                        return '';
                      }
                    })()}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 text-gray-900">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                  {row.time || 'N/A'}
                </span>
              </td>
              <td className="px-6 py-4 max-w-xs text-gray-900" title={row.address}>
                <div className="truncate font-medium">{row.address}</div>
              </td>
              <td className="px-6 py-4 text-gray-900">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                  {row.city || 'N/A'}
                </span>
              </td>
              <td className="px-6 py-4 text-gray-900">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                    {row.county || 'N/A'}
                  </span>
                  {row.status && row.status !== 'new' && (
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                      row.status === 'updated' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {row.status}
                    </span>
                  )}
                  {row.sale_date_updated_count > 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">
                      {row.sale_date_updated_count}x updated
                    </span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 text-gray-900">
                <span className="text-sm font-medium">{row.firm || 'N/A'}</span>
              </td>
              <td className="px-6 py-4 text-gray-900">
                {row.distance_miles ? (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800">
                    {row.distance_miles} mi
                  </span>
                ) : (
                  <span className="text-gray-500">N/A</span>
                )}
              </td>
              <td className="px-6 py-4">
                <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${
                  row.within_30min === 'Y' 
                    ? 'bg-green-100 text-green-800 ring-1 ring-green-600/20' 
                    : 'bg-red-100 text-red-800 ring-1 ring-red-600/20'
                }`}>
                  {row.within_30min === 'Y' ? '✓ Yes' : '✗ No'}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800 font-medium">
                  {getSourceDisplayName(row.source)}
                </span>
              </td>
              <td className="px-6 py-4">
                {row.owner_email_1 || row.owner_phone_1 ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-xs text-green-600 font-medium">Enriched</span>
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
              <td className="px-6 py-4">
                <button
                  onClick={() => {
                    const address = encodeURIComponent(row.address + ', ' + row.city + ', TN');
                    window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank');
                  }}
                  className="inline-flex items-center px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors"
                  title="View on Google Maps"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Maps
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {sortedData.length === 0 && (
        <div className="text-center py-12 text-gray-500 bg-white">
          <div className="flex flex-col items-center gap-2">
            <MapPin className="h-12 w-12 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900">No Properties Found</h3>
            <p className="text-sm">Run scrapers to collect foreclosure data</p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function getSourceDisplayName(source: string): string {
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

function isToday(dateString: string): boolean {
  try {
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  } catch {
    return false;
  }
}