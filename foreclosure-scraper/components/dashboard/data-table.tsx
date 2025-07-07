import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface DataTableProps {
  data: any[];
}

export function DataTable({ data }: DataTableProps) {
  const [sortField, setSortField] = useState<string>('DATE');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  const sortedData = [...data].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;
    
    if (sortField === 'DATE') {
      const dateA = new Date(aValue);
      const dateB = new Date(bValue);
      return sortDirection === 'asc' 
        ? dateA.getTime() - dateB.getTime()
        : dateB.getTime() - dateA.getTime();
    }
    
    if (sortField === 'DISTANCE_MILES' || sortField === 'EST_DRIVE_TIME') {
      const numA = parseFloat(aValue) || 0;
      const numB = parseFloat(bValue) || 0;
      return sortDirection === 'asc' ? numA - numB : numB - numA;
    }
    
    const comparison = String(aValue).localeCompare(String(bValue));
    return sortDirection === 'asc' ? comparison : -comparison;
  });
  
  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) {
      return <ChevronDown className="h-4 w-4 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="h-4 w-4" />
      : <ChevronDown className="h-4 w-4" />;
  };
  
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-800">
          <tr>
            <th 
              className="px-6 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => handleSort('DATE')}
            >
              <div className="flex items-center gap-1">
                Sale Date
                <SortIcon field="DATE" />
              </div>
            </th>
            <th className="px-6 py-3">Time</th>
            <th 
              className="px-6 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => handleSort('ADDRESS')}
            >
              <div className="flex items-center gap-1">
                Address
                <SortIcon field="ADDRESS" />
              </div>
            </th>
            <th className="px-6 py-3">City</th>
            <th className="px-6 py-3">County</th>
            <th 
              className="px-6 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => handleSort('DISTANCE_MILES')}
            >
              <div className="flex items-center gap-1">
                Distance
                <SortIcon field="DISTANCE_MILES" />
              </div>
            </th>
            <th className="px-6 py-3">Within 30min</th>
            <th className="px-6 py-3">Source</th>
            <th className="px-6 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, index) => (
            <tr 
              key={index}
              className="bg-white border-b dark:bg-gray-900 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <td className="px-6 py-4 font-medium">
                {new Date(row.DATE).toLocaleDateString()}
              </td>
              <td className="px-6 py-4">{row.TIME || 'N/A'}</td>
              <td className="px-6 py-4 max-w-xs truncate" title={row.ADDRESS}>
                {row.ADDRESS}
              </td>
              <td className="px-6 py-4">{row.CTY || 'N/A'}</td>
              <td className="px-6 py-4">{row.PL || 'N/A'}</td>
              <td className="px-6 py-4">
                {row.DISTANCE_MILES ? `${row.DISTANCE_MILES} mi` : 'N/A'}
              </td>
              <td className="px-6 py-4">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  row.WITHIN_30MIN === 'Y' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {row.WITHIN_30MIN === 'Y' ? 'Yes' : 'No'}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className="text-xs text-gray-500">{row.SOURCE}</span>
              </td>
              <td className="px-6 py-4">
                <button
                  onClick={() => {
                    const address = encodeURIComponent(row.ADDRESS + ', ' + row.CTY + ', TN');
                    window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank');
                  }}
                  className="text-blue-600 hover:text-blue-900 dark:text-blue-400"
                  title="View on Google Maps"
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {sortedData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No data available. Run scrapers to collect data.
        </div>
      )}
    </div>
  );
}