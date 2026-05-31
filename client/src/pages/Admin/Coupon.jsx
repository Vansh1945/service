import React, { useState, useEffect, useRef, useMemo } from 'react';
import Pagination from '../../components/Pagination';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Search,
  Filter,
  Upload,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Percent,
  DollarSign,
  Users,
  Globe,
  Gift,
  Calendar,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  BarChart3
} from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../../context/auth';
import * as CouponService from '../../services/CouponService';
import * as AdminService from '../../services/AdminService';
import { getAllZones } from '../../services/ZoneService';
import { formatCurrency, formatDate } from '../../utils/format';

const AdminCoupons = () => {
  const { API, token } = useAuth();
  // State management
  const [coupons, setCoupons] = useState([]);
  const [filteredCoupons, setFilteredCoupons] = useState([]);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showHardDeleteModal, setShowHardDeleteModal] = useState(false);
  const [couponToDelete, setCouponToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [users, setUsers] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    expired: 0,
    global: 0,
    firstBooking: 0
  });

  // Form states
  const [createForm, setCreateForm] = useState({
    code: '',
    discountType: 'flat',
    discountValue: '',
    expiryDate: '',
    isGlobal: false,
    isFirstBooking: false,
    assignedTo: '',
    usageLimit: '',
    applicableZones: []
  });
  const [editForm, setEditForm] = useState({
    applicableZones: []
  });

  const [createStateSearch, setCreateStateSearch] = useState('');
  const [createStateOpen, setCreateStateOpen] = useState(false);
  const [createCitySearch, setCreateCitySearch] = useState('');
  const [createCityOpen, setCreateCityOpen] = useState(false);
  const [createMicroSearch, setCreateMicroSearch] = useState('');
  const [createMicroOpen, setCreateMicroOpen] = useState(false);

  const [editStateSearch, setEditStateSearch] = useState('');
  const [editStateOpen, setEditStateOpen] = useState(false);
  const [editCitySearch, setEditCitySearch] = useState('');
  const [editCityOpen, setEditCityOpen] = useState(false);
  const [editMicroSearch, setEditMicroSearch] = useState('');
  const [editMicroOpen, setEditMicroOpen] = useState(false);

  const handleZoneToggleCascade = (zone, isCreate) => {
    const form = isCreate ? createForm : editForm;
    const setForm = isCreate ? setCreateForm : setEditForm;
    const currentSelected = form.applicableZones || [];
    const zoneId = zone._id.toString();

    let newZones = [...currentSelected];

    if (currentSelected.includes(zone._id)) {
      // DESELECT logic
      newZones = newZones.filter(id => id !== zone._id);

      if (zone.zoneLevel === 'state') {
        const childCities = zones.filter(z => z.zoneLevel === 'city' && (z.parentZone?._id || z.parentZone || '').toString() === zoneId);
        const cityIds = childCities.map(c => c._id.toString());
        newZones = newZones.filter(id => !cityIds.includes(id));

        const childMicros = zones.filter(z => z.zoneLevel === 'micro' && cityIds.includes((z.parentZone?._id || z.parentZone || '').toString()));
        const microIds = childMicros.map(m => m._id.toString());
        newZones = newZones.filter(id => !microIds.includes(id));
      } else if (zone.zoneLevel === 'city') {
        const childMicros = zones.filter(z => z.zoneLevel === 'micro' && (z.parentZone?._id || z.parentZone || '').toString() === zoneId);
        const microIds = childMicros.map(m => m._id.toString());
        newZones = newZones.filter(id => !microIds.includes(id));

        const parentStateId = (zone.parentZone?._id || zone.parentZone || '').toString();
        if (parentStateId) {
          newZones = newZones.filter(id => id !== parentStateId);
        }
      } else if (zone.zoneLevel === 'micro') {
        const parentCityId = (zone.parentZone?._id || zone.parentZone || '').toString();
        if (parentCityId) {
          newZones = newZones.filter(id => id !== parentCityId);
          const parentCity = zones.find(z => z._id.toString() === parentCityId);
          const parentStateId = parentCity ? (parentCity.parentZone?._id || parentCity.parentZone || '').toString() : '';
          if (parentStateId) {
            newZones = newZones.filter(id => id !== parentStateId);
          }
        }
      }
    } else {
      // SELECT logic
      newZones.push(zone._id);

      if (zone.zoneLevel === 'state') {
        const childCities = zones.filter(z => z.zoneLevel === 'city' && (z.parentZone?._id || z.parentZone || '').toString() === zoneId);
        const cityIds = childCities.map(c => c._id);

        const childMicros = zones.filter(z => z.zoneLevel === 'micro' && cityIds.map(id => id.toString()).includes((z.parentZone?._id || z.parentZone || '').toString()));
        const microIds = childMicros.map(m => m._id);

        newZones = Array.from(new Set([...newZones, ...cityIds, ...microIds]));
      } else if (zone.zoneLevel === 'city') {
        const childMicros = zones.filter(z => z.zoneLevel === 'micro' && (z.parentZone?._id || z.parentZone || '').toString() === zoneId);
        const microIds = childMicros.map(m => m._id);
        newZones = Array.from(new Set([...newZones, ...microIds]));

        const parentStateId = (zone.parentZone?._id || zone.parentZone || '').toString();
        if (parentStateId) {
          const siblingCities = zones.filter(z => z.zoneLevel === 'city' && (z.parentZone?._id || z.parentZone || '').toString() === parentStateId);
          const allSiblingCityIds = siblingCities.map(c => c._id.toString());
          const areAllSelected = allSiblingCityIds.every(id => newZones.includes(id));
          if (areAllSelected) {
            newZones.push(parentStateId);
          }
        }
      } else if (zone.zoneLevel === 'micro') {
        const parentCityId = (zone.parentZone?._id || zone.parentZone || '').toString();
        if (parentCityId) {
          const siblingMicros = zones.filter(z => z.zoneLevel === 'micro' && (z.parentZone?._id || z.parentZone || '').toString() === parentCityId);
          const allSiblingMicroIds = siblingMicros.map(m => m._id.toString());
          const areAllSelected = allSiblingMicroIds.every(id => newZones.includes(id));
          if (areAllSelected) {
            newZones.push(parentCityId);

            const parentCity = zones.find(z => z._id.toString() === parentCityId);
            const parentStateId = parentCity ? (parentCity.parentZone?._id || parentCity.parentZone || '').toString() : '';
            if (parentStateId) {
              const siblingCities = zones.filter(z => z.zoneLevel === 'city' && (z.parentZone?._id || z.parentZone || '').toString() === parentStateId);
              const allSiblingCityIds = siblingCities.map(c => c._id.toString());
              const areAllSelectedCities = allSiblingCityIds.every(id => newZones.includes(id) || id === parentCityId);
              if (areAllSelectedCities) {
                newZones.push(parentStateId);
              }
            }
          }
        }
      }
    }

    setForm(prev => ({ ...prev, applicableZones: newZones }));
  };

  // Fetch zones helper
  const fetchZones = async () => {
    try {
      const response = await getAllZones();
      const data = response.data;
      if (data.success) {
        setZones(data.data || []);
      }
    } catch (error) {
      console.error('Fetch zones error:', error);
    }
  };

  // Check admin access
  useEffect(() => {
    fetchCoupons();
    fetchUsers();
    fetchZones();
  }, []);

  // Filter and search coupons
  useEffect(() => {
    let filtered = [...coupons];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(coupon =>
        coupon.code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      if (typeFilter === 'global') {
        filtered = filtered.filter(coupon => coupon.isGlobal);
      } else if (typeFilter === 'first-booking') {
        filtered = filtered.filter(coupon => coupon.isFirstBooking);
      } else if (typeFilter === 'assigned') {
        filtered = filtered.filter(coupon => coupon.assignedTo);
      }
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      filtered = filtered.filter(coupon => coupon.isActive === isActive);
    }

    setFilteredCoupons(filtered);
  }, [coupons, searchTerm, typeFilter, statusFilter]);

  // Calculate stats whenever coupons change
  useEffect(() => {
    const newStats = {
      total: coupons.length,
      active: coupons.filter(c => c.isActive && new Date(c.expiryDate) > new Date()).length,
      expired: coupons.filter(c => new Date(c.expiryDate) <= new Date()).length,
      global: coupons.filter(c => c.isGlobal).length,
      firstBooking: coupons.filter(c => c.isFirstBooking).length
    };
    setStats(newStats);
  }, [coupons]);

  // Fetch all coupons
  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const response = await CouponService.getAllCoupons();
      const data = response.data;
      setCoupons(data.data || data.coupons || []);
    } catch (error) {
      console.error('Fetch coupons error:', error);
      toast.error(error.message || 'Failed to fetch coupons');
    } finally {
      setLoading(false);
    }
  };

  // Fetch users for assignment
  const fetchUsers = async () => {
    try {
      const response = await AdminService.getAllCustomers({ limit: 10000 });
      const data = response.data;

      if (data.success || response.status === 200) {
        const usersList = data.users || data.customers || [];
        setUsers(usersList);
      } else {
        throw new Error(data.message || 'Failed to load users list');
      }
    } catch (error) {
      console.error('Fetch users error:', error);
      toast.error(error.message || 'Error loading users');
    }
  };

  // Handle create form changes
  const handleCreateFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCreateForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Handle edit form changes
  const handleEditFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Create new coupon
  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    try {
      const couponData = {
        ...createForm,
        discountValue: Number(createForm.discountValue),
        minBookingValue: Number(createForm.minBookingValue) || 0,
        usageLimit: createForm.usageLimit ? Number(createForm.usageLimit) : null,
        assignedTo: createForm.assignedTo || null
      };

      const response = await CouponService.createCoupon(couponData);
      const data = response.data;

      setCoupons(prev => [data.data, ...prev]);
      toast.success(data.message);
      resetCreateForm();
      setShowCreateModal(false);
    } catch (error) {
      console.error('Create coupon error:', error);
      toast.error(error.message);
    }
  };

  // Update coupon
  const handleUpdateCoupon = async (e) => {
    e.preventDefault();
    try {
      const updateData = { ...editForm };
      updateData.discountValue = Number(updateData.discountValue);
      updateData.minBookingValue = Number(updateData.minBookingValue) || 0;
      updateData.usageLimit = updateData.usageLimit ? Number(updateData.usageLimit) : null;

      if (selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0) {
        delete updateData.code;
        delete updateData.discountType;
        delete updateData.discountValue;
        delete updateData.isGlobal;
        delete updateData.isFirstBooking;
      }

      const response = await CouponService.updateCoupon(selectedCoupon._id, updateData);
      const data = response.data;
      setCoupons(prev => prev.map(c => c._id === data.data._id ? data.data : c));
      toast.success(data.message);
      setShowEditModal(false);
    } catch (error) {
      console.error('Update coupon error:', error);
      toast.error(error.message);
    }
  };

  // Deactivate coupon
  const handleDeleteCoupon = async (couponId) => {
    try {
      const response = await CouponService.deleteCoupon(couponId);
      const data = response.data;
      toast.success(data.message);
      await fetchCoupons();
    } catch (error) {
      console.error('Deactivate coupon error:', error);
      toast.error(error.message);
    }
  };

  // Hard delete coupon
  const handleHardDeleteCoupon = (couponId) => {
    setCouponToDelete(couponId);
    setShowHardDeleteModal(true);
  };

  const confirmHardDeleteCoupon = async () => {
    if (!couponToDelete) return;

    try {
      const response = await CouponService.hardDeleteCoupon(couponToDelete);
      const data = response.data;
      await fetchCoupons();
      toast.success(data.message);
    } catch (error) {
      console.error('Delete coupon error:', error);
      toast.error(error.message);
    } finally {
      setShowHardDeleteModal(false);
      setCouponToDelete(null);
    }
  };

  // Reset create form
  const resetCreateForm = () => {
    setCreateForm({
      code: '',
      discountType: 'flat',
      discountValue: '',
      minBookingValue: '',
      isGlobal: false,
      isFirstBooking: false,
      assignedTo: '',
      usageLimit: '',
      applicableZones: []
    });
  };

  // Handle edit click
  const handleEditClick = (coupon) => {
    setSelectedCoupon(coupon);
    setEditForm({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      expiryDate: coupon.expiryDate ? new Date(coupon.expiryDate).toISOString().split('T')[0] : '',
      minBookingValue: coupon.minBookingValue || '',
      isGlobal: coupon.isGlobal,
      isFirstBooking: coupon.isFirstBooking,
      assignedTo: coupon.assignedTo ? (coupon.assignedTo._id || coupon.assignedTo) : '',
      usageLimit: coupon.usageLimit || '',
      isActive: coupon.isActive,
      applicableZones: coupon.applicableZones ? coupon.applicableZones.map(z => typeof z === 'object' ? z._id : z) : []
    });
    setShowEditModal(true);
  };

  // Handle view click
  const handleViewClick = (coupon) => {
    setSelectedCoupon(coupon);
    setShowViewModal(true);
  };


  // Format address
  const formatAddress = (address) => {
    if (!address) return '';
    const { city, state } = address;
    return [city, state].filter(Boolean).join(', ');
  };


  // Check if coupon is expired
  const isExpired = (expiryDate) => {
    return new Date(expiryDate) < new Date();
  };

  // Get remaining uses
  const getRemainingUses = (coupon) => {
    if (coupon.usageLimit === null) return 'Unlimited';
    return coupon.usageLimit - (coupon.usedBy?.length || 0);
  };

  const getZoneHierarchyPath = (zoneId) => {
    const zone = zones.find(z => z._id.toString() === zoneId.toString());
    if (!zone) return 'Unknown Zone';

    let path = zone.name;
    let current = zone;

    while (current && current.parentZone) {
      const parentId = typeof current.parentZone === 'object' ? current.parentZone._id : current.parentZone;
      const parent = zones.find(z => z._id.toString() === parentId.toString());
      if (parent) {
        path = `${parent.name} > ${path}`;
        current = parent;
      } else {
        break;
      }
    }
    return path;
  };

  const displayApplicableZones = (applicableZones) => {
    if (!applicableZones || applicableZones.length === 0) {
      return <span className="text-gray-500 font-medium">Global</span>;
    }
    const zoneIds = applicableZones.map(z => typeof z === 'object' ? z._id : z);
    if (zoneIds.length === 1) {
      return <span className="text-sm font-medium text-secondary">{getZoneHierarchyPath(zoneIds[0])}</span>;
    }
    const firstPath = getZoneHierarchyPath(zoneIds[0]);
    return (
      <span className="text-sm font-medium text-secondary" title={zoneIds.map(id => getZoneHierarchyPath(id)).join(', ')}>
        {firstPath} <span className="text-primary font-bold">({zoneIds.length} zones)</span>
      </span>
    );
  };

  // Get user display name
  const getUserDisplayName = (user) => {
    if (!user) return 'Unknown User';

    // Handle different user object structures
    if (typeof user === 'string') return user;

    if (user.name) return user.name;
    if (user.email) return user.email;
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCoupons = filteredCoupons.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredCoupons.length / itemsPerPage);

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-secondary">Coupons Management</h1>
            <p className="text-gray-600 mt-1">Manage discount coupons and promotions</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center bg-primary hover:bg-teal-800 text-white px-3 py-2 md:px-4 md:py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-sm"
          >
            <Plus className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2" />
            Add Coupon
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 mb-6 md:mb-8">
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-primary">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Coupons</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.total}</p>
              </div>
              <div className="p-2 md:p-3 bg-teal-100 rounded-full">
                <Gift className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Coupons</p>
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
                <p className="text-sm font-medium text-gray-600">Expired Coupons</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.expired}</p>
              </div>
              <div className="p-2 md:p-3 bg-red-100 rounded-full">
                <XCircle className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Global Coupons</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.global}</p>
              </div>
              <div className="p-2 md:p-3 bg-blue-100 rounded-full">
                <Globe className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">First Booking</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.firstBooking}</p>
              </div>
              <div className="p-2 md:p-3 bg-purple-100 rounded-full">
                <Users className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
                <input
                  type="text"
                  placeholder="Search coupons by code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <Filter className="text-gray-400 w-4 h-4 md:w-5 md:h-5" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="all">All Types</option>
                <option value="global">Global</option>
                <option value="first-booking">First Booking</option>
                <option value="assigned">Assigned</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-xl shadow-md p-8 mb-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading coupons...</p>
          </div>
        )}

        {/* Coupons Table */}
        {!loading && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            {currentCoupons.length === 0 ? (
              <div className="text-center py-12 md:py-16">
                <Gift className="w-12 h-12 md:w-16 md:h-16 text-gray-400 mx-auto mb-3 md:mb-4" />
                <p className="text-gray-600 text-md md:text-lg">No coupons found</p>
                <p className="text-gray-400 text-sm mt-1 md:mt-2">
                  {searchTerm || typeFilter !== 'all' || statusFilter !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Create your first coupon to get started'}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min. Booking</th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applicable Zones</th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {currentCoupons.map((coupon) => (
                        <tr key={coupon._id} className="hover:bg-gray-50 transition-colors duration-200">
                          <td className="px-4 md:px-6 py-4">
                            <div className="text-sm font-medium text-secondary font-mono">{coupon.code}</div>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {coupon.discountType === 'flat' ? (
                                <DollarSign className="w-3 h-3 md:w-4 md:h-4 text-green-600 mr-1" />
                              ) : (
                                <Percent className="w-3 h-3 md:w-4 md:h-4 text-blue-600 mr-1" />
                              )}
                              <span className="text-sm font-semibold">
                                {coupon.discountType === 'flat'
                                  ? formatCurrency(coupon.discountValue)
                                  : `${coupon.discountValue}%`
                                }
                              </span>
                            </div>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600">
                              {coupon.minBookingValue ? formatCurrency(coupon.minBookingValue) : 'None'}
                            </span>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Calendar className="w-3 h-3 md:w-4 md:h-4 text-gray-400 mr-1" />
                              <span className={`text-sm ${isExpired(coupon.expiryDate) ? 'text-red-600' : 'text-gray-600'}`}>
                                {formatDate(coupon.expiryDate)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            {coupon.isGlobal ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <Globe className="w-3 h-3 mr-1" />
                                Global
                              </span>
                            ) : coupon.isFirstBooking ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                <Users className="w-3 h-3 mr-1" />
                                First Booking
                              </span>
                            ) : coupon.assignedTo ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                <Users className="w-3 h-3 mr-1" />
                                Assigned
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Standard
                              </span>
                            )}
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            {displayApplicableZones(coupon.applicableZones)}
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">
                              {coupon.usedBy?.length || 0} / {coupon.usageLimit === null ? '∞' : coupon.usageLimit}
                            </div>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${coupon.isActive && !isExpired(coupon.expiryDate)
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                              }`}>
                              {coupon.isActive && !isExpired(coupon.expiryDate) ? (
                                <>
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Active
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3 mr-1" />
                                  {isExpired(coupon.expiryDate) ? 'Expired' : 'Inactive'}
                                </>
                              )}
                            </span>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleViewClick(coupon)}
                                className="text-primary hover:text-teal-800 p-1 rounded transition-colors duration-200"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleEditClick(coupon)}
                                className="text-primary hover:text-teal-800 p-1 rounded transition-colors duration-200"
                                title="Edit Coupon"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCoupon(coupon._id)}
                                className="text-yellow-600 hover:text-yellow-800 p-1 rounded transition-colors duration-200"
                                title="Deactivate Coupon"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleHardDeleteCoupon(coupon._id)}
                                className="text-red-600 hover:text-red-800 p-1 rounded transition-colors duration-200"
                                title="Delete Coupon Permanently"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="mt-4 border-t border-gray-200">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={filteredCoupons.length}
                    limit={itemsPerPage}
                    onPageChange={setCurrentPage}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Create Coupon Modal */}
        {showCreateModal && (
          <Modal
            isOpen={showCreateModal}
            onClose={() => {
              setShowCreateModal(false);
              resetCreateForm();
            }}
            title="Create New Coupon"
            size="large"
          >
            <form onSubmit={handleCreateCoupon} className="space-y-4 md:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Coupon Code *
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={createForm.code}
                    onChange={handleCreateFormChange}
                    required
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                    placeholder="e.g., WELCOME20"
                    pattern="[A-Z0-9_]{5,20}"
                    title="5-20 uppercase alphanumeric characters or underscores"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Discount Type *
                  </label>
                  <select
                    name="discountType"
                    value={createForm.discountType}
                    onChange={handleCreateFormChange}
                    required
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="flat">Flat Amount (₹)</option>
                    <option value="percent">Percentage (%)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Discount Value *
                  </label>
                  <input
                    type="number"
                    name="discountValue"
                    value={createForm.discountValue}
                    onChange={handleCreateFormChange}
                    required
                    min="1"
                    step={createForm.discountType === 'percent' ? "1" : "any"}
                    max={createForm.discountType === 'percent' ? "100" : ""}
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={createForm.discountType === 'flat' ? "e.g., 200" : "e.g., 20"}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Minimum Booking Value (₹)
                  </label>
                  <input
                    type="number"
                    name="minBookingValue"
                    value={createForm.minBookingValue}
                    onChange={handleCreateFormChange}
                    min="0"
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., 1000 (optional)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Expiry Date *
                  </label>
                  <input
                    type="date"
                    name="expiryDate"
                    value={createForm.expiryDate}
                    onChange={handleCreateFormChange}
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Usage Limit
                  </label>
                  <input
                    type="number"
                    name="usageLimit"
                    value={createForm.usageLimit}
                    onChange={handleCreateFormChange}
                    min="1"
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Leave empty for unlimited"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">
                    Coupon Scope *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setCreateForm(prev => ({ ...prev, isGlobal: true, applicableZones: [] }))}
                      className={`py-2.5 px-4 rounded-xl font-bold text-xs border transition-all text-center ${createForm.isGlobal
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}
                    >
                      Global
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateForm(prev => ({ ...prev, isGlobal: false }))}
                      className={`py-2.5 px-4 rounded-xl font-bold text-xs border transition-all text-center ${!createForm.isGlobal
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}
                    >
                      Zone Specific
                    </button>
                  </div>
                </div>
                <div className="flex items-end pb-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="isFirstBooking"
                      id="isFirstBooking"
                      checked={createForm.isFirstBooking}
                      onChange={handleCreateFormChange}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer"
                    />
                    <label htmlFor="isFirstBooking" className="ml-2 block text-sm text-gray-900 font-semibold cursor-pointer">
                      First Booking Only
                    </label>
                  </div>
                </div>
              </div>

              {!createForm.isGlobal && !createForm.isFirstBooking && (
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Assign to User (Optional)
                  </label>
                  {users.length > 0 ? (
                    <select
                      name="assignedTo"
                      value={createForm.assignedTo}
                      onChange={handleCreateFormChange}
                      className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Select a user (optional)</option>
                      {users.map(user => {
                        const userObj = typeof user === 'string' ? { _id: user } : user;
                        return (
                          <option key={userObj._id} value={userObj._id}>
                            {getUserDisplayName(userObj)}
                            {userObj.email ? ` - ${userObj.email}` : ''}
                            {userObj.address ? ` - ${formatAddress(userObj.address)}` : ''}
                            {userObj.totalBookings !== undefined ? ` - ${userObj.totalBookings || 0} bookings` : ''}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      type="text"
                      name="assignedTo"
                      value={createForm.assignedTo}
                      onChange={handleCreateFormChange}
                      placeholder="Enter user ID manually"
                      className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  )}
                </div>
              )}

              {!createForm.isGlobal && (
                <div>
                  <HierarchicalZoneSelector
                    zones={zones}
                    selectedZoneIds={createForm.applicableZones}
                    onChange={(zone) => handleZoneToggleCascade(zone, true)}
                  />
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetCreateForm();
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-800 transition-colors duration-200 flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Create Coupon
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* Edit Coupon Modal */}
        {showEditModal && selectedCoupon && (
          <Modal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            title="Edit Coupon"
            size="large"
          >
            <form onSubmit={handleUpdateCoupon} className="space-y-4 md:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Coupon Code *
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={editForm.code}
                    onChange={handleEditFormChange}
                    required
                    disabled={selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0}
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono disabled:bg-gray-100"
                    pattern="[A-Z0-9_]{5,20}"
                    title="5-20 uppercase alphanumeric characters or underscores"
                  />
                  {selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">Code cannot be changed after usage</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Discount Type *
                  </label>
                  <select
                    name="discountType"
                    value={editForm.discountType}
                    onChange={handleEditFormChange}
                    required
                    disabled={selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0}
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100"
                  >
                    <option value="flat">Flat Amount (₹)</option>
                    <option value="percent">Percentage (%)</option>
                  </select>
                  {selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">Discount type cannot be changed after usage</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Discount Value *
                  </label>
                  <input
                    type="number"
                    name="discountValue"
                    value={editForm.discountValue}
                    onChange={handleEditFormChange}
                    required
                    min="1"
                    step={editForm.discountType === 'percent' ? "1" : "any"}
                    max={editForm.discountType === 'percent' ? "100" : ""}
                    disabled={selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0}
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100"
                  />
                  {selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">Discount value cannot be changed after usage</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Minimum Booking Value (₹)
                  </label>
                  <input
                    type="number"
                    name="minBookingValue"
                    value={editForm.minBookingValue}
                    onChange={handleEditFormChange}
                    min="0"
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Expiry Date *
                  </label>
                  <input
                    type="date"
                    name="expiryDate"
                    value={editForm.expiryDate}
                    onChange={handleEditFormChange}
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Usage Limit
                  </label>
                  <input
                    type="number"
                    name="usageLimit"
                    value={editForm.usageLimit}
                    onChange={handleEditFormChange}
                    min="1"
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Leave empty for unlimited"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">
                    Coupon Scope *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0}
                      onClick={() => setEditForm(prev => ({ ...prev, isGlobal: true, applicableZones: [] }))}
                      className={`py-2.5 px-4 rounded-xl font-bold text-xs border transition-all text-center ${editForm.isGlobal
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50'}`}
                    >
                      🌍 Global
                    </button>
                    <button
                      type="button"
                      disabled={selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0}
                      onClick={() => setEditForm(prev => ({ ...prev, isGlobal: false }))}
                      className={`py-2.5 px-4 rounded-xl font-bold text-xs border transition-all text-center ${!editForm.isGlobal
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50'}`}
                    >
                      📍 Zone Specific
                    </button>
                  </div>
                </div>
                <div className="flex items-end pb-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="isFirstBooking"
                      id="editIsFirstBooking"
                      checked={editForm.isFirstBooking}
                      onChange={handleEditFormChange}
                      disabled={selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded disabled:bg-gray-100 cursor-pointer"
                    />
                    <label htmlFor="editIsFirstBooking" className="ml-2 block text-sm text-gray-900 font-semibold cursor-pointer">
                      First Booking Only
                    </label>
                  </div>
                </div>
              </div>

              {!editForm.isGlobal && !editForm.isFirstBooking && (
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1 md:mb-2">
                    Assign to User (Optional)
                  </label>
                  <select
                    name="assignedTo"
                    value={editForm.assignedTo}
                    onChange={handleEditFormChange}
                    className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select a user (optional)</option>
                    {users.map(user => {
                      const userObj = typeof user === 'string' ? { _id: user } : user;
                      return (
                        <option key={userObj._id} value={userObj._id}>
                          {getUserDisplayName(userObj)}
                          {userObj.email ? ` - ${userObj.email}` : ''}
                          {userObj.address ? ` - ${formatAddress(userObj.address)}` : ''}
                          {userObj.totalBookings !== undefined ? ` - ${userObj.totalBookings || 0} bookings` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="isActive"
                  id="isActive"
                  checked={editForm.isActive}
                  onChange={handleEditFormChange}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                  Active Coupon
                </label>
              </div>

              {!editForm.isGlobal && (
                <div>
                  <HierarchicalZoneSelector
                    zones={zones}
                    selectedZoneIds={editForm.applicableZones || []}
                    onChange={(zone) => handleZoneToggleCascade(zone, false)}
                  />
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-800 transition-colors duration-200 flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Update Coupon
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* View Coupon Modal */}
        {showViewModal && selectedCoupon && (
          <Modal
            isOpen={showViewModal}
            onClose={() => setShowViewModal(false)}
            title="Coupon Details"
            size="large"
          >
            <div className="space-y-6">
              {/* Header Section */}
              <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-6 rounded-xl border border-teal-200">
                <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                  <div>
                    <h3 className="text-2xl md:text-3xl font-bold text-secondary font-mono">{selectedCoupon.code}</h3>
                    <div className="flex items-center mt-2">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${selectedCoupon.isActive && !isExpired(selectedCoupon.expiryDate)
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                        }`}>
                        {selectedCoupon.isActive && !isExpired(selectedCoupon.expiryDate) ? (
                          <>
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Active
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 mr-1" />
                            {isExpired(selectedCoupon.expiryDate) ? 'Expired' : 'Inactive'}
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="text-2xl md:text-3xl font-bold text-teal-800">
                    {selectedCoupon.discountType === 'flat'
                      ? formatCurrency(selectedCoupon.discountValue)
                      : `${selectedCoupon.discountValue}% OFF`
                    }
                  </div>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center mb-2">
                    <Calendar className="w-5 h-5 text-gray-600 mr-2" />
                    <span className="text-sm font-medium text-gray-700">Expiry Date</span>
                  </div>
                  <p className={`text-lg font-semibold ${isExpired(selectedCoupon.expiryDate) ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatDate(selectedCoupon.expiryDate)}
                  </p>
                  {isExpired(selectedCoupon.expiryDate) && (
                    <p className="text-xs text-red-500 mt-1">This coupon has expired</p>
                  )}
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center mb-2">
                    <Users className="w-5 h-5 text-gray-600 mr-2" />
                    <span className="text-sm font-medium text-gray-700">Usage</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedCoupon.usedBy?.length || 0} / {selectedCoupon.usageLimit === null ? 'Unlimited' : selectedCoupon.usageLimit}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Used / Total Limit</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center mb-2">
                    <DollarSign className="w-5 h-5 text-gray-600 mr-2" />
                    <span className="text-sm font-medium text-gray-700">Min. Booking</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedCoupon.minBookingValue ? formatCurrency(selectedCoupon.minBookingValue) : 'No minimum'}
                  </p>
                </div>
              </div>

              {/* Type Information */}
              <div className="bg-white p-5 rounded-xl border border-gray-200">
                <h4 className="text-lg font-semibold text-secondary mb-4">Coupon Type</h4>
                <div className="flex items-center">
                  {selectedCoupon.isGlobal ? (
                    <>
                      <Globe className="w-6 h-6 text-blue-600 mr-3" />
                      <div>
                        <p className="font-medium">Global Coupon</p>
                        <p className="text-sm text-gray-600">Available to all users</p>
                      </div>
                    </>
                  ) : selectedCoupon.isFirstBooking ? (
                    <>
                      <Users className="w-6 h-6 text-purple-600 mr-3" />
                      <div>
                        <p className="font-medium">First Booking Coupon</p>
                        <p className="text-sm text-gray-600">Only for users with no previous bookings</p>
                      </div>
                    </>
                  ) : selectedCoupon.assignedTo ? (
                    <>
                      <Users className="w-6 h-6 text-orange-600 mr-3" />
                      <div>
                        <p className="font-medium">Assigned to User</p>
                        <p className="text-sm text-gray-600">
                          {getUserDisplayName(selectedCoupon.assignedTo)}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Gift className="w-6 h-6 text-gray-600 mr-3" />
                      <div>
                        <p className="font-medium">Standard Coupon</p>
                        <p className="text-sm text-gray-600">Available to all users (non-global)</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Applicable Zones Info */}
              <div className="bg-white p-5 rounded-xl border border-gray-200">
                <h4 className="text-lg font-semibold text-secondary mb-4">Applicable Zones</h4>
                {selectedCoupon.applicableZones && selectedCoupon.applicableZones.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedCoupon.applicableZones.map(z => {
                      const zoneId = typeof z === 'object' ? z._id : z;
                      return (
                        <span key={zoneId} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                          {getZoneHierarchyPath(zoneId)}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Globe className="w-6 h-6 text-blue-600 mr-3" />
                    <div>
                      <p className="font-medium text-gray-900">Globally Applicable</p>
                      <p className="text-sm text-gray-600">Valid across all service zones</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Usage History */}
              {selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0 && (
                <div className="bg-white p-5 rounded-xl border border-gray-200">
                  <h4 className="text-lg font-semibold text-secondary mb-4">Usage History</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Booking Value</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Used At</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedCoupon.usedBy.map((usage, index) => (
                          <tr key={index}>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {getUserDisplayName(usage.user)}
                              </div>
                              <div className="text-sm text-gray-500">
                                {usage.user?.email || ''}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {formatCurrency(usage.bookingValue)}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {formatDate(usage.usedAt)}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    handleEditClick(selectedCoupon);
                  }}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-800 transition-colors duration-200 flex items-center"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Coupon
                </button>
              </div>
            </div>
          </Modal>
        )}



        {/* Hard Delete Confirmation Modal */}
        {showHardDeleteModal && (
          <Modal
            isOpen={showHardDeleteModal}
            onClose={() => setShowHardDeleteModal(false)}
            title="Confirm Permanent Deletion"
          >
            <div>
              <p className="text-gray-600 mb-4">Are you sure you want to permanently delete this coupon? This action cannot be undone.</p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowHardDeleteModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmHardDeleteCoupon}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </button>
              </div>
            </div>
          </Modal>
        )}

      </div>
    </div>
  );
};

// Reusable Modal Component
const Modal = ({ isOpen, onClose, title, children, size = 'medium' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    medium: 'sm:max-w-lg',
    large: 'sm:max-w-2xl',
    xlarge: 'sm:max-w-4xl'
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
        </div>


        <div className={`bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 ${sizeClasses[size]} sm:w-full`}>
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-secondary">{title}</h3>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const HierarchicalZoneSelector = ({
  zones,
  selectedZoneIds,
  onChange,
  label = "Applicable Zones"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedNodes, setExpandedNodes] = useState({});
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const tree = useMemo(() => {
    const states = zones.filter(z => z.zoneLevel === 'state' || !z.zoneLevel);
    const cities = zones.filter(z => z.zoneLevel === 'city');
    const micros = zones.filter(z => z.zoneLevel === 'micro');

    return states.map(state => {
      const stateCities = cities.filter(c => {
        const pId = c.parentZone?._id || c.parentZone;
        return pId?.toString() === (state._id || state.id)?.toString();
      });

      const cityNodes = stateCities.map(city => {
        const cityMicros = micros.filter(m => {
          const pId = m.parentZone?._id || m.parentZone;
          return pId?.toString() === (city._id || city.id)?.toString();
        });

        return { ...city, children: cityMicros };
      });

      return { ...state, children: cityNodes };
    });
  }, [zones]);

  const filteredTree = useMemo(() => {
    if (!searchQuery) return tree;
    const lowerQuery = searchQuery.toLowerCase();

    const filterNodes = (nodes) => {
      return nodes.map(node => {
        const matchesSelf = node.name?.toLowerCase().includes(lowerQuery) || node.city?.toLowerCase().includes(lowerQuery);
        let filteredChildren = [];
        if (node.children) {
          filteredChildren = filterNodes(node.children);
        }
        const matchesChildren = filteredChildren.length > 0;

        if (matchesSelf || matchesChildren) {
          return {
            ...node,
            children: filteredChildren,
            forceExpanded: true
          };
        }
        return null;
      }).filter(Boolean);
    };

    return filterNodes(tree);
  }, [tree, searchQuery]);

  const toggleExpand = (id, e) => {
    e.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isSelected = (id) => (selectedZoneIds || []).includes(id);

  const renderNode = (node, depth = 0) => {
    const nodeId = node._id || node.id;
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = !!(expandedNodes[nodeId] || node.forceExpanded);
    const checked = isSelected(nodeId);

    return (
      <div key={nodeId} className="select-none">
        <div
          className="flex items-center hover:bg-gray-50 py-1.5 px-2 rounded-lg cursor-pointer transition-colors"
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => onChange(node)}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => toggleExpand(nodeId, e)}
              className="p-1 hover:bg-gray-200 rounded mr-1 transition-transform duration-200"
            >
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
            </button>
          ) : (
            <span className="w-6 shrink-0" />
          )}

          <input
            type="checkbox"
            checked={checked}
            onChange={() => { }}
            className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary mr-2 cursor-pointer"
          />

          <span className={`text-xs font-semibold text-secondary capitalize ${checked ? 'text-primary font-bold' : ''}`}>
            {node.name}
          </span>
          <span className="text-[9px] bg-gray-100 text-gray-500 ml-1.5 px-1.5 py-0.2 rounded font-black uppercase tracking-wider scale-90">
            {node.zoneLevel || 'state'}
          </span>
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-0.5">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <label className="block text-sm font-medium text-secondary mb-1.5">
        {label}
      </label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg bg-white cursor-pointer flex justify-between items-center text-sm shadow-sm hover:border-gray-400 transition-all font-semibold"
      >
        <span className="text-gray-700 truncate font-semibold">
          {(selectedZoneIds || []).length === 0 ? 'Select Zones (Leave empty for Global)' : `${(selectedZoneIds || []).length} Zones Selected`}
        </span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl p-3 max-h-80 flex flex-col shrink-0">
          <div className="relative mb-2 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by state, city, or micro zone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-250 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary font-semibold text-gray-900 bg-gray-50"
            />
          </div>

          <div className="overflow-y-auto flex-1 space-y-1 pr-1">
            {filteredTree.length === 0 ? (
              <div className="text-xs text-gray-400 italic text-center py-6">
                No matching zones found.
              </div>
            ) : (
              filteredTree.map(node => renderNode(node, 0))
            )}
          </div>
        </div>
      )}

      {(selectedZoneIds || []).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5 max-h-24 overflow-y-auto p-1 bg-gray-50 rounded-lg border border-gray-200 shadow-inner">
          {(selectedZoneIds || []).map(id => {
            const zone = zones.find(z => (z._id || z.id)?.toString() === id.toString());
            if (!zone) return null;

            let badgeColor = 'bg-teal-50 text-teal-800 border-teal-200';
            if (zone.zoneLevel === 'city') badgeColor = 'bg-blue-50 text-blue-800 border-blue-200';
            if (zone.zoneLevel === 'micro') badgeColor = 'bg-purple-50 text-purple-800 border-purple-200';

            return (
              <span key={id} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border shadow-sm capitalize ${badgeColor}`}>
                <span>{zone.name} ({zone.zoneLevel?.toUpperCase() || 'STATE'})</span>
                <button
                  type="button"
                  onClick={() => onChange(zone)}
                  className="ml-1 inline-flex items-center justify-center focus:outline-none text-gray-400 hover:text-gray-650"
                >
                  <X className="w-2.5 h-2.5 ml-0.5" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminCoupons;
