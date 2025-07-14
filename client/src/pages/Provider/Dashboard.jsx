import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  Star, 
  Bell, 
  Search,
  Filter,
  MoreVertical,
  ArrowUp,
  ArrowDown,
  Eye,
  MessageCircle,
  Heart,
  Activity
} from 'lucide-react';

const ProviderDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [notifications, setNotifications] = useState(3);
  const [searchQuery, setSearchQuery] = useState('');

  // Sample data
  const stats = [
    { 
      title: 'Total Patients', 
      value: '2,847', 
      change: '+12%', 
      trend: 'up',
      icon: Users,
      color: 'from-blue-500 to-blue-600'
    },
    { 
      title: 'Appointments Today', 
      value: '28', 
      change: '+3', 
      trend: 'up',
      icon: Calendar,
      color: 'from-emerald-500 to-emerald-600'
    },
    { 
      title: 'Revenue (Month)', 
      value: '$24,580', 
      change: '+8%', 
      trend: 'up',
      icon: DollarSign,
      color: 'from-violet-500 to-violet-600'
    },
    { 
      title: 'Avg. Rating', 
      value: '4.8', 
      change: '+0.2', 
      trend: 'up',
      icon: Star,
      color: 'from-amber-500 to-amber-600'
    }
  ];

  const recentAppointments = [
    { id: 1, patient: 'Sarah Johnson', time: '9:00 AM', type: 'Consultation', status: 'confirmed' },
    { id: 2, patient: 'Michael Chen', time: '10:30 AM', type: 'Follow-up', status: 'pending' },
    { id: 3, patient: 'Emma Davis', time: '2:00 PM', type: 'Check-up', status: 'confirmed' },
    { id: 4, patient: 'Robert Wilson', time: '3:30 PM', type: 'Consultation', status: 'confirmed' },
    { id: 5, patient: 'Lisa Garcia', time: '4:45 PM', type: 'Follow-up', status: 'pending' }
  ];

  const recentActivity = [
    { id: 1, action: 'New patient registration', user: 'David Kim', time: '10 minutes ago', type: 'user' },
    { id: 2, action: 'Appointment cancelled', user: 'Maria Lopez', time: '25 minutes ago', type: 'calendar' },
    { id: 3, action: 'Review received', user: 'John Smith', time: '1 hour ago', type: 'star' },
    { id: 4, action: 'Payment processed', user: 'Anna Johnson', time: '2 hours ago', type: 'payment' }
  ];

  const StatCard = ({ stat }) => {
    const IconComponent = stat.icon;
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color}`}>
              <IconComponent className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">{stat.title}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </div>
          <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-sm font-medium ${
            stat.trend === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {stat.trend === 'up' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            <span>{stat.change}</span>
          </div>
        </div>
      </div>
    );
  };

  const AppointmentCard = ({ appointment }) => (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
          <span className="text-white font-medium text-sm">{appointment.patient.split(' ').map(n => n[0]).join('')}</span>
        </div>
        <div>
          <p className="font-medium text-gray-900">{appointment.patient}</p>
          <p className="text-sm text-gray-600">{appointment.type}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-medium text-gray-900">{appointment.time}</p>
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
          appointment.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
        }`}>
          {appointment.status}
        </span>
      </div>
    </div>
  );

  const ActivityItem = ({ activity }) => {
    const getIcon = () => {
      switch (activity.type) {
        case 'user': return <Users className="w-4 h-4" />;
        case 'calendar': return <Calendar className="w-4 h-4" />;
        case 'star': return <Star className="w-4 h-4" />;
        case 'payment': return <DollarSign className="w-4 h-4" />;
        default: return <Activity className="w-4 h-4" />;
      }
    };

    return (
      <div className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
          {getIcon()}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">{activity.action}</p>
          <p className="text-xs text-gray-600">{activity.user} • {activity.time}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Provider Dashboard</h1>
                <p className="text-sm text-gray-600">Welcome back, Dr. Smith</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Search patients, appointments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell className="w-6 h-6" />
                {notifications > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {notifications}
                  </span>
                )}
              </button>
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center">
                <span className="text-white font-medium text-sm">DS</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex space-x-1 bg-white rounded-xl p-1 shadow-sm">
          {['overview', 'appointments', 'patients', 'analytics'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-lg font-medium transition-all capitalize ${
                activeTab === tab
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((stat, index) => (
                <StatCard key={index} stat={stat} />
              ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Today's Appointments */}
              <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Today's Appointments</h2>
                  <button className="flex items-center space-x-2 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Eye className="w-4 h-4" />
                    <span>View All</span>
                  </button>
                </div>
                <div className="space-y-3">
                  {recentAppointments.map((appointment) => (
                    <AppointmentCard key={appointment.id} appointment={appointment} />
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
                  <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-2">
                  {recentActivity.map((activity) => (
                    <ActivityItem key={activity.id} activity={activity} />
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button className="flex flex-col items-center space-y-2 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl hover:from-blue-100 hover:to-indigo-100 transition-all">
                  <Calendar className="w-6 h-6 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">New Appointment</span>
                </button>
                <button className="flex flex-col items-center space-y-2 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl hover:from-emerald-100 hover:to-teal-100 transition-all">
                  <Users className="w-6 h-6 text-emerald-600" />
                  <span className="text-sm font-medium text-gray-700">Add Patient</span>
                </button>
                <button className="flex flex-col items-center space-y-2 p-4 bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl hover:from-purple-100 hover:to-violet-100 transition-all">
                  <MessageCircle className="w-6 h-6 text-purple-600" />
                  <span className="text-sm font-medium text-gray-700">Messages</span>
                </button>
                <button className="flex flex-col items-center space-y-2 p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl hover:from-amber-100 hover:to-orange-100 transition-all">
                  <TrendingUp className="w-6 h-6 text-amber-600" />
                  <span className="text-sm font-medium text-gray-700">Reports</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'appointments' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">All Appointments</h2>
              <div className="flex items-center space-x-3">
                <button className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
                  <Filter className="w-4 h-4" />
                  <span>Filter</span>
                </button>
                <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                  New Appointment
                </button>
              </div>
            </div>
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Appointment management coming soon</p>
              <p className="text-sm">Full calendar and scheduling features will be available here</p>
            </div>
          </div>
        )}

        {activeTab === 'patients' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Patient Management</h2>
              <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                Add Patient
              </button>
            </div>
            <div className="text-center py-12 text-gray-500">
              <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Patient database coming soon</p>
              <p className="text-sm">Comprehensive patient records and management tools</p>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Analytics & Reports</h2>
              <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                Generate Report
              </button>
            </div>
            <div className="text-center py-12 text-gray-500">
              <TrendingUp className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Advanced analytics coming soon</p>
              <p className="text-sm">Detailed insights and performance metrics</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderDashboard;