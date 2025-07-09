'use client';

import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { DataTable } from '../components/dashboard/data-table';
import { StatsCards } from '../components/dashboard/stats-cards';
import { Loader2, Play, Download, RefreshCw } from 'lucide-react';

export default function Home() {
  const [isScrapingAll, setIsScrapingAll] = useState(false);
  const [isScrapingSource, setIsScrapingSource] = useState<string | null>(null);
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
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scrapers: ['all'] })
      });
      
      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Scraping failed:', error);
    } finally {
      setIsScrapingAll(false);
    }
  };

  const runApifyScraper = async (source: string) => {
    setIsScrapingSource(source);
    try {
      const response = await fetch('/api/scrape-apify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log(`Successfully scraped ${result.recordsInserted} records from ${source}`);
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
        
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => runApifyScraper('phillipjoneslaw')}
            disabled={isScrapingSource === 'phillipjoneslaw'}
            size="lg"
          >
            {isScrapingSource === 'phillipjoneslaw' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scraping Phillip Jones Law...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run Phillip Jones Law
              </>
            )}
          </Button>
          
          <Button
            onClick={() => alert('Coming soon! This scraper is being migrated to Apify.')}
            disabled={true}
            variant="outline"
          >
            <Play className="mr-2 h-4 w-4" />
            Run ClearRecon (Soon)
          </Button>
          
          <Button
            onClick={() => alert('Coming soon! This scraper is being migrated to Apify.')}
            disabled={true}
            variant="outline"
          >
            <Play className="mr-2 h-4 w-4" />
            Run TN Ledger (Soon)
          </Button>
          
          <Button
            onClick={() => alert('Coming soon! This scraper is being migrated to Apify.')}
            disabled={true}
            variant="outline"
          >
            <Play className="mr-2 h-4 w-4" />
            Run WABI PowerBI (Soon)
          </Button>
          
          <Button
            onClick={() => alert('Coming soon! This scraper is being migrated to Apify.')}
            disabled={true}
            variant="outline"
          >
            <Play className="mr-2 h-4 w-4" />
            Run Wilson Associates (Soon)
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