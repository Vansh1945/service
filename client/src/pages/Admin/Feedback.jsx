import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { Table, Card, Typography, Rate, Tag, Space, Input, Select, Statistic, Row, Col, Spin, Alert, Button, Modal, Divider } from 'antd';
import { SearchOutlined, StarOutlined, FilterOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
const { Option } = Select;

const AdminServiceFeedback = () => {
  const { API, isAdmin, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [ratingFilter, setRatingFilter] = useState(null);
  const [serviceFilter, setServiceFilter] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      logoutUser();
      return;
    }
    fetchAllFeedbacks();
    fetchServices();
  }, []);

  const fetchAllFeedbacks = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API}/feedback/admin/all-feedbacks`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch feedbacks');
      }

      setFeedbacks(data.feedbacks || []);
      calculateStats(data.feedbacks || []);
    } catch (err) {
      setError(err.message || 'Error connecting to server');
      console.error('Error fetching feedbacks:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchServiceFeedbacks = async (serviceId) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API}/feedback/admin/service/${serviceId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch service feedbacks');
      }

      setFeedbacks(data.feedbacks || []);
      calculateStats(data.feedbacks || []);
    } catch (err) {
      setError(err.message || 'Error fetching service feedbacks');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      const response = await fetch(`${API}/service/admin/services`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setServices(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching services:', err);
    }
  };

  const calculateStats = (feedbackData) => {
    if (!feedbackData || feedbackData.length === 0) {
      setStats(null);
      return;
    }

    const totalRatings = feedbackData.reduce((sum, fb) => sum + (fb.rating || 0), 0);
    const averageRating = totalRatings / feedbackData.length;
    const ratingCounts = [0, 0, 0, 0, 0];
    
    feedbackData.forEach(fb => {
      if (fb.rating && fb.rating >= 1 && fb.rating <= 5) {
        ratingCounts[fb.rating - 1]++;
      }
    });

    setStats({
      averageRating,
      totalFeedbacks: feedbackData.length,
      ratingDistribution: ratingCounts
    });
  };

  const filteredFeedbacks = (feedbacks || []).filter(feedback => {
    const matchesSearch = 
      (feedback.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (feedback.provider?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (feedback.comment || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRating = ratingFilter ? feedback.rating === ratingFilter : true;
    const matchesService = serviceFilter ? feedback.service?._id === serviceFilter : true;
    
    return matchesSearch && matchesRating && matchesService;
  });

  const handleResetFilters = () => {
    setSearchTerm('');
    setRatingFilter(null);
    setServiceFilter(null);
    fetchAllFeedbacks();
  };

  const showFeedbackDetails = (feedback) => {
    setSelectedFeedback(feedback);
    setDetailModalVisible(true);
  };

  const columns = [
    {
      title: 'Customer',
      dataIndex: ['customer', 'name'],
      key: 'customer',
      render: (name, record) => (
        <Button type="link" onClick={() => showFeedbackDetails(record)}>
          {name || 'N/A'}
        </Button>
      )
    },
    {
      title: 'Provider',
      dataIndex: ['provider', 'name'],
      key: 'provider',
      render: (name) => name || 'N/A'
    },
    {
      title: 'Service',
      dataIndex: ['service', 'title'],
      key: 'service',
      render: (title) => title || 'N/A'
    },
    {
      title: 'Rating',
      dataIndex: 'rating',
      key: 'rating',
      render: (rating) => (
        <Rate 
          disabled 
          value={rating || 0} 
          style={{ fontSize: 16 }} 
        />
      ),
      sorter: (a, b) => (a.rating || 0) - (b.rating || 0)
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'date',
      render: (date) => date ? new Date(date).toLocaleDateString() : 'N/A',
      sorter: (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => {
        const rating = record.rating || 0;
        return (
          <Tag color={rating >= 4 ? 'green' : rating >= 3 ? 'orange' : 'red'}>
            {rating >= 4 ? 'Positive' : rating >= 3 ? 'Neutral' : 'Negative'}
          </Tag>
        );
      }
    }
  ];

  if (loading && feedbacks.length === 0) {
    return (
      <Card style={{ margin: 20 }}>
        <Spin size="large" />
        <Text>Loading feedback data...</Text>
      </Card>
    );
  }

  if (error) {
    return (
      <Card style={{ margin: 20 }}>
        <Alert message="Error" description={error} type="error" showIcon />
        <Button style={{ marginTop: 16 }} onClick={fetchAllFeedbacks}>
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>Customer Feedback Management</Title>
      <Text type="secondary">Monitor and analyze customer feedback across all services</Text>

      {stats && (
        <Card style={{ margin: '20px 0' }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic 
                title="Average Rating" 
                value={stats.averageRating.toFixed(1)} 
                prefix={<StarOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic title="Total Feedbacks" value={stats.totalFeedbacks} />
            </Col>
            <Col span={12}>
              <div>
                <Text strong>Rating Distribution:</Text>
                <div style={{ marginTop: 8 }}>
                  {stats.ratingDistribution.map((count, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                      <Rate 
                        disabled 
                        value={5 - index} 
                        style={{ fontSize: 14, marginRight: 8 }} 
                        count={1}
                      />
                      <Text>{count} feedback(s)</Text>
                    </div>
                  ))}
                </div>
              </div>
            </Col>
          </Row>
        </Card>
      )}

      <Card
        title="Feedback List"
        extra={
          <Button 
            icon={<FilterOutlined />} 
            onClick={handleResetFilters}
            disabled={!searchTerm && !ratingFilter && !serviceFilter}
          >
            Clear Filters
          </Button>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <Space size="large">
            <Input
              placeholder="Search feedbacks..."
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: 250 }}
            />
            <Select
              placeholder="Filter by rating"
              allowClear
              value={ratingFilter}
              onChange={(value) => setRatingFilter(value)}
              style={{ width: 150 }}
            >
              <Option value={5}>5 Stars</Option>
              <Option value={4}>4 Stars</Option>
              <Option value={3}>3 Stars</Option>
              <Option value={2}>2 Stars</Option>
              <Option value={1}>1 Star</Option>
            </Select>
            <Select
              placeholder="Filter by service"
              allowClear
              value={serviceFilter}
              onChange={(value) => {
                setServiceFilter(value);
                if (value) {
                  fetchServiceFeedbacks(value);
                } else {
                  fetchAllFeedbacks();
                }
              }}
              style={{ width: 200 }}
            >
              {services.map(service => (
                <Option key={service._id} value={service._id}>
                  {service.title || 'Untitled Service'}
                </Option>
              ))}
            </Select>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={filteredFeedbacks}
          rowKey="_id"
          pagination={{ pageSize: 10 }}
          bordered
          scroll={{ x: true }}
          locale={{ emptyText: 'No feedback data available' }}
        />
      </Card>

      <Modal
        title="Feedback Details"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedFeedback && (
          <div>
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ marginBottom: 16 }}>
                  <Text strong>Customer:</Text>
                  <div>{selectedFeedback.customer?.name || 'N/A'}</div>
                  <Text type="secondary">{selectedFeedback.customer?.email || ''}</Text>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 16 }}>
                  <Text strong>Provider:</Text>
                  <div>{selectedFeedback.provider?.name || 'N/A'}</div>
                  <Text type="secondary">{selectedFeedback.provider?.email || ''}</Text>
                </div>
              </Col>
            </Row>

            <Divider />

            <div style={{ marginBottom: 16 }}>
              <Text strong>Service:</Text>
              <div>{selectedFeedback.service?.title || 'N/A'}</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>Booking Date:</Text>
              <div>{selectedFeedback.booking?.date ? new Date(selectedFeedback.booking.date).toLocaleDateString() : 'N/A'}</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>Rating:</Text>
              <div>
                <Rate 
                  disabled 
                  value={selectedFeedback.rating || 0} 
                  style={{ fontSize: 18 }} 
                />
                <Text style={{ marginLeft: 8 }}>
                  {(selectedFeedback.rating || 0)} star{(selectedFeedback.rating !== 1 ? 's' : '')}
                </Text>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>Comment:</Text>
              <div style={{ 
                padding: 12, 
                backgroundColor: '#f5f5f5', 
                borderRadius: 4,
                marginTop: 8
              }}>
                {selectedFeedback.comment || 'No comment provided'}
              </div>
            </div>

            <div>
              <Text strong>Submitted:</Text>
              <div>{selectedFeedback.createdAt ? new Date(selectedFeedback.createdAt).toLocaleString() : 'N/A'}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminServiceFeedback;