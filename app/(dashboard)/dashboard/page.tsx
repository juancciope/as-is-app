'use client';

import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Home, 
  Users, 
  Calendar,
  BarChart3,
  PieChart,
  LineChart,
  Activity
} from 'lucide-react';

// Mock data for charts - replace with real data
interface ChartData {
  name: string;
  value: number;
  change?: number;
}

interface TimeSeriesData {
  date: string;
  leads: number;
  properties: number;
  conversions: number;
}

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  
  // Mock data - replace with actual API calls
  const [stats, setStats] = useState({
    totalLeads: 1247,
    totalProperties: 3892,
    totalValue: 45600000,
    conversionRate: 12.4,
    leadsChange: 8.2,
    propertiesChange: -2.1,
    valueChange: 15.7,
    conversionChange: 3.2
  });

  const [sourceData, setSourceData] = useState<ChartData[]>([
    { name: 'Probate', value: 35 },
    { name: 'Auctions', value: 28 },
    { name: 'Divorce', value: 15 },
    { name: 'Immigration', value: 12 },
    { name: 'Tax Liens', value: 10 }
  ]);

  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([
    { date: '2024-07-01', leads: 120, properties: 450, conversions: 15 },
    { date: '2024-07-08', leads: 135, properties: 478, conversions: 18 },
    { date: '2024-07-15', leads: 142, properties: 492, conversions: 16 },
    { date: '2024-07-22', leads: 128, properties: 467, conversions: 21 },
    { date: '2024-07-29', leads: 156, properties: 523, conversions: 19 },
    { date: '2024-08-05', leads: 164, properties: 541, conversions: 24 }
  ]);

  useEffect(() => {
    // Simulate loading time
    setTimeout(() => setIsLoading(false), 1000);
  }, []);

  const StatCard = ({ 
    title, 
    value, 
    change, 
    icon: Icon, 
    format = 'number' 
  }: { 
    title: string; 
    value: number; 
    change: number; 
    icon: any; 
    format?: 'number' | 'currency' | 'percentage' 
  }) => {
    const formatValue = (val: number) => {
      switch (format) {
        case 'currency':
          return `$${(val / 1000000).toFixed(1)}M`;
        case 'percentage':
          return `${val}%`;
        default:
          return val.toLocaleString();
      }
    };

    const isPositive = change >= 0;

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {formatValue(value)}
            </p>
            <div className={`flex items-center mt-2 text-sm ${
              isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              {isPositive ? (
                <TrendingUp className="h-4 w-4 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 mr-1" />
              )}
              {Math.abs(change)}% vs last period
            </div>
          </div>
          <div className="p-3 bg-[#04325E] bg-opacity-10 rounded-lg">
            <Icon className="h-6 w-6 text-[#04325E]" />
          </div>
        </div>
      </div>
    );
  };

  const SimpleBarChart = ({ data, title }: { data: ChartData[]; title: string }) => {
    const maxValue = Math.max(...data.map(d => d.value));
    
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <PieChart className="h-5 w-5 mr-2 text-[#04325E]" />
          {title}
        </h3>
        <div className="space-y-4">
          {data.map((item, index) => (
            <div key={item.name}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">{item.name}</span>
                <span className="font-medium text-gray-900">{item.value}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-[#04325E] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(item.value / maxValue) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const SimpleLineChart = ({ data, title }: { data: TimeSeriesData[]; title: string }) => {
    const maxLeads = Math.max(...data.map(d => d.leads));
    const maxProperties = Math.max(...data.map(d => d.properties));
    
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <LineChart className="h-5 w-5 mr-2 text-[#04325E]" />
            {title}
          </h3>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-[#04325E] focus:border-transparent"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
        </div>
        
        {/* Simple visualization - in production, use a proper chart library */}
        <div className="space-y-6">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Leads</span>
              <span className="text-blue-600 font-medium">Current: {data[data.length - 1]?.leads}</span>
            </div>
            <div className="flex items-end space-x-1 h-20">
              {data.map((item, index) => (
                <div
                  key={index}
                  className="bg-blue-500 rounded-t-sm flex-1 transition-all duration-300"
                  style={{ height: `${(item.leads / maxLeads) * 100}%` }}
                  title={`${item.date}: ${item.leads} leads`}
                />
              ))}
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Properties</span>
              <span className="text-green-600 font-medium">Current: {data[data.length - 1]?.properties}</span>
            </div>
            <div className="flex items-end space-x-1 h-20">
              {data.map((item, index) => (
                <div
                  key={index}
                  className="bg-green-500 rounded-t-sm flex-1 transition-all duration-300"
                  style={{ height: `${(item.properties / maxProperties) * 100}%` }}
                  title={`${item.date}: ${item.properties} properties`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <LayoutDashboard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <LayoutDashboard className="h-8 w-8 mr-3 text-[#04325E]" />
            Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Analytics and insights for your property investment pipeline
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Leads"
          value={stats.totalLeads}
          change={stats.leadsChange}
          icon={Users}
        />
        <StatCard
          title="Properties Tracked"
          value={stats.totalProperties}
          change={stats.propertiesChange}
          icon={Home}
        />
        <StatCard
          title="Portfolio Value"
          value={stats.totalValue}
          change={stats.valueChange}
          icon={DollarSign}
          format="currency"
        />
        <StatCard
          title="Conversion Rate"
          value={stats.conversionRate}
          change={stats.conversionChange}
          icon={Activity}
          format="percentage"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SimpleBarChart
          data={sourceData}
          title="Lead Sources Distribution"
        />
        <SimpleLineChart
          data={timeSeriesData}
          title="Leads & Properties Trends"
        />
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-[#04325E]" />
            Top Performing Sources
          </h3>
          <div className="space-y-3">
            {sourceData.slice(0, 3).map((source, index) => (
              <div key={source.name} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-3 ${
                    index === 0 ? 'bg-green-500' : 
                    index === 1 ? 'bg-blue-500' : 'bg-yellow-500'
                  }`} />
                  <span className="text-sm text-gray-600">{source.name}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{source.value}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-[#04325E]" />
            Recent Activity
          </h3>
          <div className="space-y-3">
            <div className="flex items-center text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-3" />
              <span className="text-gray-600">24 new leads this week</span>
            </div>
            <div className="flex items-center text-sm">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-3" />
              <span className="text-gray-600">87 properties analyzed</span>
            </div>
            <div className="flex items-center text-sm">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mr-3" />
              <span className="text-gray-600">12 high-value opportunities</span>
            </div>
            <div className="flex items-center text-sm">
              <div className="w-2 h-2 bg-purple-500 rounded-full mr-3" />
              <span className="text-gray-600">5 deals in progress</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-[#04325E]" />
            Key Insights
          </h3>
          <div className="space-y-3">
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-green-800 font-medium">
                📈 Probate leads up 15% this month
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800 font-medium">
                🏠 Average property value increased 8%
              </p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-800 font-medium">
                ⚡ Response time improved by 23%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="flex items-center justify-center px-4 py-3 bg-[#04325E] text-white rounded-lg hover:bg-[#0a4976] transition-colors">
            <Users className="h-5 w-5 mr-2" />
            View All Leads
          </button>
          <button className="flex items-center justify-center px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
            <Home className="h-5 w-5 mr-2" />
            Browse Properties
          </button>
          <button className="flex items-center justify-center px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
            <BarChart3 className="h-5 w-5 mr-2" />
            Generate Report
          </button>
          <button className="flex items-center justify-center px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
            <Activity className="h-5 w-5 mr-2" />
            Run Analysis
          </button>
        </div>
      </div>
    </div>
  );
}