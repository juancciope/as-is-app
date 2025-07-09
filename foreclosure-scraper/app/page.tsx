'use client';

import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { DataTable } from '../components/dashboard/data-table';
import { StatsCards } from '../components/dashboard/stats-cards';
import { Loader2, Play, Download, RefreshCw, PlayCircle, Zap, Building, FileText, Database, Users } from 'lucide-react';

export default function Home() {
  const [isScrapingAll, setIsScrapingAll] = useState(false);
  const [isScrapingSource, setIsScrapingSource] = useState<string | null>(null);
  const [completedScrapers, setCompletedScrapers] = useState<string[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [data, setData] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    within30Min: 0,
    lastUpdated: '',
    sources: {}
  });
  const [filters, setFilters] = useState({
    within30Min: false,
    source: 'all',
    dateRange: 'all'
  });

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    setIsLoadingData(true);
    try {
      const params = new URLSearchParams();
      if (filters.within30Min) params.append('within30min', 'true');
      if (filters.source !== 'all') params.append('source', filters.source);
      
      const response = await fetch(`/api/data?${params}`);
      const result = await response.json();
      
      if (result.data) {
        setData(result.data);
        updateStats(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const updateStats = (data: any[]) => {
    const within30 = data.filter(item => item.within_30min === 'Y').length;
    const sourceCount = data.reduce((acc, item) => {
      acc[item.source] = (acc[item.source] || 0) + 1;
      return acc;
    }, {});
    
    setStats({
      total: data.length,
      within30Min: within30,
      lastUpdated: new Date().toISOString(),
      sources: sourceCount
    });
  };

  const runAllScrapers = async () => {
    setIsScrapingAll(true);
    setCompletedScrapers([]);
    
    const scrapers = ['phillipjoneslaw', 'clearrecon', 'tnledger', 'wabipowerbi', 'wilsonassociates'];
    
    for (const scraper of scrapers) {
      try {
        setIsScrapingSource(scraper);
        const response = await fetch('/api/scrape-apify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: scraper })
        });
        
        const result = await response.json();
        
        if (response.ok) {
          console.log(`Successfully scraped ${result.recordsInserted} records from ${scraper}`);
          setCompletedScrapers(prev => [...prev, scraper]);
        } else {
          console.error(`Failed to scrape ${scraper}:`, result.error);
        }
      } catch (error) {
        console.error(`Scraping ${scraper} failed:`, error);
      }
    }
    
    setIsScrapingSource(null);
    setIsScrapingAll(false);
    await fetchData();
  };

  const runApifyScraper = async (source: string) => {
    setIsScrapingSource(source);
    setCompletedScrapers(prev => prev.filter(s => s !== source));
    
    try {
      const response = await fetch('/api/scrape-apify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log(`Successfully scraped ${result.recordsInserted} records from ${source}`);
        setCompletedScrapers(prev => [...prev, source]);
        await fetchData();
      } else {
        console.error(`Failed to scrape ${source}:`, result.error);
      }
    } catch (error) {
      console.error(`Scraping ${source} failed:`, error);
    } finally {
      setIsScrapingSource(null);
    }
  };

  const exportData = () => {
    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `foreclosure-data-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Foreclosure Data Dashboard</h1>
          <p className="text-muted-foreground">Monitor and analyze foreclosure auction data</p>
        </div>
        
        <div className="flex gap-3">
          <Button
            onClick={runAllScrapers}
            disabled={isScrapingAll || isScrapingSource !== null}
            size="lg"
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {isScrapingAll ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Running All Scrapers...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-5 w-5" />
                Run All Scrapers
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            onClick={exportData}
            disabled={data.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <StatsCards stats={stats} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5" />
            Data Sources
          </CardTitle>
          <CardDescription>
            Run individual scrapers or all at once
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ScraperButton
              id="phillipjoneslaw"
              name="Phillip Jones Law"
              description="Legal foreclosure notices"
              icon={<Building className="h-4 w-4" />}
              isActive={isScrapingSource === 'phillipjoneslaw'}
              isCompleted={completedScrapers.includes('phillipjoneslaw')}
              onClick={() => runApifyScraper('phillipjoneslaw')}
              disabled={isScrapingAll || (isScrapingSource !== null && isScrapingSource !== 'phillipjoneslaw')}
            />
            
            <ScraperButton
              id="clearrecon"
              name="ClearRecon"
              description="Real estate auctions"
              icon={<Database className="h-4 w-4" />}
              isActive={isScrapingSource === 'clearrecon'}
              isCompleted={completedScrapers.includes('clearrecon')}
              onClick={() => runApifyScraper('clearrecon')}
              disabled={isScrapingAll || (isScrapingSource !== null && isScrapingSource !== 'clearrecon')}
            />
            
            <ScraperButton
              id="tnledger"
              name="TN Ledger"
              description="Tennessee public notices"
              icon={<FileText className="h-4 w-4" />}
              isActive={isScrapingSource === 'tnledger'}
              isCompleted={completedScrapers.includes('tnledger')}
              onClick={() => runApifyScraper('tnledger')}
              disabled={isScrapingAll || (isScrapingSource !== null && isScrapingSource !== 'tnledger')}
            />
            
            <ScraperButton
              id="wabipowerbi"
              name="WABI PowerBI"
              description="PowerBI dashboard data"
              icon={<Database className="h-4 w-4" />}
              isActive={isScrapingSource === 'wabipowerbi'}
              isCompleted={completedScrapers.includes('wabipowerbi')}
              onClick={() => runApifyScraper('wabipowerbi')}
              disabled={isScrapingAll || (isScrapingSource !== null && isScrapingSource !== 'wabipowerbi')}
            />
            
            <ScraperButton
              id="wilsonassociates"
              name="Wilson Associates"
              description="Auction house listings"
              icon={<Users className="h-4 w-4" />}
              isActive={isScrapingSource === 'wilsonassociates'}
              isCompleted={completedScrapers.includes('wilsonassociates')}
              onClick={() => runApifyScraper('wilsonassociates')}
              disabled={isScrapingAll || (isScrapingSource !== null && isScrapingSource !== 'wilsonassociates')}
            />
          </div>
          
          {isScrapingAll && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="font-medium">Running All Scrapers</span>
              </div>
              <div className="mt-2 text-sm text-blue-600">
                {isScrapingSource && (
                  <span>Currently running: {getScraperDisplayName(isScrapingSource)}</span>
                )}
              </div>
              <div className="mt-2 flex gap-2">
                {['phillipjoneslaw', 'clearrecon', 'tnledger', 'wabipowerbi', 'wilsonassociates'].map(scraper => (
                  <div key={scraper} className={`text-xs px-2 py-1 rounded ${
                    completedScrapers.includes(scraper) 
                      ? 'bg-green-100 text-green-700' 
                      : isScrapingSource === scraper 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {getScraperDisplayName(scraper)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Refine your search results</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex items-center space-x-2">
              <Switch
                id="within30"
                checked={filters.within30Min}
                onCheckedChange={(checked) => 
                  setFilters({ ...filters, within30Min: checked })
                }
              />
              <Label htmlFor="within30">Within 30 minutes</Label>
            </div>
            
            <div className="flex-1">
              <Label>Data Source</Label>
              <Select
                value={filters.source}
                onValueChange={(value) => 
                  setFilters({ ...filters, source: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="clearrecon">ClearRecon</SelectItem>
                  <SelectItem value="phillipjoneslaw">Phillip Jones Law</SelectItem>
                  <SelectItem value="tnledger">TN Ledger</SelectItem>
                  <SelectItem value="wabipowerbi">WABI PowerBI</SelectItem>
                  <SelectItem value="wilson">Wilson Associates</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button
              variant="outline"
              onClick={fetchData}
              disabled={isLoadingData}
            >
              {isLoadingData ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Property Listings</CardTitle>
          <CardDescription>
            {data.length} properties found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingData ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <DataTable data={data} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface ScraperButtonProps {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  isActive: boolean;
  isCompleted: boolean;
  onClick: () => void;
  disabled: boolean;
}

function ScraperButton({ id, name, description, icon, isActive, isCompleted, onClick, disabled }: ScraperButtonProps) {
  return (
    <Card className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
      isActive ? 'ring-2 ring-blue-500 bg-blue-50' : 
      isCompleted ? 'ring-2 ring-green-500 bg-green-50' : 
      'hover:bg-gray-50'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              isActive ? 'bg-blue-100 text-blue-600' : 
              isCompleted ? 'bg-green-100 text-green-600' : 
              'bg-gray-100 text-gray-600'
            }`}>
              {icon}
            </div>
            <div>
              <h3 className="font-medium text-sm">{name}</h3>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          
          <Button
            onClick={onClick}
            disabled={disabled}
            size="sm"
            variant={isActive ? 'default' : isCompleted ? 'secondary' : 'outline'}
          >
            {isActive ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isCompleted ? (
              'Completed'
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function getScraperDisplayName(scraper: string): string {
  const names: Record<string, string> = {
    'phillipjoneslaw': 'Phillip Jones Law',
    'clearrecon': 'ClearRecon',
    'tnledger': 'TN Ledger',
    'wabipowerbi': 'WABI PowerBI',
    'wilsonassociates': 'Wilson Associates'
  };
  return names[scraper] || scraper;
}