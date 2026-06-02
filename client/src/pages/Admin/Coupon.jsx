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
import HierarchicalZoneSelector from '../../components/HierarchicalZoneSelector';
import { useAdminFilter } from '../../context/AdminFilterContext';
import AdminFilterBar from '../../components/AdminFilterBar';

const AdminCoupons = () => {
  const { API, token } = useAuth();
  
  const {
    filterType,
    year,
    financialYear,
    month,
    quarter,
    zoneIds,
    getComputedDateRange,
    getMergedQuery
  } = useAdminFilter();
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

    const params = new URLSearchParams(window.location.search);
    const prefillZone = params.get('prefillZone');
    if (prefillZone) {
      setCreateForm(prev => ({
        ...prev,
        isGlobal: false,
        applicableZones: [prefillZone]
      }));
      setShowCreateModal(true);
    }
  }, []);


  // Filter and search coupons
  useEffect(() => {
    let filtered = [...coupons];

    // Apply global date filter
    const { startDate, endDate } = getComputedDateRange();
    if (startDate && endDate) {
      const startDateTime = new Date(startDate).getTime();
      const endDateTime = new Date(endDate).getTime();
      
      filtered = filtered.filter(coupon => {
        const couponDate = new Date(coupon.expiryDate || coupon.createdAt).getTime();
        return couponDate >= startDateTime && couponDate <= endDateTime;
      });
    }

    // Apply global zone filter
    if (zoneIds && zoneIds.length > 0) {
      filtered = filtered.filter(coupon => {
        if (coupon.isGlobal) return true; // Global coupons apply everywhere
        const couponZones = coupon.applicableZones ? coupon.applicableZones.map(z => (z._id || z).toString()) : [];
        return zoneIds.some(id => couponZones.includes(id.toString()));
      });
    }

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
  }, [coupons, searchTerm, typeFilter, statusFilter, filterType, year, financialYear, month, quarter, zoneIds]);

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

        {/* Reusable Premium Filter Bar */}
        <AdminFilterBar onApply={fetchCoupons} />

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
            <form onSubmit={handleCreateCoupon} className="space-y-6">
              {/* Section 1: General Details */}
              <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-1.5 pb-2 border-b border-slate-100/50">
                  <Gift className="w-4 h-4 text-primary" /> General Configuration
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Coupon Code *
                    </label>
                    <input
                      type="text"
                      name="code"
                      value={createForm.code}
                      onChange={handleCreateFormChange}
                      required
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold font-mono uppercase"
                      placeholder="e.g., WELCOME20"
                      pattern="[A-Z0-9_]{5,20}"
                      title="5-20 uppercase alphanumeric characters or underscores"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Discount Type *
                    </label>
                    <select
                      name="discountType"
                      value={createForm.discountType}
                      onChange={handleCreateFormChange}
                      required
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold cursor-pointer"
                    >
                      <option value="flat">Flat Amount (₹)</option>
                      <option value="percent">Percentage (%)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
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
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold"
                      placeholder={createForm.discountType === 'flat' ? "e.g., 200" : "e.g., 20"}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Minimum Booking Value (₹)
                    </label>
                    <input
                      type="number"
                      name="minBookingValue"
                      value={createForm.minBookingValue}
                      onChange={handleCreateFormChange}
                      min="0"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold"
                      placeholder="e.g., 1000 (optional)"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Expiry & Limits */}
              <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-1.5 pb-2 border-b border-slate-100/50">
                  <Calendar className="w-4 h-4 text-primary" /> Rules & Restrictions
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Expiry Date *
                    </label>
                    <input
                      type="date"
                      name="expiryDate"
                      value={createForm.expiryDate}
                      onChange={handleCreateFormChange}
                      required
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Usage Limit
                    </label>
                    <input
                      type="number"
                      name="usageLimit"
                      value={createForm.usageLimit}
                      onChange={handleCreateFormChange}
                      min="1"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold"
                      placeholder="Leave empty for unlimited"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Scope & Targeting */}
              <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-1.5 pb-2 border-b border-slate-100/50">
                  <Globe className="w-4 h-4 text-primary" /> Scope & Targeting
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Coupon Scope *
                    </label>
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80 w-full shadow-inner">
                      <button
                        type="button"
                        onClick={() => setCreateForm(prev => ({ ...prev, isGlobal: true, applicableZones: [] }))}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${createForm.isGlobal ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                      >
                        Global
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreateForm(prev => ({ ...prev, isGlobal: false }))}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${!createForm.isGlobal ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                      >
                        Zone Specific
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center pt-5 pl-2">
                    <label className="flex items-center space-x-3 cursor-pointer select-none bg-white py-2.5 px-4 rounded-xl border border-slate-200 w-full hover:bg-slate-50 transition-colors shadow-sm">
                      <input
                        type="checkbox"
                        name="isFirstBooking"
                        id="isFirstBooking"
                        checked={createForm.isFirstBooking}
                        onChange={handleCreateFormChange}
                        className="h-4.5 w-4.5 text-primary focus:ring-primary border-slate-350 rounded cursor-pointer accent-primary"
                      />
                      <span className="text-sm font-bold text-slate-700">First Booking Only</span>
                    </label>
                  </div>
                </div>

                {!createForm.isGlobal && !createForm.isFirstBooking && (
                  <div className="pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Assign to User (Optional)
                    </label>
                    {users.length > 0 ? (
                      <select
                        name="assignedTo"
                        value={createForm.assignedTo}
                        onChange={handleCreateFormChange}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold cursor-pointer"
                      >
                        <option value="">Select a user (optional)</option>
                        {users.map(user => {
                          const userObj = typeof user === 'string' ? { _id: user } : user;
                          return (
                            <option key={userObj._id} value={userObj._id}>
                              {getUserDisplayName(userObj)}
                              {userObj.email ? ` - ${userObj.email}` : ''}
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
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold"
                      />
                    )}
                  </div>
                )}

                {!createForm.isGlobal && (
                  <div className="pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <HierarchicalZoneSelector
                      zones={zones}
                      selectedZoneIds={createForm.applicableZones}
                      onChange={(zone) => handleZoneToggleCascade(zone, true)}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetCreateForm();
                  }}
                  className="px-5 py-2.5 text-sm font-bold text-slate-650 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-primary hover:bg-teal-800 text-white text-sm font-bold rounded-xl transition-colors flex items-center shadow-md hover:shadow-lg"
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
            <form onSubmit={handleUpdateCoupon} className="space-y-6">
              {/* Section 1: General Details */}
              <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-1.5 pb-2 border-b border-slate-100/50">
                  <Gift className="w-4 h-4 text-primary" /> General Configuration
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Coupon Code *
                    </label>
                    <input
                      type="text"
                      name="code"
                      value={editForm.code}
                      onChange={handleEditFormChange}
                      required
                      disabled={selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold font-mono uppercase disabled:bg-slate-100/80 disabled:text-slate-500 disabled:cursor-not-allowed"
                      placeholder="e.g., WELCOME20"
                      pattern="[A-Z0-9_]{5,20}"
                      title="5-20 uppercase alphanumeric characters or underscores"
                    />
                    {selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0 && (
                      <p className="text-[10px] text-amber-600 font-bold uppercase mt-1">Code locked after usage</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Discount Type *
                    </label>
                    <select
                      name="discountType"
                      value={editForm.discountType}
                      onChange={handleEditFormChange}
                      required
                      disabled={selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold cursor-pointer disabled:bg-slate-100/80 disabled:text-slate-500 disabled:cursor-not-allowed"
                    >
                      <option value="flat">Flat Amount (₹)</option>
                      <option value="percent">Percentage (%)</option>
                    </select>
                    {selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0 && (
                      <p className="text-[10px] text-amber-600 font-bold uppercase mt-1">Type locked after usage</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
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
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold disabled:bg-slate-100/80 disabled:text-slate-500 disabled:cursor-not-allowed"
                    />
                    {selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0 && (
                      <p className="text-[10px] text-amber-600 font-bold uppercase mt-1">Value locked after usage</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Minimum Booking Value (₹)
                    </label>
                    <input
                      type="number"
                      name="minBookingValue"
                      value={editForm.minBookingValue}
                      onChange={handleEditFormChange}
                      min="0"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Expiry & Limits */}
              <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-1.5 pb-2 border-b border-slate-100/50">
                  <Calendar className="w-4 h-4 text-primary" /> Rules & Restrictions
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Expiry Date *
                    </label>
                    <input
                      type="date"
                      name="expiryDate"
                      value={editForm.expiryDate}
                      onChange={handleEditFormChange}
                      required
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Usage Limit
                    </label>
                    <input
                      type="number"
                      name="usageLimit"
                      value={editForm.usageLimit}
                      onChange={handleEditFormChange}
                      min="1"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold"
                      placeholder="Leave empty for unlimited"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Scope & Targeting */}
              <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-1.5 pb-2 border-b border-slate-100/50">
                  <Globe className="w-4 h-4 text-primary" /> Scope & Targeting
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Coupon Scope *
                    </label>
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80 w-full shadow-inner disabled:opacity-50">
                      <button
                        type="button"
                        disabled={selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0}
                        onClick={() => setEditForm(prev => ({ ...prev, isGlobal: true, applicableZones: [] }))}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${editForm.isGlobal ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-800 disabled:opacity-50'}`}
                      >
                        Global
                      </button>
                      <button
                        type="button"
                        disabled={selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0}
                        onClick={() => setEditForm(prev => ({ ...prev, isGlobal: false }))}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${!editForm.isGlobal ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-800 disabled:opacity-50'}`}
                      >
                        Zone Specific
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-5 pl-2">
                    <label className="flex items-center space-x-2.5 cursor-pointer select-none bg-white py-2.5 px-3 rounded-xl border border-slate-200 w-full hover:bg-slate-50 transition-colors shadow-sm">
                      <input
                        type="checkbox"
                        name="isFirstBooking"
                        id="editIsFirstBooking"
                        checked={editForm.isFirstBooking}
                        onChange={handleEditFormChange}
                        disabled={selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0}
                        className="h-4.5 w-4.5 text-primary focus:ring-primary border-slate-350 rounded cursor-pointer accent-primary disabled:opacity-50"
                      />
                      <span className="text-xs font-black text-slate-700 leading-none">First Booking Only</span>
                    </label>

                    <label className="flex items-center space-x-2.5 cursor-pointer select-none bg-white py-2.5 px-3 rounded-xl border border-slate-200 w-full hover:bg-slate-50 transition-colors shadow-sm">
                      <input
                        type="checkbox"
                        name="isActive"
                        id="isActive"
                        checked={editForm.isActive}
                        onChange={handleEditFormChange}
                        className="h-4.5 w-4.5 text-primary focus:ring-primary border-slate-350 rounded cursor-pointer accent-primary"
                      />
                      <span className="text-xs font-black text-slate-700 leading-none">Active Coupon</span>
                    </label>
                  </div>
                </div>

                {!editForm.isGlobal && !editForm.isFirstBooking && (
                  <div className="pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Assign to User (Optional)
                    </label>
                    <select
                      name="assignedTo"
                      value={editForm.assignedTo}
                      onChange={handleEditFormChange}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-sm font-semibold cursor-pointer"
                    >
                      <option value="">Select a user (optional)</option>
                      {users.map(user => {
                        const userObj = typeof user === 'string' ? { _id: user } : user;
                        return (
                          <option key={userObj._id} value={userObj._id}>
                            {getUserDisplayName(userObj)}
                            {userObj.email ? ` - ${userObj.email}` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {!editForm.isGlobal && (
                  <div className="pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <HierarchicalZoneSelector
                      zones={zones}
                      selectedZoneIds={editForm.applicableZones || []}
                      onChange={(zone) => handleZoneToggleCascade(zone, false)}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-650 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-primary hover:bg-teal-800 text-white text-sm font-bold rounded-xl transition-colors flex items-center shadow-md hover:shadow-lg"
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
              {/* Premium Ticket Card with punch-holes */}
              <div className="relative bg-teal-50/40 border border-dashed border-primary/30 p-6 rounded-2xl overflow-hidden flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full border-r border-dashed border-primary/30" />
                <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full border-l border-dashed border-primary/30" />
                
                <div className="flex flex-col items-center sm:items-start text-center sm:text-left pl-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20 mb-2.5">
                    {selectedCoupon.isActive && !isExpired(selectedCoupon.expiryDate) ? 'Active Promo Code' : 'Inactive / Expired Code'}
                  </span>
                  <h3 className="text-3xl font-black text-secondary tracking-wider font-mono uppercase">
                    {selectedCoupon.code}
                  </h3>
                </div>
                <div className="flex flex-col items-center sm:items-end text-center sm:text-right pr-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Savings Value</span>
                  <div className="text-3xl font-black text-primary">
                    {selectedCoupon.discountType === 'flat'
                      ? formatCurrency(selectedCoupon.discountValue)
                      : `${selectedCoupon.discountValue}% OFF`
                    }
                  </div>
                </div>
              </div>

              {/* Key Indicators Grid */}
              <div className="grid grid-cols-3 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shadow-xs">
                <div className="text-center p-2 border-r border-slate-200/60">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center justify-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Expiry
                  </p>
                  <p className={`text-sm font-extrabold ${isExpired(selectedCoupon.expiryDate) ? 'text-red-500' : 'text-slate-750'}`}>
                    {formatDate(selectedCoupon.expiryDate)}
                  </p>
                  {isExpired(selectedCoupon.expiryDate) && (
                    <span className="inline-block mt-0.5 text-[8px] bg-red-150 text-red-700 px-1.5 py-0.2 rounded font-black uppercase">Expired</span>
                  )}
                </div>

                <div className="text-center p-2 border-r border-slate-200/60">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center justify-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Redemptions
                  </p>
                  <p className="text-sm font-extrabold text-slate-750">
                    {selectedCoupon.usedBy?.length || 0} <span className="text-slate-400 font-medium">/</span> {selectedCoupon.usageLimit === null ? '∞' : selectedCoupon.usageLimit}
                  </p>
                  <p className="text-[8px] text-slate-450 font-bold uppercase tracking-wider mt-0.5">Used Count</p>
                </div>

                <div className="text-center p-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center justify-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5" /> Min Booking
                  </p>
                  <p className="text-sm font-extrabold text-slate-750">
                    {selectedCoupon.minBookingValue ? formatCurrency(selectedCoupon.minBookingValue) : 'No Minimum'}
                  </p>
                  <p className="text-[8px] text-slate-455 font-bold uppercase tracking-wider mt-0.5">Minimum Spend</p>
                </div>
              </div>

              {/* Targeting & Scope Card (Combined fields) */}
              <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-1.5 pb-2 border-b border-slate-100/50">
                  <Globe className="w-4 h-4 text-primary" /> Targeting & Scope
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Coupon Type Info */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/50 flex items-center gap-3 shadow-xs">
                    <div className="p-2 bg-primary/10 text-primary rounded-xl border border-primary/20 shrink-0">
                      {selectedCoupon.isGlobal ? (
                        <Globe className="w-5 h-5 text-primary" />
                      ) : selectedCoupon.isFirstBooking ? (
                        <Users className="w-5 h-5 text-purple-650" />
                      ) : selectedCoupon.assignedTo ? (
                        <Users className="w-5 h-5 text-orange-600" />
                      ) : (
                        <Gift className="w-5 h-5 text-slate-650" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-750 uppercase tracking-wide leading-none">Campaign Type</p>
                      <p className="text-[11px] text-slate-500 font-semibold mt-1">
                        {selectedCoupon.isGlobal ? (
                          'Global Promotion'
                        ) : selectedCoupon.isFirstBooking ? (
                          'First Booking Only'
                        ) : selectedCoupon.assignedTo ? (
                          `User-Specific: ${getUserDisplayName(selectedCoupon.assignedTo)}`
                        ) : (
                          'Standard Campaign'
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Applicable Zones Info */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/50 flex flex-col justify-center shadow-xs">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Geographic Zones</p>
                    {selectedCoupon.applicableZones && selectedCoupon.applicableZones.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pr-1">
                        {selectedCoupon.applicableZones.map(z => {
                          const zoneId = typeof z === 'object' ? z._id : z;
                          return (
                            <span key={zoneId} className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-teal-50 text-teal-800 border border-teal-200/60 shadow-xs capitalize">
                              📍 {getZoneHierarchyPath(zoneId).split('>').pop().trim()}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-xs font-extrabold text-slate-750 flex items-center gap-1 uppercase tracking-wider text-[10px]">🌍 Globally Applicable</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Redemption History Table */}
              {selectedCoupon.usedBy && selectedCoupon.usedBy.length > 0 && (
                <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-1.5 pb-2 border-b border-slate-100/50">
                    <Clock className="w-4 h-4 text-primary" /> Redemption Logs ({selectedCoupon.usedBy.length})
                  </h4>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-full divide-y divide-slate-150">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">User</th>
                          <th className="px-4 py-2.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Booking Value</th>
                          <th className="px-4 py-2.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Redeemed At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {selectedCoupon.usedBy.map((usage, index) => (
                          <tr key={index} className="hover:bg-slate-50/40 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-extrabold text-slate-800 leading-none">{getUserDisplayName(usage.user)}</p>
                              <p className="text-[10px] text-slate-400 mt-1 font-semibold">{usage.user?.email || ''}</p>
                            </td>
                            <td className="px-4 py-3 font-extrabold text-slate-800">
                              {formatCurrency(usage.bookingValue)}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-500">
                              {formatDate(usage.usedAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-650 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    handleEditClick(selectedCoupon);
                  }}
                  className="px-5 py-2.5 bg-primary hover:bg-teal-800 text-white text-sm font-bold rounded-xl transition-colors flex items-center shadow-md hover:shadow-lg"
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



export default AdminCoupons;
