import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, Clock, Database, Calendar, TrendingUp, MapPin } from 'lucide-react';

interface StatsCardsProps {
  stats: {
    total: number;
    within30Min: number;
    lastUpdated: string | null;
    sources: Record<string, number>;
  };
}

export function StatsCards({ stats }: StatsCardsProps) {
  const totalSources = Object.keys(stats.sources).length;
  const within30Percentage = stats.total > 0 ? ((stats.within30Min / stats.total) * 100).toFixed(1) : '0';
  
  // Get the most productive source
  const topSource = Object.entries(stats.sources).reduce((a, b) => a[1] > b[1] ? a : b, ['', 0]);
  
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-blue-700">Total Properties</CardTitle>
          <Home className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-900">{stats.total}</div>
          <p className="text-xs text-blue-600">
            From {totalSources} active sources
          </p>
        </CardContent>
      </Card>
      
      <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-green-700">Within 30 Minutes</CardTitle>
          <MapPin className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-900">{stats.within30Min}</div>
          <p className="text-xs text-green-600">
            {within30Percentage}% of total properties
          </p>
        </CardContent>
      </Card>
      
      <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-purple-700">Top Source</CardTitle>
          <TrendingUp className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-900">{topSource[1]}</div>
          <p className="text-xs text-purple-600">
            {topSource[0] ? getSourceDisplayName(topSource[0]) : 'No data'}
          </p>
        </CardContent>
      </Card>
      
      <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-orange-700">Last Updated</CardTitle>
          <Calendar className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-900">
            {stats.lastUpdated 
              ? new Date(stats.lastUpdated).toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })
              : 'Never'}
          </div>
          <p className="text-xs text-orange-600">
            {stats.lastUpdated 
              ? new Date(stats.lastUpdated).toLocaleDateString()
              : 'No data yet'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function getSourceDisplayName(source: string): string {
  const names: Record<string, string> = {
    'phillipjoneslaw': 'Phillip Jones Law',
    'clearrecon': 'ClearRecon',
    'tnledger': 'TN Ledger',
    'wabipowerbi': 'WABI PowerBI',
    'wilsonassociates': 'Wilson Associates',
    'wilson': 'Wilson Associates'
  };
  return names[source] || source;
}