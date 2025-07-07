import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, Clock, Database, Calendar } from 'lucide-react';

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
  
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
          <Home className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
          <p className="text-xs text-muted-foreground">
            From {totalSources} sources
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Within 30 Minutes</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.within30Min}</div>
          <p className="text-xs text-muted-foreground">
            {stats.total > 0 ? `${((stats.within30Min / stats.total) * 100).toFixed(1)}%` : '0%'} of total
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Sources</CardTitle>
          <Database className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalSources}</div>
          <p className="text-xs text-muted-foreground">
            Data providers
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.lastUpdated 
              ? new Date(stats.lastUpdated).toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })
              : 'Never'}
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.lastUpdated 
              ? new Date(stats.lastUpdated).toLocaleDateString()
              : 'No data yet'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}