'use client';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { 
  MapPin, Home, Clock, TrendingUp, Star, Users, AlertCircle,
  CheckCircle2, Building, Calendar
} from 'lucide-react';
import { FeatureFlags } from '../../lib/config';

interface StatsCardsProps {
  data: any[];
}

interface StatsData {
  totalProperties: number;
  within30MinCount: number;
  within30MinNashCount: number;
  within30MinMtJulietCount: number;
  enrichedCount: number;
  needsEnrichmentCount: number;
  topSource: { name: string; count: number };
  urgentCount: number;
  highPriorityCount: number;
  averageScore: number;
  activeEventsCount: number;
  byCounty: Record<string, number>;
  byStage: Record<string, number>;
  lastUpdated: string;
}

export function StatsCardsVNext({ data }: StatsCardsProps) {
  const isVNext = !FeatureFlags.USE_LEGACY;
  const showScoring = FeatureFlags.VNEXT_SCORING_ENABLED;
  const showDualProximity = FeatureFlags.USE_VNEXT_FILTERS;
  
  // Calculate statistics
  const stats: StatsData = calculateStats(data);
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Properties Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-1">
          <CardHeader className="bg-white m-[1px] rounded-t">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Home className="h-4 w-4" />
              Total Properties
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-white m-[1px] rounded-b pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-gray-900">
                {stats.totalProperties.toLocaleString()}
              </span>
              {isVNext && stats.activeEventsCount > 0 && (
                <span className="text-sm text-gray-500">
                  {stats.activeEventsCount} active
                </span>
              )}
            </div>
            {isVNext && stats.byCounty && (
              <div className="mt-2 space-y-1">
                {Object.entries(stats.byCounty)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 3)
                  .map(([county, count]) => (
                    <div key={county} className="flex justify-between text-xs">
                      <span className="text-gray-600">{county}</span>
                      <span className="text-gray-900 font-medium">{count}</span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </div>
      </Card>

      {/* Proximity Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-green-500 to-green-600 p-1">
          <CardHeader className="bg-white m-[1px] rounded-t">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {showDualProximity ? 'Within Target Areas' : 'Within 30 Minutes'}
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-white m-[1px] rounded-b pt-4">
            {!showDualProximity ? (
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-bold text-gray-900">
                  {stats.within30MinCount}
                </span>
                <span className="text-sm text-gray-500">
                  {((stats.within30MinCount / stats.totalProperties) * 100).toFixed(1)}%
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Nashville
                  </span>
                  <span className="text-lg font-bold text-gray-900">
                    {stats.within30MinNashCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Mt. Juliet
                  </span>
                  <span className="text-lg font-bold text-gray-900">
                    {stats.within30MinMtJulietCount}
                  </span>
                </div>
                <div className="pt-1 border-t">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Either hub</span>
                    <span className="text-gray-900 font-medium">
                      {stats.within30MinNashCount + stats.within30MinMtJulietCount}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </div>
      </Card>

      {/* Priority/Scoring Card */}
      {showScoring ? (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-1">
            <CardHeader className="bg-white m-[1px] rounded-t">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Star className="h-4 w-4" />
                Priority Properties
              </CardTitle>
            </CardHeader>
            <CardContent className="bg-white m-[1px] rounded-b pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-red-600" />
                    Urgent
                  </span>
                  <span className="text-lg font-bold text-red-600">
                    {stats.urgentCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-orange-600" />
                    High Priority
                  </span>
                  <span className="text-lg font-bold text-orange-600">
                    {stats.highPriorityCount}
                  </span>
                </div>
                <div className="pt-1 border-t">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Avg Score</span>
                    <span className="text-gray-900 font-medium">
                      {stats.averageScore.toFixed(1)}/100
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-1">
            <CardHeader className="bg-white m-[1px] rounded-t">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Top Source
              </CardTitle>
            </CardHeader>
            <CardContent className="bg-white m-[1px] rounded-b pt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold text-gray-900">
                  {stats.topSource.name}
                </span>
                <span className="text-sm text-gray-500">
                  {stats.topSource.count} properties
                </span>
              </div>
            </CardContent>
          </div>
        </Card>
      )}

      {/* Contact/Pipeline Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-1">
          <CardHeader className="bg-white m-[1px] rounded-t">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Users className="h-4 w-4" />
              {isVNext ? 'Pipeline Status' : 'Contact Status'}
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-white m-[1px] rounded-b pt-4">
            {!isVNext ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    Enriched
                  </span>
                  <span className="text-lg font-bold text-green-600">
                    {stats.enrichedCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Needs Trace</span>
                  <span className="text-lg font-bold text-gray-900">
                    {stats.needsEnrichmentCount}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {stats.byStage && Object.entries(stats.byStage)
                  .slice(0, 4)
                  .map(([stage, count]) => (
                    <div key={stage} className="flex justify-between text-xs">
                      <span className="text-gray-600 capitalize">
                        {stage.replace('_', ' ')}
                      </span>
                      <span className="text-gray-900 font-medium">{count}</span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </div>
      </Card>
    </div>
  );
}

function calculateStats(data: any[]): StatsData {
  const isVNext = !FeatureFlags.USE_LEGACY;
  
  const stats: StatsData = {
    totalProperties: data.length,
    within30MinCount: 0,
    within30MinNashCount: 0,
    within30MinMtJulietCount: 0,
    enrichedCount: 0,
    needsEnrichmentCount: 0,
    topSource: { name: 'N/A', count: 0 },
    urgentCount: 0,
    highPriorityCount: 0,
    averageScore: 0,
    activeEventsCount: 0,
    byCounty: {},
    byStage: {},
    lastUpdated: new Date().toLocaleString()
  };
  
  const sourceCounts: Record<string, number> = {};
  let totalScore = 0;
  let scoredProperties = 0;
  
  data.forEach(property => {
    // Proximity counts
    if (property.within_30min === 'Y' || property.within_30min === true) {
      stats.within30MinCount++;
    }
    if (property.within_30min_nash === true) {
      stats.within30MinNashCount++;
    }
    if (property.within_30min_mtjuliet === true) {
      stats.within30MinMtJulietCount++;
    }
    
    // Enrichment counts
    const hasContact = property.enriched || property.owner_email_1 || property.owner_phone_1;
    if (hasContact) {
      stats.enrichedCount++;
    } else {
      stats.needsEnrichmentCount++;
    }
    
    // Source counts
    if (property.source) {
      sourceCounts[property.source] = (sourceCounts[property.source] || 0) + 1;
    }
    
    // Priority counts (vNext)
    if (property.priority === 'urgent') {
      stats.urgentCount++;
    } else if (property.priority === 'high') {
      stats.highPriorityCount++;
    }
    
    // Score average (vNext)
    if (property.score !== undefined && property.score !== null) {
      totalScore += property.score;
      scoredProperties++;
    }
    
    // Active events count (vNext)
    if (property.event_count && property.event_count > 0) {
      stats.activeEventsCount++;
    }
    
    // County breakdown
    if (property.county) {
      stats.byCounty[property.county] = (stats.byCounty[property.county] || 0) + 1;
    }
    
    // Stage breakdown (vNext)
    if (isVNext && property.stage) {
      stats.byStage[property.stage] = (stats.byStage[property.stage] || 0) + 1;
    }
  });
  
  // Calculate top source
  const topSourceEntry = Object.entries(sourceCounts).sort(([, a], [, b]) => b - a)[0];
  if (topSourceEntry) {
    stats.topSource = { 
      name: getSourceDisplayName(topSourceEntry[0]), 
      count: topSourceEntry[1] 
    };
  }
  
  // Calculate average score
  if (scoredProperties > 0) {
    stats.averageScore = totalScore / scoredProperties;
  }
  
  return stats;
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