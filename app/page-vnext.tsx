'use client';

import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { DataTable } from '../components/dashboard/data-table';
import { DataTableVNext } from '../components/dashboard/data-table-vnext';
import { StatsCards } from '../components/dashboard/stats-cards';
import { StatsCardsVNext } from '../components/dashboard/stats-cards-vnext';
import { AdvancedFilters, FilterState } from '../components/dashboard/advanced-filters';
import { FeatureFlags } from '../lib/config';
import { 
  Loader2, Play, Download, RefreshCw, PlayCircle, Zap, Building, 
  FileText, Database, Users, Search, Star, Settings, Flag 
} from 'lucide-react';

export default function HomeVNext() {
  const [isScrapingAll, setIsScrapingAll] = useState(false);
  const [isScrapingSource, setIsScrapingSource] = useState<string | null>(null);
  const [completedScrapers, setCompletedScrapers] = useState<string[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [data, setData] = useState([]);
  const [availableFilters, setAvailableFilters] = useState<any>({});
  const [stats, setStats] = useState({
    total: 0,
    within30Min: 0,
    lastUpdated: '',
    sources: {}
  });
  const [filters, setFilters] = useState<FilterState>({
    dateFrom: '',
    dateTo: '',
    counties: [],
    sources: [],
    within30Min: false,
    targetCounties: ['Davidson', 'Sumner', 'Wilson'],
    maxDistanceMiles: 30,
    enrichmentStatus: 'all',
    stages: [],
    propertyTypes: [],
    priorities: [],
    eventTypes: []
  });

  const isVNext = !FeatureFlags.USE_LEGACY;
  const showScoring = FeatureFlags.VNEXT_SCORING_ENABLED;
  const showVNextFilters = FeatureFlags.USE_VNEXT_FILTERS;

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    setIsLoadingData(true);
    try {
      const params = new URLSearchParams();
      
      // Legacy filters
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.counties.length > 0) params.append('counties', filters.counties.join(','));
      if (filters.sources.length > 0) params.append('sources', filters.sources.join(','));
      if (filters.enrichmentStatus !== 'all') params.append('enrichmentStatus', filters.enrichmentStatus);
      
      // Proximity filters
      if (!showVNextFilters) {
        if (filters.within30Min) params.append('within30min', 'true');
      } else {
        if (filters.targetCounties && filters.targetCounties.length > 0) {
          params.append('targetCounties', filters.targetCounties.join(','));
        }
        if (filters.maxDistanceMiles !== undefined) {
          params.append('maxDistanceMiles', filters.maxDistanceMiles.toString());
        }
      }
      
      // vNext filters
      if (isVNext) {
        if (filters.stages && filters.stages.length > 0) {
          params.append('stages', filters.stages.join(','));
        }
        if (filters.propertyTypes && filters.propertyTypes.length > 0) {
          params.append('propertyTypes', filters.propertyTypes.join(','));
        }
        if (filters.priorities && filters.priorities.length > 0) {
          params.append('priorities', filters.priorities.join(','));
        }
        if (filters.eventTypes && filters.eventTypes.length > 0) {
          params.append('eventTypes', filters.eventTypes.join(','));
        }
        if (filters.minScore !== undefined) {
          params.append('minScore', filters.minScore.toString());
        }
        if (filters.maxScore !== undefined) {
          params.append('maxScore', filters.maxScore.toString());
        }
        if (filters.saleDateFrom) {
          params.append('saleDateFrom', filters.saleDateFrom);
        }
        if (filters.saleDateTo) {
          params.append('saleDateTo', filters.saleDateTo);
        }
        if (filters.createdDateFrom) {
          params.append('createdDateFrom', filters.createdDateFrom);
        }
        if (filters.createdDateTo) {
          params.append('createdDateTo', filters.createdDateTo);
        }
        
        // Include events and contacts for enhanced display
        params.append('includeEvents', 'true');
        params.append('includeContacts', 'true');
      }
      
      // Use the new properties API endpoint
      const response = await fetch(`/api/properties?${params.toString()}`);
      const result = await response.json();
      
      if (response.ok) {
        setData(result.properties || []);
        setAvailableFilters(result.filters?.available || {});
        
        // Update stats
        setStats({
          total: result.pagination?.total || 0,
          within30Min: result.properties?.filter((p: any) => 
            p.within_30min === 'Y' || p.within_30min_nash || p.within_30min_mtjuliet
          ).length || 0,
          lastUpdated: result.metadata?.lastUpdated || new Date().toISOString(),
          sources: result.metadata || {}
        });
      } else {
        console.error('Failed to fetch data:', result);
        // Fallback to legacy endpoint
        await fetchLegacyData();
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      // Fallback to legacy endpoint
      await fetchLegacyData();
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchLegacyData = async () => {
    try {
      const params = new URLSearchParams();
      
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.counties.length > 0) params.append('counties', filters.counties.join(','));
      if (filters.sources.length > 0) params.append('sources', filters.sources.join(','));
      if (filters.within30Min) params.append('within30min', 'true');
      if (filters.enrichmentStatus !== 'all') params.append('enrichmentStatus', filters.enrichmentStatus);
      
      const response = await fetch(`/api/data?${params.toString()}`);
      const result = await response.json();
      
      setData(result.data || []);
      setStats({
        total: result.total || 0,
        within30Min: result.within30Min || 0,
        lastUpdated: result.lastUpdated || '',
        sources: result.sources || {}
      });
    } catch (error) {
      console.error('Error fetching legacy data:', error);
    }
  };

  const exportData = async () => {
    try {
      const params = new URLSearchParams();
      
      // Add current filters to export
      Object.entries(filters).forEach(([key, value]) => {
        if (value && (typeof value !== 'object' || (Array.isArray(value) && value.length > 0))) {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else if (typeof value === 'boolean') {
            params.append(key, value.toString());
          } else {
            params.append(key, value.toString());
          }
        }
      });
      
      params.append('export', 'true');
      
      const response = await fetch(`/api/data/export?${params.toString()}`);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `foreclosure-data-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Failed to export data. Please try again.');
    }
  };

  const runScraper = async (source: string) => {
    setIsScrapingSource(source);
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source })
      });
      
      const result = await response.json();
      console.log(`${source} scraper result:`, result);
      
      if (result.success) {
        setCompletedScrapers(prev => [...prev, source]);
        await fetchData(); // Refresh data
      }
    } catch (error) {
      console.error(`Error running ${source} scraper:`, error);
    } finally {
      setIsScrapingSource(null);
    }
  };

  const runAllScrapers = async () => {
    setIsScrapingAll(true);
    setCompletedScrapers([]);
    
    const scrapers = ['clearrecon', 'phillipjoneslaw', 'tnledger', 'wabipowerbi', 'wilson'];
    
    for (const scraper of scrapers) {
      await runScraper(scraper);
    }
    
    setIsScrapingAll(false);
  };

  const ScraperCard = ({ 
    title, 
    description, 
    source, 
    icon: Icon, 
    color = "blue" 
  }: { 
    title: string;
    description: string;
    source: string;
    icon: any;
    color?: string;
  }) => {
    const isRunning = isScrapingSource === source;
    const isCompleted = completedScrapers.includes(source);
    
    return (
      <Card className={`transition-all duration-200 hover:shadow-md ${
        isCompleted ? 'ring-2 ring-green-500 bg-green-50' : ''
      }`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Icon className={`h-5 w-5 text-${color}-600`} />
            {title}
            {isCompleted && <div className="w-2 h-2 bg-green-500 rounded-full ml-auto"></div>}
          </CardTitle>
          <CardDescription className="text-sm">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => runScraper(source)}
            disabled={isScrapingAll || isRunning}
            className="w-full"
            variant={isCompleted ? "outline" : "default"}
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : isCompleted ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Run Again
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run Scraper
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header with Feature Flag Indicator */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Foreclosure Dashboard</h1>
          <p className="text-gray-600">Manage property data and skip trace operations</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Feature Flag Indicators */}
          <div className="flex items-center gap-2 text-xs">
            <Flag className="h-3 w-3" />
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              isVNext ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
            }`}>
              {isVNext ? 'vNext Mode' : 'Legacy Mode'}
            </span>
            {showScoring && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                <Star className="h-3 w-3 inline mr-1" />
                Scoring
              </span>
            )}
            {showVNextFilters && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Dual-Hub
              </span>
            )}
          </div>
          <Button 
            onClick={fetchData} 
            disabled={isLoadingData}
            variant="outline"
            size="sm"
          >
            {isLoadingData ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {isVNext ? (
        <StatsCardsVNext data={data} />
      ) : (
        <StatsCards stats={{ total: data.length, within30Min: 0, lastUpdated: new Date().toISOString(), sources: {} }} />
      )}

      {/* Scraper Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-600" />
                Data Collection
              </CardTitle>
              <CardDescription>
                Run individual scrapers or bulk collection from all sources
              </CardDescription>
            </div>
            <Button 
              onClick={runAllScrapers}
              disabled={isScrapingAll}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {isScrapingAll ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Running All Scrapers...
                </>
              ) : (
                <>
                  <PlayCircle className="mr-2 h-5 w-5" />
                  Run All Scrapers
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <ScraperCard
              title="ClearRecon"
              description="Nashville Metro foreclosure listings"
              source="clearrecon"
              icon={Building}
              color="blue"
            />
            <ScraperCard
              title="Phillip Jones Law"
              description="Legal foreclosure notices"
              source="phillipjoneslaw"
              icon={FileText}
              color="green"
            />
            <ScraperCard
              title="TN Ledger"
              description="Public foreclosure announcements"
              source="tnledger"
              icon={Database}
              color="purple"
            />
            <ScraperCard
              title="WABI PowerBI"
              description="Wilson County foreclosure data"
              source="wabipowerbi"
              icon={Users}
              color="orange"
            />
            <ScraperCard
              title="Wilson Associates"
              description="Auction and foreclosure listings"
              source="wilson"
              icon={Search}
              color="red"
            />
          </div>
        </CardContent>
      </Card>

      {/* Advanced Filters */}
      <AdvancedFilters
        onFiltersChange={setFilters}
        onExport={exportData}
        isLoading={isLoadingData}
        totalResults={stats.total}
        availableFilters={availableFilters}
      />

      {/* Data Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600" />
                Property Data
                {showScoring && (
                  <span className="text-sm font-normal text-gray-500">
                    (with scoring)
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                {isLoadingData 
                  ? 'Loading property data...' 
                  : `${stats.total} properties found`
                }
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading data...</span>
            </div>
          ) : isVNext ? (
            <DataTableVNext data={data} />
          ) : (
            <DataTable data={data} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}