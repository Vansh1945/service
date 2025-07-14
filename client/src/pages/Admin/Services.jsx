import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Modal, Button, Table, Form, Input, Select, Upload, Space, Tag, Divider, Card, Row, Col } from 'antd';
import { UploadOutlined, EditOutlined, DeleteOutlined, PlusOutlined, DownloadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';

const { Option } = Select;
const { TextArea } = Input;

const AdminServices = () => {
  const { API, isAdmin, logoutUser, showToast } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [bulkImportModalVisible, setBulkImportModalVisible] = useState(false);
  const [currentService, setCurrentService] = useState(null);
  const [fileList, setFileList] = useState([]);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [priceForm] = Form.useForm();

  const categories = ['Electrical', 'AC', 'Appliance Repair', 'Other'];

  useEffect(() => {
    if (isAdmin) {
      fetchServices();
    } else {
      logoutUser();
    }
  }, [isAdmin]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/service/admin/services`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setServices(data.data);
      } else {
        showToast('Failed to fetch services', 'error');
      }
    } catch (error) {
      showToast('Error fetching services', 'error');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateService = async (values) => {
    try {
      setLoading(true);
      const formData = new FormData();
      Object.keys(values).forEach(key => {
        if (key !== 'image' && values[key] !== undefined) {
          formData.append(key, values[key]);
        }
      });
      if (values.image && values.image.file) {
        formData.append('image', values.image.file.originFileObj);
      }

      const response = await fetch(`${API}/service/admin/services`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        showToast('Service created successfully');
        setModalVisible(false);
        form.resetFields();
        fetchServices();
      } else {
        showToast(data.message || 'Failed to create service', 'error');
      }
    } catch (error) {
      showToast('Error creating service', 'error');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateService = async (values) => {
    try {
      setLoading(true);
      const formData = new FormData();
      Object.keys(values).forEach(key => {
        if (key !== 'image' && values[key] !== undefined) {
          formData.append(key, values[key]);
        }
      });
      if (values.image && values.image.file) {
        formData.append('image', values.image.file.originFileObj);
      }

      const response = await fetch(`${API}/service/admin/services/${currentService._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        showToast('Service updated successfully');
        setEditModalVisible(false);
        editForm.resetFields();
        fetchServices();
      } else {
        showToast(data.message || 'Failed to update service', 'error');
      }
    } catch (error) {
      showToast('Error updating service', 'error');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrice = async (values) => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/service/admin/services/${currentService._id}/price`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ basePrice: values.basePrice })
      });

      const data = await response.json();
      if (data.success) {
        showToast('Base price updated successfully');
        setPriceModalVisible(false);
        priceForm.resetFields();
        fetchServices();
      } else {
        showToast(data.message || 'Failed to update price', 'error');
      }
    } catch (error) {
      showToast('Error updating price', 'error');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteService = async (id) => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/service/admin/services/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        showToast('Service deactivated successfully');
        fetchServices();
      } else {
        showToast(data.message || 'Failed to delete service', 'error');
      }
    } catch (error) {
      showToast('Error deleting service', 'error');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkImport = async () => {
    try {
      if (fileList.length === 0) {
        showToast('Please select a file', 'error');
        return;
      }

      setLoading(true);
      const formData = new FormData();
      formData.append('servicesFile', fileList[0].originFileObj);

      const response = await fetch(`${API}/service/bulk-import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        showToast(`Successfully imported ${data.importedCount} services`);
        setBulkImportModalVisible(false);
        setFileList([]);
        fetchServices();
      } else {
        showToast(data.message || 'Bulk import failed', 'error');
      }
    } catch (error) {
      showToast('Error during bulk import', 'error');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      ['title', 'category', 'description', 'basePrice', 'duration'],
      ['LED Light Installation', 'Electrical', 'Professional LED light installation', '500', '1'],
      ['AC Servicing', 'AC', 'Complete AC maintenance service', '800', '2']
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Services');
    XLSX.writeFile(wb, 'services_template.xlsx');
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <div className="service-title">
          <img 
            src={`${API}/uploads/${record.image}`} 
            alt={text} 
            style={{ width: 50, height: 50, objectFit: 'cover', marginRight: 10 }}
          />
          {text}
        </div>
      )
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (category) => <Tag color={getCategoryColor(category)}>{category}</Tag>
    },
    {
      title: 'Base Price',
      dataIndex: 'basePrice',
      key: 'basePrice',
      render: (price) => `₹${price.toFixed(2)}`
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      render: (duration) => `${Math.floor(duration)} hr ${Math.round((duration - Math.floor(duration)) * 60)} min`
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            icon={<EditOutlined />} 
            onClick={() => {
              setCurrentService(record);
              editForm.setFieldsValue({
                ...record,
                image: record.image ? { fileList: [{ uid: '-1', name: record.image, status: 'done', url: `${API}/uploads/${record.image}` }] } : null
              });
              setEditModalVisible(true);
            }}
          />
          <Button 
            icon={<DeleteOutlined />} 
            danger 
            onClick={() => handleDeleteService(record._id)}
          />
          <Button 
            type="dashed"
            onClick={() => {
              setCurrentService(record);
              priceForm.setFieldsValue({ basePrice: record.basePrice });
              setPriceModalVisible(true);
            }}
          >
            Update Price
          </Button>
        </Space>
      )
    }
  ];

  const getCategoryColor = (category) => {
    switch (category) {
      case 'Electrical': return 'blue';
      case 'AC': return 'cyan';
      case 'Appliance Repair': return 'purple';
      default: return 'gray';
    }
  };

  const uploadProps = {
    onRemove: file => {
      setFileList([]);
    },
    beforeUpload: file => {
      setFileList([file]);
      return false;
    },
    fileList,
    accept: '.xlsx, .xls'
  };

  return (
    <div className="admin-services-dashboard">
      <Card
        title="Services Management"
        extra={
          <Space>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => setModalVisible(true)}
            >
              Add Service
            </Button>
            <Button 
              icon={<DownloadOutlined />} 
              onClick={() => setBulkImportModalVisible(true)}
            >
              Bulk Import
            </Button>
          </Space>
        }
      >
        <Table 
          columns={columns} 
          dataSource={services} 
          rowKey="_id" 
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Create Service Modal */}
      <Modal
        title="Create New Service"
        visible={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateService}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="title"
                label="Service Title"
                rules={[{ required: true, message: 'Please enter service title' }]}
              >
                <Input placeholder="e.g., AC Repair" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="category"
                label="Category"
                rules={[{ required: true, message: 'Please select category' }]}
              >
                <Select placeholder="Select category">
                  {categories.map(cat => (
                    <Option key={cat} value={cat}>{cat}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please enter description' }]}
          >
            <TextArea rows={4} placeholder="Detailed description of the service" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="basePrice"
                label="Base Price (₹)"
                rules={[{ required: true, message: 'Please enter base price' }]}
              >
                <Input type="number" min="0" step="0.01" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="duration"
                label="Duration (hours)"
                rules={[{ required: true, message: 'Please enter duration' }]}
              >
                <Input type="number" min="0.25" step="0.25" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="image"
            label="Service Image"
            valuePropName="fileList"
            getValueFromEvent={e => e && e.fileList}
          >
            <Upload
              listType="picture"
              beforeUpload={() => false}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>Upload Image</Button>
            </Upload>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              Create Service
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Service Modal */}
      <Modal
        title="Edit Service"
        visible={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          editForm.resetFields();
        }}
        footer={null}
        width={800}
      >
        {currentService && (
          <Form
            form={editForm}
            layout="vertical"
            onFinish={handleUpdateService}
            initialValues={currentService}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="title"
                  label="Service Title"
                  rules={[{ required: true, message: 'Please enter service title' }]}
                >
                  <Input placeholder="e.g., AC Repair" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="category"
                  label="Category"
                  rules={[{ required: true, message: 'Please select category' }]}
                >
                  <Select placeholder="Select category">
                    {categories.map(cat => (
                      <Option key={cat} value={cat}>{cat}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="description"
              label="Description"
              rules={[{ required: true, message: 'Please enter description' }]}
            >
              <TextArea rows={4} placeholder="Detailed description of the service" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="duration"
                  label="Duration (hours)"
                  rules={[{ required: true, message: 'Please enter duration' }]}
                >
                  <Input type="number" min="0.25" step="0.25" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="isActive"
                  label="Status"
                >
                  <Select>
                    <Option value={true}>Active</Option>
                    <Option value={false}>Inactive</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="image"
              label="Service Image"
              valuePropName="fileList"
              getValueFromEvent={e => e && e.fileList}
            >
              <Upload
                listType="picture"
                beforeUpload={() => false}
                maxCount={1}
                defaultFileList={
                  currentService.image ? [{
                    uid: '-1',
                    name: currentService.image,
                    status: 'done',
                    url: `${API}/uploads/${currentService.image}`
                  }] : []
                }
              >
                <Button icon={<UploadOutlined />}>Change Image</Button>
              </Upload>
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>
                Update Service
              </Button>
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Update Price Modal */}
      <Modal
        title={`Update Base Price for ${currentService?.title || 'Service'}`}
        visible={priceModalVisible}
        onCancel={() => {
          setPriceModalVisible(false);
          priceForm.resetFields();
        }}
        footer={null}
      >
        {currentService && (
          <Form
            form={priceForm}
            layout="vertical"
            onFinish={handleUpdatePrice}
          >
            <Form.Item
              name="basePrice"
              label="New Base Price (₹)"
              rules={[{ required: true, message: 'Please enter base price' }]}
            >
              <Input type="number" min="0" step="0.01" />
            </Form.Item>

            <Divider>Provider Price Range</Divider>
            <p>
              Providers will be able to set prices between:<br />
              <strong>₹{(priceForm.getFieldValue('basePrice') * 0.9 || currentService.basePrice * 0.9).toFixed(2)}</strong> and <strong>₹{(priceForm.getFieldValue('basePrice') * 1.1 || currentService.basePrice * 1.1).toFixed(2)}</strong>
            </p>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>
                Update Price
              </Button>
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Bulk Import Modal */}
      <Modal
        title="Bulk Import Services"
        visible={bulkImportModalVisible}
        onCancel={() => {
          setBulkImportModalVisible(false);
          setFileList([]);
        }}
        footer={null}
      >
        <div style={{ marginBottom: 16 }}>
          <Button 
            type="link" 
            icon={<DownloadOutlined />} 
            onClick={downloadTemplate}
          >
            Download Template
          </Button>
        </div>

        <Upload {...uploadProps}>
          <Button icon={<UploadOutlined />}>Select Excel File</Button>
        </Upload>

        <div style={{ marginTop: 24 }}>
          <p><strong>Instructions:</strong></p>
          <ul>
            <li>Use the template to ensure proper formatting</li>
            <li>Required fields: Title, Category, Description, Base Price, Duration</li>
            <li>Category must be one of: {categories.join(', ')}</li>
            <li>Duration should be in hours (e.g., 1.5 for 1 hour 30 minutes)</li>
          </ul>
        </div>

        <Button 
          type="primary" 
          onClick={handleBulkImport}
          disabled={fileList.length === 0}
          loading={loading}
          style={{ marginTop: 16 }}
        >
          Import Services
        </Button>
      </Modal>
    </div>
  );
};

export default AdminServices;