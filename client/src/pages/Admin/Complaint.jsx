import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { Modal, Table, Button, Tag, message, Card, Space, Input, Form, Typography, Divider } from 'antd';
import { ExclamationCircleOutlined, CheckOutlined, SyncOutlined, SearchOutlined } from '@ant-design/icons';
const { Text } = Typography;
const { confirm } = Modal;

const AdminComplaints = () => {
  const { API, isAdmin, logoutUser, showToast } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  useEffect(() => {
    if (!isAdmin) {
      logoutUser();
      return;
    }
    fetchComplaints();
  }, [isAdmin]);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/complaint/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setComplaints(data.complaints);
      } else {
        showToast(data.message || 'Failed to fetch complaints', 'error');
      }
    } catch (error) {
      showToast('Error fetching complaints', 'error');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveComplaint = async (values) => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/complaint/complaints/${selectedComplaint._id}/resolve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ response: values.response })
      });

      const data = await response.json();
      if (data.success) {
        showToast('Complaint resolved successfully');
        setResolveModalVisible(false);
        form.resetFields();
        fetchComplaints();
      } else {
        showToast(data.message || 'Failed to resolve complaint', 'error');
      }
    } catch (error) {
      showToast('Error resolving complaint', 'error');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReopenComplaint = (complaint) => {
    confirm({
      title: 'Are you sure you want to reopen this complaint?',
      icon: <ExclamationCircleOutlined />,
      content: 'This will change the status back to "open" and notify the provider.',
      onOk: async () => {
        try {
          setLoading(true);
          const response = await fetch(`${API}/complaint/complaints/${complaint._id}/reopen`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });

          const data = await response.json();
          if (data.success) {
            showToast('Complaint reopened successfully');
            fetchComplaints();
          } else {
            showToast(data.message || 'Failed to reopen complaint', 'error');
          }
        } catch (error) {
          showToast('Error reopening complaint', 'error');
          console.error('Error:', error);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const filteredComplaints = complaints.filter(complaint => {
    const searchStr = searchText.toLowerCase();
    return (
      complaint.customer?.name?.toLowerCase().includes(searchStr) ||
      complaint.provider?.name?.toLowerCase().includes(searchStr) ||
      complaint.message?.toLowerCase().includes(searchStr) ||
      complaint._id.toLowerCase().includes(searchStr)
    );
  });

  const columns = [
    {
      title: 'ID',
      dataIndex: '_id',
      key: '_id',
      render: (id) => <Text copyable>{id.substring(0, 8)}...</Text>
    },
    {
      title: 'Customer',
      dataIndex: ['customer', 'name'],
      key: 'customer',
      render: (name, record) => (
        <div>
          <div>{name}</div>
          <div style={{ fontSize: 12, color: '#666' }}>{record.customer?.email}</div>
        </div>
      )
    },
    {
      title: 'Provider',
      dataIndex: ['provider', 'name'],
      key: 'provider',
      render: (name, record) => (
        <div>
          <div>{name}</div>
          <div style={{ fontSize: 12, color: '#666' }}>{record.provider?.email}</div>
        </div>
      )
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      render: (text) => <Text ellipsis={{ tooltip: text }}>{text.substring(0, 50)}...</Text>
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'open' ? 'orange' : 'green'}>
          {status.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleString()
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="middle">
          {record.status === 'open' ? (
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => {
                setSelectedComplaint(record);
                setResolveModalVisible(true);
              }}
            >
              Resolve
            </Button>
          ) : (
            <Button
              icon={<SyncOutlined />}
              onClick={() => handleReopenComplaint(record)}
            >
              Reopen
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div className="admin-complaints-dashboard">
      <Card
        title="Complaints Management"
        extra={
          <Input
            placeholder="Search complaints..."
            prefix={<SearchOutlined />}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
          />
        }
      >
        <Table
          columns={columns}
          dataSource={filteredComplaints}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ margin: 0 }}>
                <Divider orientation="left">Complaint Details</Divider>
                <p><strong>Full Message:</strong> {record.message}</p>
                {record.imageProof && (
                  <div>
                    <strong>Image Proof:</strong>
                    <img 
                      src={record.imageProof} 
                      alt="Complaint proof" 
                      style={{ maxWidth: 200, maxHeight: 200, display: 'block', marginTop: 8 }}
                    />
                  </div>
                )}
                {record.status === 'resolved' && (
                  <div style={{ marginTop: 16 }}>
                    <Divider orientation="left">Resolution Details</Divider>
                    <p><strong>Admin Response:</strong> {record.adminResponse}</p>
                    <p><strong>Resolved At:</strong> {new Date(record.resolvedAt).toLocaleString()}</p>
                  </div>
                )}
              </div>
            ),
            rowExpandable: (record) => true,
          }}
        />
      </Card>

      {/* Resolve Complaint Modal */}
      <Modal
        title={`Resolve Complaint #${selectedComplaint?._id.substring(0, 8)}`}
        open={resolveModalVisible}
        onCancel={() => {
          setResolveModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleResolveComplaint}
          initialValues={{ response: '' }}
        >
          <Form.Item
            name="response"
            label="Resolution Response"
            rules={[
              { required: true, message: 'Please enter your response' },
              { min: 20, message: 'Response must be at least 20 characters' }
            ]}
          >
            <Input.TextArea rows={4} placeholder="Enter detailed resolution response..." />
          </Form.Item>

          <div style={{ marginTop: 24 }}>
            <p><strong>Customer:</strong> {selectedComplaint?.customer?.name}</p>
            <p><strong>Provider:</strong> {selectedComplaint?.provider?.name}</p>
            <p><strong>Original Complaint:</strong> {selectedComplaint?.message}</p>
          </div>

          <Form.Item style={{ marginTop: 24 }}>
            <Button type="primary" htmlType="submit" loading={loading}>
              Submit Resolution
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminComplaints;