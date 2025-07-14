import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import {
  Table,
  Button,
  Modal,
  Select,
  message,
  Card,
  Descriptions,
  Tag,
  Space,
  Statistic,
  Row,
  Col,
  Rate,
  Input,
  Divider,
  Avatar,
  Popconfirm,
  DatePicker,
  TimePicker
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  FilterOutlined,
  CloseOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  ExclamationCircleOutlined,
  DeleteOutlined,
  EditOutlined
} from '@ant-design/icons';
import {
  User,
  Clock,
  MapPin,
  Eye,
  UserCheck,
  Phone,
  Mail,
  Star,
  Calendar,
  Sliders,
  Briefcase,
  Home
} from 'lucide-react';
import dayjs from 'dayjs';
import 'antd/dist/reset.css';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const { Option } = Select;
const { RangePicker } = DatePicker;

const statusFilters = [
  { text: 'Pending', value: 'pending', icon: <ClockCircleOutlined className="text-yellow-500" /> },
  { text: 'Accepted', value: 'accepted', icon: <CheckCircleOutlined className="text-blue-500" /> },
  { text: 'Completed', value: 'completed', icon: <CheckCircleOutlined className="text-green-500" /> },
  { text: 'Cancelled', value: 'cancelled', icon: <CloseOutlined className="text-red-500" /> }
];

const AdminBookingsPage = () => {
  const { API, isAdmin, logoutUser , user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [providers, setProviders] = useState([]);
  const [assignedProvider, setAssignedProvider] = useState(null);
  const [stats, setStats] = useState({
    pending: 0,
    accepted: 0,
    completed: 0,
    revenue: 0
  });
  const [searchText, setSearchText] = useState('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [filters, setFilters] = useState({
    status: 'pending', // Default to pending only
    dateRange: null
  });
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleForm, setRescheduleForm] = useState({
    date: null,
    time: null
  });

  const fetchBookings = async (params = {}) => {
    if (!isAdmin) return;

    try {
      setLoading(true);
      const { current, pageSize } = pagination;

      // Construct query parameters
      const queryParams = new URLSearchParams({
        page: current,
        limit: pageSize,
        status: 'pending', // Only fetch pending bookings initially
        ...(filters.dateRange && {
          from: filters.dateRange[0],
          to: filters.dateRange[1]
        }),
        ...(searchText && { search: searchText }),
        ...params
      });

      const response = await fetch(`${API}/booking/admin?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.status === 401) {
        logoutUser ();
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch bookings');
      }

      const data = await response.json();
      // Filter bookings by admin's city if admin has city information
      let filteredBookings = data.data || [];
      if (user?.city) {
        filteredBookings = filteredBookings.filter(
          booking => booking.address?.city === user.city
        );
      }
      
      setBookings(filteredBookings);
      setPagination({
        ...pagination,
        total: filteredBookings.length || 0,
      });
      calculateStats(filteredBookings);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (bookings) => {
    const stats = {
      pending: 0,
      accepted: 0,
      completed: 0,
      revenue: 0
    };

    bookings.forEach(booking => {
      stats[booking.status]++;
      if (booking.status === 'completed' && booking.invoice) {
        stats.revenue += booking.invoice.totalAmount || 0;
      }
    });

    setStats(stats);
  };

  const fetchAvailableProviders = async (bookingId) => {
    try {
      setAssignLoading(true);
      
      // First get booking details to know the city
      const bookingResponse = await fetch(`${API}/booking/admin/${bookingId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!bookingResponse.ok) {
        throw new Error('Failed to fetch booking details');
      }

      const bookingData = await bookingResponse.json();
      const booking = bookingData.data;
      const city = booking.address?.city || '';

      // Then fetch available approved providers for that city
      const providersResponse = await fetch(
        `${API}/admin/providers?city=${encodeURIComponent(city)}&status=approved`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!providersResponse.ok) {
        throw new Error('Failed to fetch providers');
      }

      const providersData = await providersResponse.json();
      setProviders(providersData.providers || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setAssignLoading(false);
    }
  };

  const handleTableChange = (pagination, filters) => {
    setPagination(pagination);
    fetchBookings({ 
      page: pagination.current, 
      limit: pagination.pageSize,
      status: filters.status ? filters.status[0] : 'pending'
    });
  };

  const showAssignModal = async (booking) => {
    setSelectedBooking(booking);
    setAssignedProvider(null);
    await fetchAvailableProviders(booking._id);
  };

  const assignProvider = async (providerId) => {
    if (!selectedBooking) return;

    try {
      setAssignLoading(true);
      const response = await fetch(`${API}/booking/admin/${selectedBooking._id}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ providerId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to assign provider');
      }

      const result = await response.json();
      const assignedProvider = providers.find(p => p._id === providerId);
      
      toast.success('Provider assigned successfully!');
      setAssignedProvider(assignedProvider);
      
      // Update the booking status locally
      setBookings(prev => 
        prev.map(b => 
          b._id === selectedBooking._id 
            ? { ...b, status: 'accepted', provider: assignedProvider } 
            : b
        )
      );
      
      // Update stats
      setStats(prev => ({
        ...prev,
        pending: prev.pending - 1,
        accepted: prev.accepted + 1
      }));
      
      // Close modal after 2 seconds
      setTimeout(() => {
        setSelectedBooking(null);
      }, 2000);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setAssignLoading(false);
    }
  };

  const deleteBooking = async (bookingId, userId) => {
    try {
      setDeleteLoading(true);
      const endpoint = userId
        ? `${API}/booking/admin/user/${userId}/booking/${bookingId}`
        : `${API}/booking/admin/${bookingId}`;

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete booking');
      }

      toast.success('Booking deleted successfully!');
      fetchBookings();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const confirmDelete = (booking) => {
    Modal.confirm({
      title: 'Delete Booking Confirmation',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to permanently delete this booking?',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk() {
        return deleteBooking(booking._id, booking.customer?._id);
      }
    });
  };

  const handleSearch = (value) => {
    setSearchText(value);
    fetchBookings({ search: value });
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    fetchBookings({ [key]: value });
  };

  const handleDateRangeChange = (dates) => {
    if (dates && dates.length === 2) {
      setFilters(prev => ({
        ...prev,
        dateRange: [
          dates[0].startOf('day').toISOString(),
          dates[1].endOf('day').toISOString()
        ]
      }));
      fetchBookings({
        from: dates[0].startOf('day').toISOString(),
        to: dates[1].endOf('day').toISOString()
      });
    } else {
      setFilters(prev => ({ ...prev, dateRange: null }));
      fetchBookings({ from: null, to: null });
    }
  };

  const resetFilters = () => {
    setFilters({
      status: 'pending',
      dateRange: null
    });
    setSearchText('');
    fetchBookings({
      status: 'pending',
      search: '',
      from: null,
      to: null
    });
  };

  const exportToCSV = () => {
    try {
      if (bookings.length === 0) {
        toast.warning('No bookings to export');
        return;
      }

      const headers = [
        'Booking ID',
        'Customer Name',
        'Customer Email',
        'Customer Phone',
        'Service Title',
        'Service Category',
        'Date',
        'Time',
        'Status',
        'Street Address',
        'City',
        'State',
        'Postal Code',
        'Country',
        'Payment Method',
        'Total Amount',
        'Created At'
      ];

      const rows = bookings.map(booking => [
        booking._id,
        booking.customer?.name || 'N/A',
        booking.customer?.email || 'N/A',
        booking.customer?.phone || 'N/A',
        booking.service?.title || 'N/A',
        booking.service?.category || 'N/A',
        dayjs(booking.date).format('YYYY-MM-DD'),
        booking.time || 'N/A',
        booking.status,
        booking.address?.street || 'N/A',
        booking.address?.city || 'N/A',
        booking.address?.state || 'N/A',
        booking.address?.postalCode || 'N/A',
        booking.address?.country || 'N/A',
        booking.paymentStatus || 'N/A',
        booking.invoice?.totalAmount || '0',
        dayjs(booking.createdAt).format('YYYY-MM-DD HH:mm:ss')
      ]);

      const BOM = "\uFEFF";
      let csvContent = BOM + headers.join(',') + '\n';

      rows.forEach(row => {
        csvContent += row.map(field =>
          `"${String(field || '').replace(/"/g, '""')}"`
        ).join(',') + '\n';
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bookings_${dayjs().format('YYYYMMDD_HHmmss')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Bookings exported successfully');
    } catch (error) {
      toast.error('Failed to export bookings: ' + error.message);
    }
  };

  const handleRescheduleSubmit = async () => {
    if (!selectedBooking || (!rescheduleForm.date && !rescheduleForm.time)) {
      toast.warning('Please provide either date or time to reschedule');
      return;
    }

    try {
      setRescheduleLoading(true);

      const payload = {};
      if (rescheduleForm.date) payload.date = rescheduleForm.date.format('YYYY-MM-DD');
      if (rescheduleForm.time) payload.time = rescheduleForm.time.format('HH:mm');

      const response = await fetch(`${API}/booking/admin/${selectedBooking._id}/reschedule`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to reschedule booking');
      }

      toast.success('Booking rescheduled successfully!');
      fetchBookings();
      setSelectedBooking(null);
      setRescheduleForm({ date: null, time: null });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRescheduleLoading(false);
    }
  };

  const columns = [
    {
      title: 'Booking ID',
      dataIndex: '_id',
      key: 'id',
      render: (id) => <span className="text-xs font-mono text-gray-600">{id?.slice(-8) || 'N/A'}</span>,
      width: 100,
      fixed: 'left'
    },
    {
      title: 'Customer',
      dataIndex: ['customer', 'name'],
      key: 'customer',
      render: (text, record) => (
        <div className="flex items-center">
          <Avatar
            src={record.customer?.profilePicUrl}
            icon={<User Outlined />}
            size="small"
            className="mr-2 bg-blue-100 text-blue-600"
          />
          <div>
            <div className="font-medium text-blue-900">{text || 'N/A'}</div>
            <div className="text-gray-500 text-xs flex items-center">
              <Phone className="w-3 h-3 mr-1" /> {record.customer?.phone || 'N/A'}
            </div>
          </div>
        </div>
      ),
      width: 180
    },
    {
      title: 'Service',
      dataIndex: ['service', 'title'],
      key: 'service',
      render: (text, record) => (
        <div>
          <div className="font-medium text-blue-900">{text || 'N/A'}</div>
          <div className="text-gray-500 text-xs">{record.service?.category || 'N/A'}</div>
        </div>
      ),
      width: 180
    },
    {
      title: 'Date & Time',
      key: 'datetime',
      render: (record) => (
        <div className="flex items-center">
          <Calendar className="w-4 h-4 text-blue-600 mr-2" />
          <div>
            <div className="text-blue-900">{record.date ? dayjs(record.date).format('DD MMM YYYY') : 'N/A'}</div>
            <div className="text-gray-500 text-xs flex items-center">
              <Clock className="w-3 h-3 mr-1" /> {record.time || 'Not specified'}
            </div>
          </div>
        </div>
      ),
      width: 150
    },
    {
      title: 'Location',
      key: 'location',
      render: (record) => (
        <div className="flex items-center">
          <MapPin className="w-4 h-4 text-blue-600 mr-2" />
          <div>
            <div className="text-blue-900">{record.address?.city || 'N/A'}</div>
            <div className="text-gray-500 text-xs">{record.address?.state || ''}</div>
          </div>
        </div>
      ),
      width: 150
    },
    {
      title: 'Amount',
      key: 'amount',
      render: (record) => (
        <div className="font-medium text-blue-900">
          ₹{(record.invoice?.totalAmount || 0).toFixed(2)}
        </div>
      ),
      width: 100
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      filters: statusFilters.map(f => ({ text: f.text, value: f.value })),
      render: (status) => {
        let color, icon;
        switch (status) {
          case 'pending':
            color = 'orange';
            icon = <ClockCircleOutlined className="mr-1" />;
            break;
          case 'accepted':
            color = 'blue';
            icon = <CheckCircleOutlined className="mr-1" />;
            break;
          case 'completed':
            color = 'green';
            icon = <CheckCircleOutlined className="mr-1" />;
            break;
          case 'cancelled':
            color = 'red';
            icon = <CloseOutlined className="mr-1" />;
            break;
          default:
            color = 'gray';
        }
        return (
          <Tag
            icon={icon}
            color={color}
            className="flex items-center capitalize"
          >
            {status}
          </Tag>
        );
      },
      width: 120
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            onClick={() => showAssignModal(record)}
            icon={<User Check className ="w-4 h-4 text-blue-600" />}
            className="hover:bg-blue-50"
            title="Assign provider"
            disabled={record.status !== 'pending'}
          />
          <Button
            type="text"
            size="small"
            onClick={() => {
              setSelectedBooking(record);
              setRescheduleForm({
                date: record.date ? dayjs(record.date) : null,
                time: record.time ? dayjs(record.time, 'HH:mm') : null
              });
            }}
            icon={<EditOutlined className="w-4 h-4 text-purple-600" />}
            className="hover:bg-purple-50"
            title="Reschedule"
          />
          <Popconfirm
            title="Delete this booking?"
            onConfirm={() => confirmDelete(record)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined className="w-4 h-4" />}
              className="hover:bg-red-50"
              title="Delete booking"
              loading={deleteLoading}
            />
          </Popconfirm>
          <Button
            type="text"
            size="small"
            onClick={() => setSelectedBooking(record)}
            icon={<Eye className="w-4 h-4 text-gray-600" />}
            className="hover:bg-gray-50"
            title="View details"
          />
        </Space>
      ),
      width: 150,
      fixed: 'right'
    },
  ];

  useEffect(() => {
    fetchBookings();
  }, []);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-blue-50 p-4">
        <Card className="text-center max-w-md w-full shadow-lg border-0">
          <div className="p-6">
            <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <CloseOutlined className="text-red-500 text-2xl" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-blue-900">Access Denied</h2>
            <p className="text-gray-600 mb-6">You don't have permission to access this page.</p>
            <Button
              type="primary"
              onClick={logoutUser }
              className="bg-blue-600 hover:bg-blue-700 h-10 px-6"
              size="large"
            >
              Return to Login
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-blue-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-blue-900">Bookings Management</h1>
            <p className="text-gray-600">Manage and track all customer bookings</p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
            <Input.Search
              placeholder="Search bookings..."
              allowClear
              enterButton={<SearchOutlined />}
              size="large"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={handleSearch}
              className="w-full"
            />
            <Button
              icon={<FilterOutlined />}
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center ${showFilters ? 'bg-blue-100 text-blue-600' : ''}`}
            >
              Filters
            </Button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <Card className="mb-6 border-0 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <Select
                    value={filters.status}
                    onChange={(value) => handleFilterChange('status', value)}
                    className="w-full"
                    suffixIcon={<Sliders className="w-4 h-4 text-gray-400" />}
                  >
                    {statusFilters.map(filter => (
                      <Option key={filter.value} value={filter.value}>
                        <div className="flex items-center">
                          {filter.icon}
                          <span className="ml-2">{filter.text}</span>
                        </div>
                      </Option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                  <RangePicker
                    className="w-full"
                    value={filters.dateRange ? [
                      dayjs(filters.dateRange[0]),
                      dayjs(filters.dateRange[1])
                    ] : null}
                    onChange={handleDateRangeChange}
                  />
                </div>
              </div>
              
              <div className="flex items-end">
                <Button 
                  onClick={resetFilters}
                  className="flex items-center"
                >
                  Reset
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Stats Cards */}
        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={24} sm={12} md={6}>
            <Card className="border-0 shadow-sm h-full">
              <Statistic
                title={<span className="text-gray-600">Pending Bookings</span>}
                value={stats.pending}
                prefix={<ClockCircleOutlined className="text-yellow-500 mr-2" />}
                valueStyle={{ color: '#1e3a8a' }}
                className="h-full"
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card className="border-0 shadow-sm h-full">
              <Statistic
                title={<span className="text-gray-600">Accepted Bookings</span>}
                value={stats.accepted}
                prefix={<CheckCircleOutlined className="text-blue-500 mr-2" />}
                valueStyle={{ color: '#1e3a8a' }}
                className="h-full"
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card className="border-0 shadow-sm h-full">
              <Statistic
                title={<span className="text-gray-600">Completed Bookings</span>}
                value={stats.completed}
                prefix={<CheckCircleOutlined className="text-green-500 mr-2" />}
                valueStyle={{ color: '#1e3a8a' }}
                className="h-full"
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card className="border-0 shadow-sm h-full">
              <Statistic
                title={<span className="text-gray-600">Total Revenue</span>}
                value={stats.revenue}
                precision={2}
                prefix="₹"
                valueStyle={{ color: '#1e3a8a' }}
                className="h-full"
              />
            </Card>
          </Col>
        </Row>

        {/* Bookings Table */}
        <Card
          className="border-0 shadow-sm"
          extra={
            <Button
              icon={<DownloadOutlined />}
              onClick={exportToCSV}
              className="flex items-center bg-blue-600 hover:bg-blue-700 text-white"
            >
              Export
            </Button>
          }
        >
          <Table
            columns={columns}
            dataSource={bookings}
            rowKey="_id"
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} bookings`
            }}
            onChange={handleTableChange}
            scroll={{ x: 1200 }}
            className="ant-table-striped"
            rowClassName={(record, index) => index % 2 === 0 ? 'bg-blue-50' : ''}
          />
        </Card>

        {/* Booking Details Modal */}
        <Modal
          title={<span className="text-blue-900">Booking Details</span>}
          open={!!selectedBooking}
          onCancel={() => {
            setSelectedBooking(null);
            setRescheduleForm({ date: null, time: null });
          }}
          footer={null}
          width={800}
          className="booking-details-modal"
        >
          {selectedBooking && (
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-blue-900">
                    Booking #{selectedBooking._id?.slice(-8) || 'N/A'}
                  </h3>
                  <p className="text-gray-500">
                    Created on {dayjs(selectedBooking.createdAt).format('DD MMM YYYY hh:mm A')}
                  </p>
                </div>
                <Tag
                  color={
                    selectedBooking.status === 'pending' ? 'orange' :
                      selectedBooking.status === 'accepted' ? 'blue' :
                        selectedBooking.status === 'completed' ? 'green' : 'red'
                  }
                  className="capitalize"
                >
                  {selectedBooking.status}
                </Tag>
              </div>

              <Divider className="my-2" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Customer Section */}
                <div>
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
                    <User  className="w-5 h-5 text-blue-600 mr-2" />
                    Customer Details
                  </h4>
                  <Descriptions column={1} size="small" className="custom-descriptions">
                    <Descriptions.Item label="Name">
                      <span className="font-medium">{selectedBooking.customer?.name || 'N/A'}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Contact">
                      <div className="flex items-center">
                        <Phone className="w-4 h-4 text-blue-600 mr-2" />
                        <span>{selectedBooking.customer?.phone || 'N/A'}</span>
                      </div>
                    </Descriptions.Item>
                    <Descriptions.Item label="Email">
                      <div className="flex items-center">
                        <Mail className="w-4 h-4 text-blue-600 mr-2" />
                        <span>{selectedBooking.customer?.email || 'N/A'}</span>
                      </div>
                    </Descriptions.Item>
                  </Descriptions>
                </div>

                {/* Service Section */}
                <div>
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
                    <Briefcase className="w-5 h-5 text-blue-600 mr-2" />
                    Service Details
                  </h4>
                  <Descriptions column={1} size="small" className="custom-descriptions">
                    <Descriptions.Item label="Service">
                      <span className="font-medium">{selectedBooking.service?.title || 'N/A'}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Category">
                      {selectedBooking.service?.category || 'N/A'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Amount">
                      <span className="font-medium">₹{(selectedBooking.invoice?.totalAmount || 0).toFixed(2)}</span>
                    </Descriptions.Item>
                  </Descriptions>
                </div>

                {/* Schedule Section */}
                <div>
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
                    <Calendar className="w-5 h-5 text-blue-600 mr-2" />
                    Schedule
                  </h4>
                  <Descriptions column={1} size="small" className="custom-descriptions">
                    <Descriptions.Item label="Date">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 text-blue-600 mr-2" />
                        {selectedBooking.date ? dayjs(selectedBooking.date).format('DD MMM YYYY') : 'N/A'}
                      </div>
                    </Descriptions.Item>
                    <Descriptions.Item label="Time">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 text-blue-600 mr-2" />
                        {selectedBooking.time || 'Not specified'}
                      </div>
                    </Descriptions.Item>
                  </Descriptions>
                </div>

                {/* Location Section */}
                <div>
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
                    <MapPin className="w-5 h-5 text-blue-600 mr-2" />
                    Location
                  </h4>
                  <Descriptions column={1} size="small" className="custom-descriptions">
                    <Descriptions.Item label="Address">
                      <div className="flex items-start">
                        <MapPin className="w-4 h-4 text-blue-600 mr-2 mt-1" />
                        <div>
                          <div>{selectedBooking.address?.street || 'N/A'}</div>
                          <div>{selectedBooking.address?.city || 'N/A'}, {selectedBooking.address?.state || ''}</div>
                          <div>{selectedBooking.address?.postalCode || ''}, {selectedBooking.address?.country || ''}</div>
                        </div>
                      </div>
                    </Descriptions.Item>
                  </Descriptions>
                </div>
              </div>

              {/* Provider Assignment Section */}
              {selectedBooking.status === 'pending' && (
                <div className="mt-6">
                  <Divider orientation="left" className="text-blue-900 font-medium">
                    Assign Provider
                  </Divider>

                  {assignedProvider ? (
                    <div className="p-4 border border-green-200 rounded-lg bg-green-50">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-medium text-green-800">Provider Assigned Successfully</h5>
                        <CheckCircleOutlined className="text-green-500" />
                      </div>
                      <div className="flex items-center">
                        <Avatar
                          src={assignedProvider.profilePicUrl}
                          icon={<User Outlined />}
                          size="large"
                          className="mr-3 bg-blue-100 text-blue-600"
                        />
                        <div>
                          <div className="font-medium">{assignedProvider.name}</div>
                          <div className="text-sm text-gray-600">
                            <Phone className="w-3 h-3 inline mr-1" /> {assignedProvider.phone}
                          </div>
                          <div className="text-sm text-gray-600">
                            <Home className="w-3 h-3 inline mr-1" /> {assignedProvider.address?.city}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4">
                      <Select
                        showSearch
                        style={{ width: '100%' }}
                        placeholder="Search and select a provider"
                        optionFilterProp="children"
                        onChange={assignProvider}
                        loading={assignLoading}
                        filterOption={(input, option) =>
                          option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                        }
                        notFoundContent={
                          <div className="p-4 text-center text-gray-500">
                            {providers.length === 0 ? 'No providers found in this area' : 'No matches found'}
                          </div>
                        }
                        dropdownRender={menu => (
                          <div>
                            <div className="p-2 border-b border-gray-200 text-sm text-gray-500">
                              Available providers in {selectedBooking.address?.city || 'selected area'}
                            </div>
                            {menu}
                          </div>
                        )}
                      >
                        {providers.map(provider => (
                          <Option key={provider._id} value={provider._id}>
                            <div className="flex items-center">
                              <Avatar
                                src={provider.profilePicUrl}
                                icon={<User Outlined />}
                                size="small"
                                className="mr-3 bg-blue-100 text-blue-600"
                              />
                              <div className="flex-1">
                                <div className="font-medium flex items-center justify-between">
                                  <span>{provider.name}</span>
                                  <Rate
                                    disabled
                                    value={provider.rating || 0}
                                    character={<Star className="w-3 h-3" />}
                                    className="text-xs ml-2"
                                  />
                                </div>
                                <div className="text-xs text-gray-500 flex items-center">
                                  <Phone className="w-3 h-3 mr-1" /> {provider.phone}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center">
                                  <Home className="w-3 h-3 mr-1" /> {provider.address?.city}
                                </div>
                              </div>
                            </div>
                          </Option>
                        ))}
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {/* Reschedule Section */}
              {selectedBooking.status !== 'completed' && selectedBooking.status !== 'cancelled' && (
                <div className="mt-6">
                  <Divider orientation="left" className="text-blue-900 font-medium">
                    Reschedule Booking
                  </Divider>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">New Date</label>
                      <DatePicker
                        className="w-full"
                        value={rescheduleForm.date}
                        onChange={(date) => setRescheduleForm(prev => ({ ...prev, date }))}
                        disabledDate={(current) => current && current < dayjs().startOf('day')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">New Time</label>
                      <TimePicker
                        className="w-full"
                        value={rescheduleForm.time}
                        onChange={(time) => setRescheduleForm(prev => ({ ...prev, time }))}
                        format="HH:mm"
                      />
                    </div>
                  </div>

                  <Button
                    type="primary"
                    onClick={handleRescheduleSubmit}
                    loading={rescheduleLoading}
                    className="bg-blue -600 hover:bg-blue-700"
                  >
                    Update Schedule
                  </Button>
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default AdminBookingsPage;