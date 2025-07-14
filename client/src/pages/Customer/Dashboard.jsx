import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { Users, TrendingUp, DollarSign, ShoppingCart, UserPlus, UserMinus, Star, MapPin } from 'lucide-react';

const CustomerDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('7d');

  // Mock data for customer metrics
  const customerMetrics = {
    totalCustomers: 12450,
    newCustomers: 324,
    activeCustomers: 8967,
    churnRate: 2.3,
    avgOrderValue: 145.50,
    customerLifetimeValue: 850.25,
    customerSatisfaction: 4.6,
    retentionRate: 89.5
  };

  // Mock data for customer acquisition over time
  const acquisitionData = [
    { date: '2024-01-01', newCustomers: 150, totalCustomers: 11800 },
    { date: '2024-01-08', newCustomers: 180, totalCustomers: 11980 },
    { date: '2024-01-15', newCustomers: 200, totalCustomers: 12180 },
    { date: '2024-01-22', newCustomers: 160, totalCustomers: 12340 },
    { date: '2024-01-29', newCustomers: 110, totalCustomers: 12450 }
  ];

  // Mock data for customer segments
  const segmentData = [
    { name: 'Premium', value: 15, color: '#8B5CF6' },
    { name: 'Regular', value: 65, color: '#06B6D4' },
    { name: 'Basic', value: 20, color: '#10B981' }
  ];

  // Mock data for customer geography
  const geographyData = [
    { region: 'North America', customers: 4500, revenue: 680000 },
    { region: 'Europe', customers: 3200, revenue: 450000 },
    { region: 'Asia Pacific', customers: 2800, revenue: 420000 },
    { region: 'Latin America', customers: 1500, revenue: 180000 },
    { region: 'Middle East', customers: 450, revenue: 75000 }
  ];

  // Mock recent customer activity
  const recentActivity = [
    { id: 1, customer: 'John Smith', action: 'Made purchase', amount: '$234.50', time: '2 hours ago' },
    { id: 2, customer: 'Sarah Johnson', action: 'Account created', amount: null, time: '3 hours ago' },
    { id: 3, customer: 'Mike Brown', action: 'Support ticket', amount: null, time: '5 hours ago' },
    { id: 4, customer: 'Emma Davis', action: 'Made purchase', amount: '$89.99', time: '6 hours ago' },
    { id: 5, customer: 'Alex Wilson', action: 'Profile updated', amount: null, time: '8 hours ago' }
  ];

  const MetricCard = ({ title, value, change, icon: Icon, trend }) => (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="p-2 bg-blue-100 rounded-lg mr-3">
            <Icon className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-sm font-medium text-gray-700">{title}</h3>
        </div>
        {trend && (
          <div className={`flex items-center ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            <TrendingUp className="h-4 w-4 mr-1" />
            <span className="text-sm font-medium">{change}%</span>
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );

  const TabButton = ({ id, label, active, onClick }) => (
    <button
      onClick={() => onClick(id)}
      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
        active 
          ? 'bg-blue-600 text-white' 
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Customer Dashboard</h1>
          <p className="text-gray-600">Monitor customer metrics, acquisition, and engagement</p>
        </div>

        {/* Date Range Selector */}
        <div className="mb-6">
          <div className="flex space-x-2">
            {['7d', '30d', '90d', '1y'].map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  dateRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                {range === '7d' ? 'Last 7 Days' : 
                 range === '30d' ? 'Last 30 Days' :
                 range === '90d' ? 'Last 90 Days' : 'Last Year'}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Customers"
            value={customerMetrics.totalCustomers.toLocaleString()}
            change={5.2}
            icon={Users}
            trend="up"
          />
          <MetricCard
            title="New Customers"
            value={customerMetrics.newCustomers.toLocaleString()}
            change={12.5}
            icon={UserPlus}
            trend="up"
          />
          <MetricCard
            title="Avg Order Value"
            value={`$${customerMetrics.avgOrderValue}`}
            change={-2.1}
            icon={DollarSign}
            trend="down"
          />
          <MetricCard
            title="Customer Satisfaction"
            value={customerMetrics.customerSatisfaction}
            change={8.3}
            icon={Star}
            trend="up"
          />
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex space-x-2">
            <TabButton
              id="overview"
              label="Overview"
              active={activeTab === 'overview'}
              onClick={setActiveTab}
            />
            <TabButton
              id="acquisition"
              label="Acquisition"
              active={activeTab === 'acquisition'}
              onClick={setActiveTab}
            />
            <TabButton
              id="segments"
              label="Segments"
              active={activeTab === 'segments'}
              onClick={setActiveTab}
            />
            <TabButton
              id="geography"
              label="Geography"
              active={activeTab === 'geography'}
              onClick={setActiveTab}
            />
            <TabButton
              id="activity"
              label="Activity"
              active={activeTab === 'activity'}
              onClick={setActiveTab}
            />
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">Customer Acquisition Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={acquisitionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="newCustomers" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      name="New Customers"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">Key Performance Metrics</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Active Customers</span>
                    <span className="font-semibold">{customerMetrics.activeCustomers.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Churn Rate</span>
                    <span className="font-semibold text-red-600">{customerMetrics.churnRate}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Retention Rate</span>
                    <span className="font-semibold text-green-600">{customerMetrics.retentionRate}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Customer Lifetime Value</span>
                    <span className="font-semibold">${customerMetrics.customerLifetimeValue}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'acquisition' && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Customer Acquisition Over Time</h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={acquisitionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <Legend />
                  <Bar 
                    yAxisId="left"
                    dataKey="newCustomers" 
                    fill="#8884d8" 
                    name="New Customers"
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="totalCustomers" 
                    stroke="#82ca9d" 
                    strokeWidth={2}
                    name="Total Customers"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {activeTab === 'segments' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">Customer Segments</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={segmentData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name} ${value}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {segmentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">Segment Details</h3>
                <div className="space-y-4">
                  {segmentData.map((segment, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div 
                          className="w-4 h-4 rounded mr-3"
                          style={{ backgroundColor: segment.color }}
                        ></div>
                        <span className="font-medium">{segment.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{segment.value}%</div>
                        <div className="text-sm text-gray-600">
                          {Math.round(customerMetrics.totalCustomers * segment.value / 100).toLocaleString()} customers
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'geography' && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Customer Distribution by Geography</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={geographyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="region" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="customers" fill="#8884d8" name="Customers" />
                  <Bar yAxisId="right" dataKey="revenue" fill="#82ca9d" name="Revenue ($)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Customer Activity</h3>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between py-3 border-b border-gray-200 last:border-b-0">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <Users className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{activity.customer}</p>
                        <p className="text-sm text-gray-600">{activity.action}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {activity.amount && (
                        <p className="font-semibold text-green-600">{activity.amount}</p>
                      )}
                      <p className="text-sm text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;