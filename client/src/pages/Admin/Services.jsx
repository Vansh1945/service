import { useState, useEffect } from 'react'
import { useAuth } from '../../store/auth'
import { Plus, Edit, Trash2, Upload, Download, X, Check, Clock, DollarSign, Image as ImageIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import * as XLSX from 'xlsx'

const AdminServices = () => {
  const { API, isAdmin, logoutUser, showToast } = useAuth()
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false)
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false)
  const [currentService, setCurrentService] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewImage, setPreviewImage] = useState('')

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    category: 'Electrical',
    description: '',
    basePrice: '',
    duration: '',
    image: null,
    isActive: true
  })

  const categories = ['Electrical', 'AC', 'Appliance Repair', 'Other']

  useEffect(() => {
    if (isAdmin) {
      fetchServices()
    } else {
      logoutUser()
    }
  }, [isAdmin])

  const fetchServices = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API}/service/admin/services`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      const data = await response.json()
      if (data.success) {
        setServices(data.data)
      } else {
        showToast('Failed to fetch services', 'error')
      }
    } catch (error) {
      showToast('Error fetching services', 'error')
      } finally {
        setLoading(false)
      }
  }

  const handleCreateService = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      const formPayload = new FormData()
      formPayload.append('title', formData.title)
      formPayload.append('category', formData.category)
      formPayload.append('description', formData.description)
      formPayload.append('basePrice', formData.basePrice)
      formPayload.append('duration', formData.duration)
      formPayload.append('isActive', formData.isActive)
      if (formData.image) {
        formPayload.append('image', formData.image)
      }

      const response = await fetch(`${API}/service/admin/services`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formPayload
      })

      const data = await response.json()
      if (data.success) {
        showToast('Service created successfully')
        setIsCreateModalOpen(false)
        resetForm()
        fetchServices()
      } else {
        showToast(data.message || 'Failed to create service', 'error')
      }
    } catch (error) {
      showToast('Error creating service', 'error')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateService = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      const formPayload = new FormData()
      formPayload.append('title', formData.title)
      formPayload.append('category', formData.category)
      formPayload.append('description', formData.description)
      formPayload.append('duration', formData.duration)
      formPayload.append('isActive', formData.isActive)
      if (formData.image) {
        formPayload.append('image', formData.image)
      }

      const response = await fetch(`${API}/service/admin/service/${currentService._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formPayload
      })

      const data = await response.json()
      if (data.success) {
        showToast('Service updated successfully')
        setIsEditModalOpen(false)
        resetForm()
        fetchServices()
      } else {
        showToast(data.message || 'Failed to update service', 'error')
      }
    } catch (error) {
      showToast('Error updating service', 'error')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePrice = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      const response = await fetch(`${API}/service/admin/services/${currentService._id}/price`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ basePrice: formData.basePrice })
      })

      const data = await response.json()
      if (data.success) {
        showToast('Base price updated successfully')
        setIsPriceModalOpen(false)
        resetForm()
        fetchServices()
      } else {
        showToast(data.message || 'Failed to update price', 'error')
      }
    } catch (error) {
      showToast('Error updating price', 'error')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteService = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this service?')) return
    
    try {
      setLoading(true)
      const response = await fetch(`${API}/service/admin/services/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      const data = await response.json()
      if (data.success) {
        showToast('Service deactivated successfully')
        fetchServices()
      } else {
        showToast(data.message || 'Failed to deactivate service', 'error')
      }
    } catch (error) {
      showToast('Error deactivating service', 'error')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBulkImport = async (e) => {
    e.preventDefault()
    try {
      if (!selectedFile) {
        showToast('Please select a file', 'error')
        return
      }

      setLoading(true)
      const formPayload = new FormData()
      formPayload.append('servicesFile', selectedFile)

      const response = await fetch(`${API}/service/admin/bulk-import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formPayload
      })

      const data = await response.json()
      if (data.success) {
        showToast(`Successfully imported ${data.importedCount} services`)
        setIsBulkImportModalOpen(false)
        setSelectedFile(null)
        fetchServices()
      } else {
        showToast(data.message || 'Bulk import failed', 'error')
      }
    } catch (error) {
      showToast('Error during bulk import', 'error')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    const templateData = [
      ['title', 'category', 'description', 'basePrice', 'duration'],
      ['LED Light Installation', 'Electrical', 'Professional LED light installation', '500', '1'],
      ['AC Servicing', 'AC', 'Complete AC maintenance service', '800', '2']
    ]

    const ws = XLSX.utils.aoa_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Services')
    XLSX.writeFile(wb, 'services_template.xlsx')
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    setSelectedFile(file)
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setFormData({ ...formData, image: file })
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewImage(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      category: 'Electrical',
      description: '',
      basePrice: '',
      duration: '',
      image: null,
      isActive: true
    })
    setPreviewImage('')
  }

  const openEditModal = (service) => {
    setCurrentService(service)
    setFormData({
      title: service.title,
      category: service.category,
      description: service.description,
      basePrice: service.basePrice,
      duration: service.duration,
      image: null,
      isActive: service.isActive
    })
    setPreviewImage(service.image ? `${API}/uploads/services/${service.image}` : '')
    setIsEditModalOpen(true)
  }

  const openPriceModal = (service) => {
    setCurrentService(service)
    setFormData({
      ...formData,
      basePrice: service.basePrice
    })
    setIsPriceModalOpen(true)
  }

  const getCategoryColor = (category) => {
    switch (category) {
      case 'Electrical': return 'bg-blue-600 text-white'
      case 'AC': return 'bg-cyan-600 text-white'
      case 'Appliance Repair': return 'bg-purple-600 text-white'
      default: return 'bg-gray-600 text-white'
    }
  }

  const formatDuration = (duration) => {
    const hours = Math.floor(duration)
    const minutes = Math.round((duration - hours) * 60)
    return `${hours > 0 ? `${hours}h` : ''} ${minutes > 0 ? `${minutes}m` : ''}`.trim()
  }

  return (
    <div className="min-h-screen bg-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-blue-900">Services Management</h1>
          <div className="flex space-x-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-md"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="mr-2" size={18} />
              Add Service
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg shadow-md"
              onClick={() => setIsBulkImportModalOpen(true)}
            >
              <Upload className="mr-2" size={18} />
              Bulk Import
            </motion.button>
          </div>
        </div>

        {/* Services Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {loading && services.length === 0 ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading services...</p>
            </div>
          ) : services.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-600">No services found. Create your first service!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-blue-900 text-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Service</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Duration</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {services.map((service) => (
                    <tr key={service._id} className="hover:bg-blue-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            {service.image ? (
                              <img
                                className="h-10 w-10 rounded-full object-cover"
                                src={`${API}/uploads/services/${service.image}`}
                                alt={service.title}
                                onError={(e) => {
                                  e.target.onerror = null
                                  e.target.src = `${API}/uploads/${service.image}`
                                }}
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <ImageIcon className="text-gray-400" size={20} />
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{service.title}</div>
                            <div className="text-sm text-gray-500 line-clamp-1">{service.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(service.category)}`}>
                          {service.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <span className="mr-1">₹</span>
                          {service.basePrice.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <Clock className="text-gray-500 mr-1" size={14} />
                          {formatDuration(service.duration)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {service.isActive ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 flex items-center">
                            <Check className="mr-1" size={12} />
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 flex items-center">
                            <X className="mr-1" size={12} />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openEditModal(service)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteService(service._id)}
                            className="text-red-600 hover:text-red-900"
                            title="Deactivate"
                          >
                            <Trash2 size={18} />
                          </button>
                          <button
                            onClick={() => openPriceModal(service)}
                            className="text-yellow-500 hover:text-yellow-700"
                            title="Update Price"
                          >
                            <DollarSign size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Service Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
          resetForm()
        }}
        title="Create New Service"
      >
        <form onSubmit={handleCreateService}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={formData.basePrice}
                  onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (hours)</label>
                <input
                  type="number"
                  min="0.25"
                  step="0.25"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service Image</label>
              <div className="mt-1 flex items-center">
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt="Preview"
                    className="h-16 w-16 rounded-md object-cover mr-4"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-md bg-gray-200 flex items-center justify-center mr-4">
                    <ImageIcon className="text-gray-400" size={24} />
                  </div>
                )}
                <label className="cursor-pointer">
                  <span className="px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600">
                    Upload
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleImageChange}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
              onClick={() => {
                setIsCreateModalOpen(false)
                resetForm()
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Service'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Service Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          resetForm()
        }}
        title={`Edit ${currentService?.title || 'Service'}`}
      >
        {currentService && (
          <form onSubmit={handleUpdateService}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (hours)</label>
                  <input
                    type="number"
                    min="0.25"
                    step="0.25"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                    value={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Image</label>
                <div className="mt-1 flex items-center">
                  {previewImage ? (
                    <img
                      src={previewImage}
                      alt="Preview"
                      className="h-16 w-16 rounded-md object-cover mr-4"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-md bg-gray-200 flex items-center justify-center mr-4">
                      <ImageIcon className="text-gray-400" size={24} />
                    </div>
                  )}
                  <label className="cursor-pointer">
                    <span className="px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600">
                      Change
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleImageChange}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
                onClick={() => {
                  setIsEditModalOpen(false)
                  resetForm()
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Update Service'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Update Price Modal */}
      <Modal
        isOpen={isPriceModalOpen}
        onClose={() => {
          setIsPriceModalOpen(false)
          resetForm()
        }}
        title={`Update Price for ${currentService?.title || 'Service'}`}
      >
        {currentService && (
          <form onSubmit={handleUpdatePrice}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Base Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={formData.basePrice}
                  onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                  required
                />
              </div>

              <div className="bg-blue-50 p-4 rounded-md">
                <h3 className="text-sm font-medium text-blue-800 mb-2">Provider Price Range</h3>
                <p className="text-sm text-gray-600">
                  Providers will be able to set prices between:
                  <br />
                  <span className="font-semibold">
                    ₹{(formData.basePrice * 0.9).toFixed(2)} to ₹{(formData.basePrice * 1.1).toFixed(2)}
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
                onClick={() => {
                  setIsPriceModalOpen(false)
                  resetForm()
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Update Price'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Bulk Import Modal */}
      <Modal
        isOpen={isBulkImportModalOpen}
        onClose={() => {
          setIsBulkImportModalOpen(false)
          setSelectedFile(null)
        }}
        title="Bulk Import Services"
      >
        <form onSubmit={handleBulkImport}>
          <div className="space-y-4">
            <div>
              <button
                type="button"
                onClick={downloadTemplate}
                className="flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                <Download className="mr-2" size={16} />
                Download Template
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Excel File</label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                    >
                      <span>Upload a file</span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        accept=".xlsx,.xls"
                        className="sr-only"
                        onChange={handleFileChange}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    Excel files only (.xlsx, .xls)
                  </p>
                  {selectedFile && (
                    <p className="text-sm text-gray-900 mt-2">
                      Selected: {selectedFile.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-md">
              <h3 className="text-sm font-medium text-yellow-800 mb-2">Instructions</h3>
              <ul className="text-xs text-yellow-700 list-disc pl-5 space-y-1">
                <li>Use the template to ensure proper formatting</li>
                <li>Required fields: Title, Category, Description, Base Price, Duration</li>
                <li>Category must be one of: {categories.join(', ')}</li>
                <li>Duration should be in hours (e.g., 1.5 for 1 hour 30 minutes)</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
              onClick={() => {
                setIsBulkImportModalOpen(false)
                setSelectedFile(null)
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              disabled={!selectedFile || loading}
            >
              {loading ? 'Importing...' : 'Import Services'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// Reusable Modal Component
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">{title}</h3>
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminServices