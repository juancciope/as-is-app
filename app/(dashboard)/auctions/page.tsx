'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/dashboard/data-table';
import { ContactsTable } from '@/components/dashboard/contacts-table';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { AdvancedFilters, FilterState } from '@/components/dashboard/advanced-filters';
import { Loader2, Play, Download, RefreshCw, PlayCircle, Zap, Building, FileText, Database, Users, Search, UserCheck, Table, Gavel } from 'lucide-react';

export default function AuctionsPage() {
  
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect based on authentication status
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
        return;
      }
    }
  }, [user, loading, router]);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#04325E] mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render dashboard if not authenticated
  if (!user) {
    return null;
  }
  
  // Add error state for better debugging
  const [error, setError] = useState<string | null>(null);
  const [isScrapingAll, setIsScrapingAll] = useState(false);
  const [isScrapingSource, setIsScrapingSource] = useState<string | null>(null);
  const [completedScrapers, setCompletedScrapers] = useState<string[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'properties' | 'contacts'>('properties');
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
    targetCounties: [],
    maxDistanceMiles: 30,
    enrichmentStatus: 'all',
    saleDateFrom: '',
    saleDateTo: '',
    createdDateFrom: '',
    createdDateTo: '',
    stages: [],
    propertyTypes: [],
    priorities: [],
    eventTypes: []
  });

  useEffect(() => {
    fetchData();
    if (activeTab === 'contacts') {
      fetchContacts();
    }
  }, [filters]);

  useEffect(() => {
    if (activeTab === 'contacts') {
      fetchContacts();
    }
  }, [activeTab]);

  const fetchData = async () => {
    setIsLoadingData(true);
    setError(null); // Clear any previous errors
    try {
      const queryParams = new URLSearchParams();
      
      // Add filters to query
      if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
      if (filters.counties.length > 0) queryParams.append('counties', filters.counties.join(','));
      if (filters.sources.length > 0) queryParams.append('sources', filters.sources.join(','));
      if (filters.within30Min) queryParams.append('within30Min', 'true');
      if (filters.targetCounties && filters.targetCounties.length > 0) queryParams.append('targetCounties', filters.targetCounties.join(','));
      if (filters.maxDistanceMiles !== undefined && filters.maxDistanceMiles !== 30) queryParams.append('maxDistanceMiles', filters.maxDistanceMiles.toString());
      if (filters.enrichmentStatus !== 'all') queryParams.append('enrichmentStatus', filters.enrichmentStatus);
      if (filters.saleDateFrom) queryParams.append('saleDateFrom', filters.saleDateFrom);
      if (filters.saleDateTo) queryParams.append('saleDateTo', filters.saleDateTo);
      if (filters.createdDateFrom) queryParams.append('createdDateFrom', filters.createdDateFrom);
      if (filters.createdDateTo) queryParams.append('createdDateTo', filters.createdDateTo);
      if (filters.stages && filters.stages.length > 0) queryParams.append('stages', filters.stages.join(','));
      if (filters.propertyTypes && filters.propertyTypes.length > 0) queryParams.append('propertyTypes', filters.propertyTypes.join(','));
      if (filters.priorities && filters.priorities.length > 0) queryParams.append('priorities', filters.priorities.join(','));
      if (filters.eventTypes && filters.eventTypes.length > 0) queryParams.append('eventTypes', filters.eventTypes.join(','));

      const response = await fetch(`/api/data?${queryParams.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch data');
      }
      
      const result = await response.json();
      
      setData(result.data || []);
      updateStats(result.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      setData([]);
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchContacts = async () => {
    if (!data.length) return;
    
    setIsLoadingContacts(true);
    try {
      // Create query string with property IDs from current data
      const propertyIds = data.map(item => item.id).filter(Boolean);
      if (propertyIds.length === 0) {
        setContacts([]);
        return;
      }

      const queryParams = new URLSearchParams();
      queryParams.append('propertyIds', propertyIds.join(','));

      const response = await fetch(`/api/contacts?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch contacts');
      }
      
      const result = await response.json();
      setContacts(result.contacts || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      setContacts([]);
    } finally {
      setIsLoadingContacts(false);
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
    
    const scrapers = ['phillipjoneslaw', 'clearrecon', 'tnledger', 'wabipowerbi', 'wilsonassociates', 'connectedinvestors'];
    
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
          setCompletedScrapers(prev => [...prev, scraper]);
        }
      } catch (error) {
        // Silently handle scraper errors
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
        setCompletedScrapers(prev => [...prev, source]);
        await fetchData();
      }
    } catch (error) {
      // Silently handle scraper errors
    } finally {
      setIsScrapingSource(null);
    }
  };

  const exportData = () => {
    if (!data || data.length === 0) {
      alert('No data to export');
      return;
    }

    // Create CSV with specific columns: DATE, TIME, PL, FIRM, ADDRESS, CTY
    const headers = ['DATE', 'TIME', 'PL', 'FIRM', 'ADDRESS', 'CTY'];
    
    const csvRows = [
      headers.join(','),
      ...data.map(row => {
        // Extract required fields and format them
        const date = row.date || '';
        const time = row.time || '';
        const pl = row.county ? row.county.charAt(0).toUpperCase() : ''; // First letter of county
        const firm = row.firm || '';
        const address = row.address || '';
        const cty = row.city || '';
        
        // Escape commas and quotes in CSV data
        const escapeCSV = (value: any): string => {
          if (typeof value !== 'string') value = String(value);
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return '"' + value.replace(/"/g, '""') + '"';
          }
          return value;
        };
        
        return [
          escapeCSV(date),
          escapeCSV(time),
          escapeCSV(pl),
          escapeCSV(firm),
          escapeCSV(address),
          escapeCSV(cty)
        ].join(',');
      })
    ].join('\n');
    
    const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auction-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const exportContacts = () => {
    if (contacts.length === 0) {
      alert('No contacts available to export');
      return;
    }

    // Helper function to escape CSV values
    const escapeCSV = (value: any): string => {
      if (typeof value !== 'string') value = String(value);
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return '"' + value.replace(/"/g, '""') + '"';
      }
      return value;
    };

    // Create CSV headers for contact and property information
    const headers = [
      'Contact Name',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Contact Address',
      'Contact City',
      'Contact State',
      'Contact ZIP',
      'Property Address',
      'Property City',
      'Property County',
      'Property State',
      'Property ZIP',
      'Sale Date',
      'Firm',
      'Source',
      'Created Date',
      'Last Updated'
    ];

    const csvRows = [
      headers.join(','),
      ...contacts.map(contact => {
        // Parse phones and emails if they're JSON strings
        let phones = [];
        let emails = [];
        
        try {
          phones = typeof contact.phones === 'string' 
            ? JSON.parse(contact.phones) 
            : contact.phones || [];
        } catch (e) {
          phones = [];
        }
        
        try {
          emails = typeof contact.emails === 'string' 
            ? JSON.parse(contact.emails) 
            : contact.emails || [];
        } catch (e) {
          emails = [];
        }

        // Get primary phone and email
        const primaryPhone = phones.length > 0 ? phones[0].number || phones[0] : '';
        const primaryEmail = emails.length > 0 ? emails[0].email || emails[0] : '';

        return [
          escapeCSV(contact.full_name || ''),
          escapeCSV(contact.name_first || ''),
          escapeCSV(contact.name_last || ''),
          escapeCSV(primaryEmail),
          escapeCSV(primaryPhone),
          escapeCSV(contact.mailing_address || ''),
          escapeCSV(contact.contact_city || ''),
          escapeCSV(contact.contact_state || ''),
          escapeCSV(contact.contact_zip || ''),
          escapeCSV(contact.property_address || ''),
          escapeCSV(contact.property_city || ''),
          escapeCSV(contact.property_county || ''),
          escapeCSV(contact.property_state || ''),
          escapeCSV(contact.property_zip || ''),
          escapeCSV(contact.sale_date || ''),
          escapeCSV(contact.firm || ''),
          escapeCSV(contact.source || ''),
          escapeCSV(contact.created_at || ''),
          escapeCSV(contact.updated_at || '')
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auction-contacts-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="h-[calc(100dvh-4rem)] bg-white flex flex-col overflow-hidden">
      <div className="flex-shrink-0 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Gavel className="h-8 w-8 mr-3 text-[#04325E]" />
            Auctions
          </h1>
          <p className="text-gray-600 mt-1">
            Property auctions, foreclosures, and estate sales data with scraping and contact management
          </p>
        </div>
        
        <div className="flex gap-4 mt-4 sm:mt-0">
          <Button 
            onClick={exportData}
            variant="outline"
            disabled={data.length === 0}
            className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
          >
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
          
          <Button 
            onClick={fetchData}
            variant="outline"
            disabled={isLoadingData}
            className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
          >
            {isLoadingData ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          
          <Button 
            onClick={runAllScrapers}
            disabled={isScrapingAll || isScrapingSource !== null}
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
          
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Error loading data:</h3>
          <p className="text-red-700 text-sm mt-1">{error}</p>
          <button 
            onClick={fetchData}
            className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      <StatsCards stats={stats} />


      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5" />
            Data Sources
          </CardTitle>
          <CardDescription>
            Run individual scrapers or all at once to collect auction and foreclosure data
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
            
            <ScraperButton
              id="connectedinvestors"
              name="Connected Investors"
              description="Investment properties & skip trace"
              icon={<Search className="h-4 w-4" />}
              isActive={isScrapingSource === 'connectedinvestors'}
              isCompleted={completedScrapers.includes('connectedinvestors')}
              onClick={() => runApifyScraper('connectedinvestors')}
              disabled={isScrapingAll || (isScrapingSource !== null && isScrapingSource !== 'connectedinvestors')}
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
                {['phillipjoneslaw', 'clearrecon', 'tnledger', 'wabipowerbi', 'wilsonassociates', 'connectedinvestors'].map(scraper => (
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

      <AdvancedFilters
        onFiltersChange={setFilters}
        onExport={exportData}
        isLoading={isLoadingData}
        totalResults={data.length}
      />
      </div>

      {/* Data Table Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {activeTab === 'properties' ? (
                  <>
                    <Table className="h-5 w-5" />
                    Property Listings
                  </>
                ) : (
                  <>
                    <UserCheck className="h-5 w-5" />
                    Contact Information
                  </>
                )}
              </CardTitle>
              <CardDescription>
                {activeTab === 'properties' 
                  ? `${data.length} properties found`
                  : `${contacts.length} contacts from filtered properties`
                }
              </CardDescription>
            </div>
            
            {/* Tab Buttons */}
            <div className="flex gap-2">
              <Button
                variant={activeTab === 'properties' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('properties')}
                className="flex items-center gap-2"
              >
                <Table className="h-4 w-4" />
                Properties ({data.length})
              </Button>
              <Button
                variant={activeTab === 'contacts' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('contacts')}
                className="flex items-center gap-2"
              >
                <UserCheck className="h-4 w-4" />
                Contacts ({contacts.length})
              </Button>
              {activeTab === 'contacts' && contacts.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportContacts}
                  className="flex items-center gap-2 bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                >
                  <Download className="h-4 w-4" />
                  Export Contacts
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[60vh] overflow-auto">
            {activeTab === 'properties' ? (
              isLoadingData ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <DataTable data={data} onDataUpdate={fetchData} />
              )
            ) : (
              isLoadingContacts ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <ContactsTable contacts={contacts} />
              )
            )}
          </div>
        </CardContent>
      </Card>
      </div>
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
    'wilsonassociates': 'Wilson Associates',
    'connectedinvestors': 'Connected Investors'
  };
  return names[scraper] || scraper;
}