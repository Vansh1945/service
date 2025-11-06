import React, { useState, useEffect, useRef } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Calendar,
  Image as ImageIcon,
  Package,
  ChevronLeft,
  ChevronRight,
  X,
  PauseCircle,
  Download,
  RefreshCw,
  BarChart3,
  TrendingUp,
  Save,
  Upload,
} from "lucide-react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "../../store/auth";

const AdminBanners = () => {
  const { API, token } = useAuth();

  const [banners, setBanners] = useState([]);
  const [filteredBanners, setFilteredBanners] = useState([]);
  const [selectedBanner, setSelectedBanner] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    expired: 0,
  });

  const [createForm, setCreateForm] = useState({
    title: "",
    startDate: "",
    endDate: "",
    isActive: true,
    image: null,
  });
  const [editForm, setEditForm] = useState({});
  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);

  useEffect(() => {
    fetchBanners();
  }, []);

  useEffect(() => {
    let filtered = [...banners];
    if (searchTerm) {
      filtered = filtered.filter((banner) =>
        banner.title?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (statusFilter !== "all") {
      const isActive = statusFilter === "active";
      filtered = filtered.filter((b) => b.isActive === isActive);
    }
    setFilteredBanners(filtered);
  }, [banners, searchTerm, statusFilter]);

  useEffect(() => {
    const now = new Date();
    setStats({
      total: banners.length,
      active: banners.filter((b) => b.isActive && (!b.endDate || new Date(b.endDate) > now)).length,
      inactive: banners.filter((b) => !b.isActive).length,
      expired: banners.filter((b) => b.endDate && new Date(b.endDate) <= now).length,
    });
  }, [banners]);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/banner/admin/banners`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch banners");
      setBanners(data.data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFormChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    setCreateForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : files ? files[0] : value,
    }));
  };

  const handleEditFormChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : files ? files[0] : value,
    }));
  };

  const handleCreateBanner = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      Object.keys(createForm).forEach((key) =>
        formData.append(key, createForm[key])
      );
      const res = await fetch(`${API}/banner/admin/banners`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setBanners((prev) => [data.data, ...prev]);
      toast.success("Banner created successfully!");
      setShowCreateModal(false);
      resetCreateForm();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleUpdateBanner = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      Object.keys(editForm).forEach((key) =>
        formData.append(key, editForm[key])
      );
      const res = await fetch(
        `${API}/banner/admin/banners/${selectedBanner._id}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setBanners((prev) =>
        prev.map((b) => (b._id === data.data._id ? data.data : b))
      );
      toast.success("Banner updated successfully!");
      setShowEditModal(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteBanner = async (id) => {
    if (!window.confirm("Are you sure you want to inactivate this banner?"))
      return;
    try {
      const res = await fetch(`${API}/banner/admin/banners/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      fetchBanners();
      toast.success("Banner deactivated successfully!");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleHardDeleteBanner = async (id) => {
    if (!window.confirm("Are you sure you want to permanently delete this banner? This action cannot be undone."))
      return;
    try {
      const res = await fetch(`${API}/banner/admin/banners/${id}/permanent`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      fetchBanners();
      toast.success("Banner permanently deleted successfully!");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const resetCreateForm = () => {
    setCreateForm({
      title: "",
      startDate: "",
      endDate: "",
      isActive: true,
      image: null,
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleEditClick = (banner) => {
    setSelectedBanner(banner);
    setEditForm({
      title: banner.title,
      startDate: new Date(banner.startDate).toISOString().split("T")[0],
      endDate: banner.endDate ? new Date(banner.endDate).toISOString().split("T")[0] : "",
      isActive: banner.isActive,
      image: null,
    });
    setShowEditModal(true);
  };

  const handleViewClick = (banner) => {
    setSelectedBanner(banner);
    setShowViewModal(true);
  };

  const handleToggleStatus = async (bannerId) => {
    try {
      const banner = banners.find(b => b._id === bannerId);
      if (!banner) return;

      const updatedIsActive = !banner.isActive;
      const formData = new FormData();
      formData.append('title', banner.title);
      formData.append('startDate', new Date(banner.startDate).toISOString().split("T")[0]);
      formData.append('endDate', banner.endDate ? new Date(banner.endDate).toISOString().split("T")[0] : "");
      formData.append('isActive', updatedIsActive);

      const res = await fetch(`${API}/banner/admin/banners/${bannerId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setBanners((prev) =>
        prev.map((b) => (b._id === data.data._id ? data.data : b))
      );
      setSelectedBanner(data.data); // Update selected banner in modal
      toast.success(`Banner ${updatedIsActive ? 'activated' : 'deactivated'} successfully!`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const formatDate = (date) =>
    new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const isExpired = (endDate) => endDate && new Date(endDate) < new Date();

  const indexOfLast = currentPage * itemsPerPage;
  const current = filteredBanners.slice(indexOfLast - itemsPerPage, indexOfLast);
  const totalPages = Math.ceil(filteredBanners.length / itemsPerPage);

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-secondary">Banner Management</h1>
            <p className="text-gray-600 mt-1">Manage promotional banners and advertisements</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <button
              onClick={fetchBanners}
              className="flex items-center bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 md:px-4 md:py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-sm"
            >
              <RefreshCw className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2" />
              Refresh
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center bg-primary hover:bg-teal-800 text-white px-3 py-2 md:px-4 md:py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-sm"
            >
              <Plus className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2" />
              Add Banner
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-primary">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Banners</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.total}</p>
              </div>
              <div className="p-2 md:p-3 bg-teal-100 rounded-full">
                <Package className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Banners</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.active}</p>
              </div>
              <div className="p-2 md:p-3 bg-green-100 rounded-full">
                <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Inactive Banners</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.inactive}</p>
              </div>
              <div className="p-2 md:p-3 bg-red-100 rounded-full">
                <XCircle className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Expired Banners</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.expired}</p>
              </div>
              <div className="p-2 md:p-3 bg-orange-100 rounded-full">
                <Calendar className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl shadow mb-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search banners..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border px-3 py-2 rounded-lg"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-xl shadow p-8">
            <div className="flex items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-primary mr-3" />
              <span className="text-gray-600">Loading banners...</span>
            </div>
          </div>
        ) : current.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8">
            <div className="text-center">
              <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No banners found</p>
              <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Banner Details
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {current.map((b, index) => (
                    <tr key={b._id} className={`hover:bg-gray-50 transition-colors duration-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-12 w-12">
                            <img
                              className="h-12 w-12 rounded-lg object-cover border border-gray-200"
                              src={b.imageUrl || "/placeholder.jpg"}
                              alt={b.title}
                            />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{b.title}</div>
                            <div className="text-sm text-gray-500">ID: {b._id.slice(-8)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                            {formatDate(b.startDate)}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            to {formatDate(b.endDate)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {isExpired(b.endDate) ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            <Calendar className="w-3 h-3 mr-1" />
                            Expired
                          </span>
                        ) : b.isActive ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <XCircle className="w-3 h-3 mr-1" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleViewClick(b)}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </button>
                          <button
                            onClick={() => handleEditClick(b)}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors duration-200"
                            title="Edit Banner"
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </button>
                          {b.isActive ? (
                            <button
                              onClick={() => handleDeleteBanner(b._id)}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-orange-700 bg-orange-100 hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors duration-200"
                              title="Deactivate Banner"
                            >
                              <PauseCircle className="w-4 h-4 mr-1" />
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleStatus(b._id)}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200"
                              title="Activate Banner"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Activate
                            </button>
                          )}
                          <button
                            onClick={() => handleHardDeleteBanner(b._id)}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
                            title="Permanently Delete"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        <div className="flex justify-between items-center mt-6">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="p-2 bg-gray-200 rounded-lg disabled:opacity-50"
          >
            <ChevronLeft />
          </button>
          <p className="text-gray-600">
            Page {currentPage} of {totalPages}
          </p>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="p-2 bg-gray-200 rounded-lg disabled:opacity-50"
          >
            <ChevronRight />
          </button>
        </div>
      </div>

      {/* Modals for Create/Edit/View */}
      {showCreateModal && (
        <Modal
          title="Add New Banner"
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateBanner}
          form={createForm}
          handleChange={handleCreateFormChange}
          fileRef={fileInputRef}
        />
      )}
      {showEditModal && (
        <Modal
          title="Edit Banner"
          onClose={() => setShowEditModal(false)}
          onSubmit={handleUpdateBanner}
          form={editForm}
          handleChange={handleEditFormChange}
          fileRef={editFileInputRef}
        />
      )}
      {showViewModal && selectedBanner && (
        <ViewModal
          banner={selectedBanner}
          onClose={() => setShowViewModal(false)}
        />
      )}
    </div>
  );
};

/* Reusable Modal Components */
const Modal = ({ title, onClose, onSubmit, form, handleChange, fileRef }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
      <div className="flex justify-between items-center p-6 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
        >
          <X className="w-6 h-6 text-gray-400" />
        </button>
      </div>
      <form onSubmit={onSubmit} className="p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Banner Title *
          </label>
          <input
            name="title"
            value={form.title || ""}
            onChange={handleChange}
            placeholder="Enter banner title"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date *
            </label>
            <input
              type="date"
              name="startDate"
              value={form.startDate || ""}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date (Optional)
            </label>
            <input
              type="date"
              name="endDate"
              value={form.endDate || ""}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
            />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            name="isActive"
            checked={form.isActive || false}
            onChange={handleChange}
            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
          />
          <label className="text-sm font-medium text-gray-700">
            Active Banner
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Banner Image
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-primary transition-colors duration-200">
            <div className="space-y-1 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600">
                <label
                  htmlFor="file-upload"
                  className="relative cursor-pointer bg-white rounded-md font-medium text-primary hover:text-teal-800 focus-within:outline-none"
                >
                  <span>Upload a file</span>
                  <input
                    id="file-upload"
                    name="image"
                    type="file"
                    ref={fileRef}
                    onChange={handleChange}
                    className="sr-only"
                    accept="image/*"
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 bg-primary hover:bg-teal-800 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Save className="w-4 h-4 mr-2 inline" />
            Save Banner
          </button>
        </div>
      </form>
    </div>
  </div>
);

const ViewModal = ({ banner, onClose }) => {
  const { API, token } = useAuth();

  const handleToggleStatus = async () => {
    try {
      const updatedIsActive = !banner.isActive;
      const formData = new FormData();
      formData.append('title', banner.title);
      formData.append('startDate', new Date(banner.startDate).toISOString().split("T")[0]);
      formData.append('endDate', banner.endDate ? new Date(banner.endDate).toISOString().split("T")[0] : "");
      formData.append('isActive', updatedIsActive);
      const res = await fetch(`${API}/banner/admin/banners/${banner._id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      // Update the banner in the parent component
      window.location.reload(); // Simple way to refresh the page and update the list
      toast.success(`Banner ${updatedIsActive ? 'activated' : 'deactivated'} successfully!`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Banner Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>
        <div className="p-6">
          <div className="mb-6">
            <img
              src={banner.imageUrl || "/placeholder.jpg"}
              alt={banner.title}
              className="w-full h-64 object-cover rounded-xl shadow-md"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Banner Title
                </label>
                <p className="text-lg font-semibold text-gray-900">{banner.title}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Banner ID
                </label>
                <p className="text-sm text-gray-600 font-mono">{banner._id}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                {banner.endDate && new Date(banner.endDate) < new Date() ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                    <Calendar className="w-4 h-4 mr-1" />
                    Expired
                  </span>
                ) : banner.isActive ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                    <XCircle className="w-4 h-4 mr-1" />
                    Inactive
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                  <p className="text-gray-900">
                    {new Date(banner.startDate).toLocaleDateString("en-IN", {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                  <p className="text-gray-900">
                    {banner.endDate ? new Date(banner.endDate).toLocaleDateString("en-IN", {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 'N/A'}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration
                </label>
                <p className="text-gray-900">
                  {banner.endDate ? `${Math.ceil((new Date(banner.endDate) - new Date(banner.startDate)) / (1000 * 60 * 60 * 24))} days` : 'Ongoing'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex justify-between items-center">
              {(!banner.endDate || new Date(banner.endDate) >= new Date()) && (
                <button
                  onClick={handleToggleStatus}
                  className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white transition-colors duration-200 ${
                    banner.isActive
                      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                      : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                  }`}
                >
                  {banner.isActive ? (
                    <>
                      <XCircle className="w-4 h-4 mr-2" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Activate
                    </>
                  )}
                </button>
              )}
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-primary hover:bg-teal-800 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminBanners;
