'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Calendar, Filter, Download, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdvancedFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
  onExport: () => void;
  isLoading: boolean;
  totalResults: number;
}

export interface FilterState {
  dateFrom: string;
  dateTo: string;
  counties: string[];
  sources: string[];
  within30Min: boolean;
  enrichmentStatus: 'all' | 'enriched' | 'needs_enrichment';
}

const DEFAULT_FILTERS: FilterState = {
  dateFrom: '',
  dateTo: '',
  counties: [],
  sources: [],
  within30Min: false,
  enrichmentStatus: 'all'
};

// Common counties in Tennessee
const COUNTIES = [
  'Davidson',
  'Rutherford',
  'Wilson',
  'Williamson',
  'Sumner',
  'Hamilton',
  'Knox',
  'Shelby',
  'Montgomery',
  'Blount'
];

const SOURCES = [
  { value: 'clearrecon', label: 'ClearRecon' },
  { value: 'phillipjoneslaw', label: 'Phillip Jones Law' },
  { value: 'tnledger', label: 'TN Ledger' },
  { value: 'wabipowerbi', label: 'WABI PowerBI' },
  { value: 'wilsonassociates', label: 'Wilson Associates' },
  { value: 'connectedinvestors', label: 'Connected Investors' }
];

export function AdvancedFilters({ onFiltersChange, onExport, isLoading, totalResults }: AdvancedFiltersProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilters = (newFilters: Partial<FilterState>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFiltersChange(updatedFilters);
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    onFiltersChange(DEFAULT_FILTERS);
  };

  const hasActiveFilters = () => {
    return (
      filters.dateFrom ||
      filters.dateTo ||
      filters.counties.length > 0 ||
      filters.sources.length > 0 ||
      filters.within30Min ||
      filters.enrichmentStatus !== 'all'
    );
  };

  const toggleCounty = (county: string) => {
    const newCounties = filters.counties.includes(county)
      ? filters.counties.filter(c => c !== county)
      : [...filters.counties, county];
    updateFilters({ counties: newCounties });
  };

  const toggleSource = (source: string) => {
    const newSources = filters.sources.includes(source)
      ? filters.sources.filter(s => s !== source)
      : [...filters.sources, source];
    updateFilters({ sources: newSources });
  };

  // Set default date range to last 30 days
  const getDefaultDateFrom = () => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  };

  const getDefaultDateTo = () => {
    return new Date().toISOString().split('T')[0];
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Advanced Filters
              {hasActiveFilters() && (
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                  Active
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {totalResults} properties found
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Collapse' : 'Expand'} Filters
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              disabled={totalResults === 0 || isLoading}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Quick Filters - Always Visible */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex items-center space-x-2">
            <Switch
              id="within30"
              checked={filters.within30Min}
              onCheckedChange={(checked) => updateFilters({ within30Min: checked })}
            />
            <Label htmlFor="within30">Within 30 minutes</Label>
          </div>
          
          <div className="flex-1 min-w-[200px]">
            <Label>Enrichment Status</Label>
            <Select
              value={filters.enrichmentStatus}
              onValueChange={(value: 'all' | 'enriched' | 'needs_enrichment') => 
                updateFilters({ enrichmentStatus: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                <SelectItem value="enriched">Has Contact Info</SelectItem>
                <SelectItem value="needs_enrichment">Needs Skip Trace</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters() && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
            >
              <X className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>

        {/* Expanded Filters */}
        {isExpanded && (
          <div className="space-y-6 pt-4 border-t">
            {/* Date Range */}
            <div>
              <Label className="text-base font-medium">Date Range</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div>
                  <Label htmlFor="dateFrom" className="text-sm">From</Label>
                  <Input
                    id="dateFrom"
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => updateFilters({ dateFrom: e.target.value })}
                    placeholder={getDefaultDateFrom()}
                  />
                </div>
                <div>
                  <Label htmlFor="dateTo" className="text-sm">To</Label>
                  <Input
                    id="dateTo"
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => updateFilters({ dateTo: e.target.value })}
                    placeholder={getDefaultDateTo()}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateFilters({
                    dateFrom: getDefaultDateFrom(),
                    dateTo: getDefaultDateTo()
                  })}
                >
                  Last 30 Days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const date = new Date();
                    date.setDate(date.getDate() - 7);
                    updateFilters({
                      dateFrom: date.toISOString().split('T')[0],
                      dateTo: getDefaultDateTo()
                    });
                  }}
                >
                  Last 7 Days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateFilters({
                    dateFrom: new Date().toISOString().split('T')[0],
                    dateTo: getDefaultDateTo()
                  })}
                >
                  Today
                </Button>
              </div>
            </div>

            {/* Counties */}
            <div>
              <Label className="text-base font-medium">
                Counties ({filters.counties.length} selected)
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-2">
                {COUNTIES.map((county) => (
                  <div key={county} className="flex items-center space-x-2">
                    <Checkbox
                      id={`county-${county}`}
                      checked={filters.counties.includes(county)}
                      onCheckedChange={() => toggleCounty(county)}
                    />
                    <Label
                      htmlFor={`county-${county}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {county}
                    </Label>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateFilters({ counties: COUNTIES })}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateFilters({ counties: [] })}
                >
                  Clear All
                </Button>
              </div>
            </div>

            {/* Data Sources */}
            <div>
              <Label className="text-base font-medium">
                Data Sources ({filters.sources.length} selected)
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                {SOURCES.map((source) => (
                  <div key={source.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`source-${source.value}`}
                      checked={filters.sources.includes(source.value)}
                      onCheckedChange={() => toggleSource(source.value)}
                    />
                    <Label
                      htmlFor={`source-${source.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {source.label}
                    </Label>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateFilters({ sources: SOURCES.map(s => s.value) })}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateFilters({ sources: [] })}
                >
                  Clear All
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}