import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, MapPin, Calendar, Clock, Search, CheckCircle2, Loader2 } from 'lucide-react';

interface DataTableProps {
  data: any[];
}

export function DataTable({ data }: DataTableProps) {
  const [sortField, setSortField] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [skipTracingIds, setSkipTracingIds] = useState<Set<string>>(new Set());
  
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
      
      if (result.success) {
        // Update the property in the data with the new contact info
        const updatedData = data.map(item => 
          item.id === propertyId 
            ? { ...item, owner_emails: result.data.emails.join(','), owner_phones: result.data.phones.join(',') }
            : item
        );
        // You might want to trigger a data refresh here
        window.location.reload(); // Simple refresh for now
      } else {
        console.error('Skip trace failed:', result.error);
        alert('Skip trace failed. Please try again.');
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
  
  const sortedData = [...data].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;
    
    if (sortField === 'date') {
      const dateA = new Date(aValue);
      const dateB = new Date(bValue);
      return sortDirection === 'asc' 
        ? dateA.getTime() - dateB.getTime()
        : dateB.getTime() - dateA.getTime();
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
                  <span>{new Date(row.date).toLocaleDateString()}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(row.date).toLocaleDateString('en-US', { weekday: 'short' })}
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
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                  {row.county || 'N/A'}
                </span>
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
                {row.owner_emails || row.owner_phones || row.owner_email_1 || row.owner_phone_1 ? (
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