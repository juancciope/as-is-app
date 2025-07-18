'use client';

import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Calendar, Filter, Download, RefreshCw, X, Star, MapPin } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ClientFeatureFlags } from '../../lib/client-config';

interface AdvancedFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
  onExport: () => void;
  isLoading: boolean;
  totalResults: number;
  availableFilters?: {
    counties: string[];
    sources: string[];
    stages: string[];
    priorities: string[];
    eventTypes: string[];
  };
}

export interface FilterState {
  dateFrom: string;
  dateTo: string;
  counties: string[];
  sources: string[];
  within30Min: boolean;
  // vNext proximity filters
  targetCounties?: string[];
  maxDistanceMiles?: number;
  enrichmentStatus: 'all' | 'enriched' | 'needs_enrichment';
  // Date filters
  saleDateFrom?: string;
  saleDateTo?: string;
  createdDateFrom?: string;
  createdDateTo?: string;
  // vNext filters
  stages?: string[];
  propertyTypes?: string[];
  minScore?: number;
  maxScore?: number;
  priorities?: string[];
  eventTypes?: string[];
}

const DEFAULT_FILTERS: FilterState = {
  dateFrom: '',
  dateTo: '',
  counties: [],
  sources: [],
  within30Min: false,
  targetCounties: ['Davidson', 'Sumner', 'Wilson'], // Default to main counties
  maxDistanceMiles: 30, // Default to 30 miles
  enrichmentStatus: 'all',
  stages: [],
  propertyTypes: [],
  priorities: [],
  eventTypes: []
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

// vNext specific options
const PROPERTY_TYPES = [
  { value: 'SFR', label: 'Single Family Residence' },
  { value: 'Condo', label: 'Condominium' },
  { value: 'Townhome', label: 'Townhome' },
  { value: 'Multi-Family', label: 'Multi-Family' },
  { value: 'Commercial', label: 'Commercial' },
  { value: 'Land', label: 'Land' }
];

const PIPELINE_STAGES = [
  { value: 'new', label: 'New Lead' },
  { value: 'researching', label: 'Researching' },
  { value: 'contacting', label: 'Contacting Owner' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'under_contract', label: 'Under Contract' },
  { value: 'closed', label: 'Closed' },
  { value: 'rejected', label: 'Rejected' }
];

const PRIORITIES = [
  { value: 'urgent', label: 'Urgent (76-100)' },
  { value: 'high', label: 'High (51-75)' },
  { value: 'medium', label: 'Medium (26-50)' },
  { value: 'low', label: 'Low (0-25)' }
];

const EVENT_TYPES = [
  { value: 'FORECLOSURE', label: 'Foreclosure' },
  { value: 'TAX_LIEN', label: 'Tax Lien' },
  { value: 'CODE_VIOLATION', label: 'Code Violation' },
  { value: 'PROBATE', label: 'Probate' },
  { value: 'BANKRUPTCY', label: 'Bankruptcy' }
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
      (filters.targetCounties && filters.targetCounties.length > 0 && filters.targetCounties.length !== 3) ||
      (filters.maxDistanceMiles !== undefined && filters.maxDistanceMiles !== 30) ||
      filters.enrichmentStatus !== 'all' ||
      (filters.stages && filters.stages.length > 0) ||
      (filters.propertyTypes && filters.propertyTypes.length > 0) ||
      (filters.priorities && filters.priorities.length > 0) ||
      (filters.eventTypes && filters.eventTypes.length > 0) ||
      filters.minScore !== undefined ||
      filters.maxScore !== undefined
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

  const toggleArrayFilter = (filterKey: keyof FilterState, value: string) => {
    const currentArray = (filters[filterKey] as string[]) || [];
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value];
    updateFilters({ [filterKey]: newArray });
  };

  // Check if we should show vNext features
  const showVNextFeatures = ClientFeatureFlags.USE_VNEXT_FILTERS;

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
          {/* Proximity Filters */}
          {!showVNextFeatures ? (
            <div className="flex items-center space-x-2">
              <Switch
                id="within30"
                checked={filters.within30Min}
                onCheckedChange={(checked) => updateFilters({ within30Min: checked })}
              />
              <Label htmlFor="within30">Within 30 minutes</Label>
            </div>
          ) : (
            <div className="flex gap-4">
              <div className="flex-1 min-w-[300px]">
                <Label className="flex items-center gap-1 mb-2">
                  <MapPin className="h-3 w-3" />
                  Target Counties & Distance
                </Label>
                <div className="flex gap-2">
                  <div className="flex gap-2">
                    {['Davidson', 'Sumner', 'Wilson'].map((county) => (
                      <label key={county} className="flex items-center gap-1">
                        <Checkbox
                          checked={filters.targetCounties?.includes(county) || false}
                          onCheckedChange={(checked) => {
                            const current = filters.targetCounties || [];
                            if (checked) {
                              updateFilters({ targetCounties: [...current, county] });
                            } else {
                              updateFilters({ targetCounties: current.filter(c => c !== county) });
                            }
                          }}
                        />
                        <span className="text-sm">{county}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={filters.maxDistanceMiles || 30}
                      onChange={(e) => updateFilters({ maxDistanceMiles: parseInt(e.target.value) })}
                      className="w-24"
                    />
                    <span className="text-sm font-medium">{filters.maxDistanceMiles || 30} mi</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
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

          {/* vNext Priority Filter */}
          {showVNextFeatures && ClientFeatureFlags.VNEXT_SCORING_ENABLED && (
            <div className="flex-1 min-w-[200px]">
              <Label className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                Priority Level
              </Label>
              <Select
                value={filters.priorities?.[0] || 'all'}
                onValueChange={(value) => 
                  updateFilters({ priorities: value === 'all' ? [] : [value] })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  {PRIORITIES.map((priority) => (
                    <SelectItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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

            {/* Sale Date Range */}
            {showVNextFeatures && (
              <div>
                <Label className="text-base font-medium">Sale Date Range</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div>
                    <Label htmlFor="saleDateFrom" className="text-sm">From</Label>
                    <Input
                      id="saleDateFrom"
                      type="date"
                      value={filters.saleDateFrom || ''}
                      onChange={(e) => updateFilters({ saleDateFrom: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="saleDateTo" className="text-sm">To</Label>
                    <Input
                      id="saleDateTo"
                      type="date"
                      value={filters.saleDateTo || ''}
                      onChange={(e) => updateFilters({ saleDateTo: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Created Date Range */}
            {showVNextFeatures && (
              <div>
                <Label className="text-base font-medium">Property Added Date</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div>
                    <Label htmlFor="createdDateFrom" className="text-sm">From</Label>
                    <Input
                      id="createdDateFrom"
                      type="date"
                      value={filters.createdDateFrom || ''}
                      onChange={(e) => updateFilters({ createdDateFrom: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="createdDateTo" className="text-sm">To</Label>
                    <Input
                      id="createdDateTo"
                      type="date"
                      value={filters.createdDateTo || ''}
                      onChange={(e) => updateFilters({ createdDateTo: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      updateFilters({
                        createdDateFrom: today.toISOString().split('T')[0],
                        createdDateTo: today.toISOString().split('T')[0]
                      });
                    }}
                  >
                    Today's New
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const date = new Date();
                      date.setDate(date.getDate() - 7);
                      updateFilters({
                        createdDateFrom: date.toISOString().split('T')[0],
                        createdDateTo: new Date().toISOString().split('T')[0]
                      });
                    }}
                  >
                    Last 7 Days
                  </Button>
                </div>
              </div>
            )}

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

            {/* vNext Advanced Filters */}
            {showVNextFeatures && (
              <>
                {/* Property Types */}
                <div>
                  <Label className="text-base font-medium">
                    Property Types ({(filters.propertyTypes || []).length} selected)
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                    {PROPERTY_TYPES.map((type) => (
                      <div key={type.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`type-${type.value}`}
                          checked={(filters.propertyTypes || []).includes(type.value)}
                          onCheckedChange={() => toggleArrayFilter('propertyTypes', type.value)}
                        />
                        <Label
                          htmlFor={`type-${type.value}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {type.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pipeline Stages */}
                <div>
                  <Label className="text-base font-medium">
                    Pipeline Stages ({(filters.stages || []).length} selected)
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                    {PIPELINE_STAGES.map((stage) => (
                      <div key={stage.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`stage-${stage.value}`}
                          checked={(filters.stages || []).includes(stage.value)}
                          onCheckedChange={() => toggleArrayFilter('stages', stage.value)}
                        />
                        <Label
                          htmlFor={`stage-${stage.value}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {stage.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Event Types */}
                <div>
                  <Label className="text-base font-medium">
                    Event Types ({(filters.eventTypes || []).length} selected)
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                    {EVENT_TYPES.map((eventType) => (
                      <div key={eventType.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`event-${eventType.value}`}
                          checked={(filters.eventTypes || []).includes(eventType.value)}
                          onCheckedChange={() => toggleArrayFilter('eventTypes', eventType.value)}
                        />
                        <Label
                          htmlFor={`event-${eventType.value}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {eventType.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Score Range (only if scoring is enabled) */}
                {ClientFeatureFlags.VNEXT_SCORING_ENABLED && (
                  <div>
                    <Label className="text-base font-medium flex items-center gap-1">
                      <Star className="h-4 w-4" />
                      Score Range
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div>
                        <Label htmlFor="minScore" className="text-sm">Minimum Score</Label>
                        <Input
                          id="minScore"
                          type="number"
                          min="0"
                          max="100"
                          value={filters.minScore || ''}
                          onChange={(e) => updateFilters({ 
                            minScore: e.target.value ? parseInt(e.target.value) : undefined 
                          })}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="maxScore" className="text-sm">Maximum Score</Label>
                        <Input
                          id="maxScore"
                          type="number"
                          min="0"
                          max="100"
                          value={filters.maxScore || ''}
                          onChange={(e) => updateFilters({ 
                            maxScore: e.target.value ? parseInt(e.target.value) : undefined 
                          })}
                          placeholder="100"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateFilters({ minScore: 76, maxScore: 100 })}
                      >
                        Urgent (76-100)
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateFilters({ minScore: 51, maxScore: 75 })}
                      >
                        High (51-75)
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateFilters({ minScore: 26, maxScore: 50 })}
                      >
                        Medium (26-50)
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}